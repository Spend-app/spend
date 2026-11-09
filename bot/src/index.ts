import { CONFIG, publicClient, keeperAccount } from "./config.js";
import { scanProtocolState, SystemScanResult } from "./scanner.js";
import { executeLiquidation, executeWindDown } from "./executor.js";
import { sendTelegramAlert } from "./notifier.js";

let isScanning = false;
let lastBlockChecked = 0n;

async function runCycle(): Promise<void> {
  if (isScanning) return;
  isScanning = true;

  try {
    const currentBlock = await publicClient.getBlockNumber();
    if (currentBlock === lastBlockChecked) {
      isScanning = false;
      return;
    }
    lastBlockChecked = currentBlock;

    const state: SystemScanResult = await scanProtocolState();

    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `[${timestamp}] Block #${currentBlock} | BTC: $${state.btcPriceUsd.toLocaleString()} | Master ICR: ${
        state.masterOpened ? state.masterIcr.toFixed(1) + "%" : "Not Opened"
      } | Buffer: $${state.cashBufferMusd.toFixed(1)} MUSD | Active Borrowers: ${state.activeBorrowerCount}`
    );

    // 1. Critical Check: Mezo Master Trove Closed
    if (state.masterOpened && !state.inWindDown && state.masterTroveStatus > 1) {
      console.warn(`[WATCHDOG] Master Trove closed on Mezo (Status: ${state.masterTroveStatus})!`);
      await executeWindDown();
      isScanning = false;
      return;
    }

    // 2. Core Keeper Duty: Underwater Borrower Liquidation
    if (state.underwaterBorrowers.length > 0) {
      console.log(`[WATCHDOG] Found ${state.underwaterBorrowers.length} underwater borrower(s)!`);
      for (const borrower of state.underwaterBorrowers) {
        await executeLiquidation(borrower);
      }
    }

    // 3. Alert Only: Borrowers in Warning Zone (130% - 150% ICR)
    if (state.warningBorrowers.length > 0) {
      const summaryList = state.warningBorrowers
        .map((b) => `• \`${b.address.slice(0, 8)}...${b.address.slice(-6)}\`: ${b.icr.toFixed(1)}% ICR ($${b.principalMusd.toFixed(0)} MUSD)`)
        .join("\n");

      await sendTelegramAlert(
        "BORROWER RISK WARNING (ICR < 150%)",
        `${state.warningBorrowers.length} borrower position(s) are approaching the liquidation threshold (130%):\n\n${summaryList}\n\n*Action:* Monitor in Admin Operations dashboard.`,
        "borrower-warning-summary"
      );
    }

    // 4. Alert Only: Master Trove ICR Warning
    if (state.masterOpened && state.masterIcr > 0 && state.masterIcr < CONFIG.masterIcrWarnThreshold) {
      await sendTelegramAlert(
        "MASTER TROVE HEALTH WARNING",
        `Master Trove ICR has dropped to *${state.masterIcr.toFixed(1)}%* (Warning Threshold: ${CONFIG.masterIcrWarnThreshold}%).\nNew borrows pause automatically at 220% ICR.\n\n*Current BTC Oracle:* $${state.btcPriceUsd.toLocaleString()}\n*Recommended Action:* Add collateral or reduce master debt via the Admin dashboard.`,
        "master-icr-warning"
      );
    }

    // 5. Alert Only: Cash Buffer Depleted
    if (state.masterOpened && state.cashBufferMusd < CONFIG.bufferWarnThreshold) {
      await sendTelegramAlert(
        "CASH BUFFER LOW",
        `Spend cash buffer is at *$${state.cashBufferMusd.toFixed(2)} MUSD* (Target Threshold: $${CONFIG.bufferWarnThreshold} MUSD).\nBorrowers will trigger atomic Mezo debt increases to fund micro-loans.`,
        "buffer-low-warning"
      );
    }

    // 6. Alert Only: Mezo System Approaching Recovery Mode (TCR < 155%)
    if (state.systemTcr > 0 && state.systemTcr < 155) {
      await sendTelegramAlert(
        "MEZO SYSTEM RECOVERY MODE ALERT",
        `Mezo Base Protocol Total Collateral Ratio is at *${state.systemTcr.toFixed(1)}%* (Recovery Mode triggers at 150%).\nSpend automatically blocks new borrows if Recovery Mode activates.`,
        "mezo-tcr-alert"
      );
    }
  } catch (err: any) {
    console.error(`[WATCHDOG ERROR]`, err?.message || err);
  } finally {
    isScanning = false;
  }
}

async function startBot(): Promise<void> {
  console.log(`========================================================================`);
  console.log(`                   SPEND PROTOCOL KEEPER & ALERT BOT                    `);
  console.log(`========================================================================`);
  console.log(`Network:             Mezo Testnet (ChainId: ${CONFIG.chainId})`);
  console.log(`RPC Endpoint:        ${CONFIG.rpcUrl}`);
  console.log(`Spend Contract:      ${CONFIG.spendContract}`);
  console.log(`Keeper Mode:         ${keeperAccount ? `ACTIVE (${keeperAccount.address})` : "SIMULATION / READ-ONLY (No private key set)"}`);
  console.log(`Telegram Alerts:     ${CONFIG.telegramBotToken.includes("YOUR_") ? "PLACEHOLDER / CONSOLE MODE" : "ACTIVE"}`);
  console.log(`Poll Interval:       ${CONFIG.pollIntervalMs / 1000}s`);
  console.log(`========================================================================\n`);

  await sendTelegramAlert(
    "KEEPER BOT ONLINE",
    `Spend Keeper Bot started successfully.\nMonitoring contract: \`${CONFIG.spendContract}\` on Mezo Testnet.\nMode: ${keeperAccount ? "Automated Execution" : "Simulation / Alerts Only"}.`
  );

  // Initial immediate run
  await runCycle();

  // Recurring loop
  const interval = setInterval(runCycle, CONFIG.pollIntervalMs);

  const shutdown = () => {
    console.log("\n[Shutdown] Stopping Spend Keeper Bot gracefully...");
    clearInterval(interval);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startBot();
