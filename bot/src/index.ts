import http from "node:http";
import { CONFIG, publicClient, keeperAccount } from "./config.js";
import { scanProtocolState, SystemScanResult } from "./scanner.js";
import { executeLiquidation, executeWindDown, executeSyncWriteDown } from "./executor.js";
import { sendAlert } from "./notifier.js";

let isScanning = false;
let lastBlockChecked = 0n;
let latestState: SystemScanResult | null = null;

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
    latestState = state;

    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `[${timestamp}] Block #${currentBlock} | BTC: $${state.btcPriceUsd.toLocaleString()} | Master ICR: ${
        state.masterOpened ? state.masterIcr.toFixed(1) + "%" : "Not Opened"
      } | Buffer: $${state.cashBufferMusd.toFixed(1)} MUSD | Active Borrowers: ${state.activeBorrowerCount} | WriteDown: ${state.writeDownFactorPct.toFixed(1)}%`
    );

    // 1. Critical Check: Mezo Master Trove Closed
    if (state.masterOpened && !state.inWindDown && state.masterTroveStatus > 1) {
      console.warn(`[WATCHDOG] Master Trove closed on Mezo (Status: ${state.masterTroveStatus})!`);
      await executeWindDown();
      isScanning = false;
      return;
    }

    // 2. Solvency Duty: Pro-Rata Write-Down Sync
    if (state.needsWriteDown) {
      console.warn(`[WATCHDOG] Write-down required! Current: ${state.writeDownFactorPct.toFixed(1)}%, Target: ${state.projectedWriteDownPct.toFixed(1)}%`);
      await executeSyncWriteDown(state.writeDownFactorPct, state.projectedWriteDownPct);
    }

    // 3. Core Keeper Duty: Underwater Borrower Liquidation (< 130% ICR)
    if (state.underwaterBorrowers.length > 0) {
      console.log(`[WATCHDOG] Found ${state.underwaterBorrowers.length} underwater borrower(s)!`);
      for (const borrower of state.underwaterBorrowers) {
        await executeLiquidation(borrower);
      }
    }

    // 4. Alert Only: Borrowers in Warning Zone (130% - 150% ICR)
    if (state.warningBorrowers.length > 0) {
      const summaryList = state.warningBorrowers
        .map((b) => `• \`${b.address.slice(0, 8)}...${b.address.slice(-6)}\`: **${b.icr.toFixed(1)}% ICR** ($${b.principalMusd.toFixed(0)} MUSD)`)
        .join("\n");

      await sendAlert(
        "BORROWER RISK WARNING (ICR < 150%)",
        `${state.warningBorrowers.length} borrower position(s) are approaching the liquidation threshold (130%):\n\n${summaryList}\n\n**Action:** Monitor in Admin Operations dashboard.`,
        "warning",
        "borrower-warning-summary"
      );
    }

    // 5. Alert Only: Master Trove ICR Warning
    if (state.masterOpened && state.masterIcr > 0 && state.masterIcr < CONFIG.masterIcrWarnThreshold) {
      await sendAlert(
        "MASTER TROVE HEALTH WARNING",
        `Master Trove ICR has dropped to **${state.masterIcr.toFixed(1)}%** (Warning Threshold: ${CONFIG.masterIcrWarnThreshold}%).\nNew borrows pause automatically at 220% ICR.\n\n• **Current BTC Oracle:** $${state.btcPriceUsd.toLocaleString()}\n• **Recommended Action:** Add collateral or reduce master debt via the Admin dashboard.`,
        "warning",
        "master-icr-warning"
      );
    }

    // 6. Alert Only: Cash Buffer Depleted
    if (state.masterOpened && state.cashBufferMusd < CONFIG.bufferWarnThreshold) {
      await sendAlert(
        "CASH BUFFER LOW",
        `Spend cash buffer is at **$${state.cashBufferMusd.toFixed(2)} MUSD** (Target Threshold: $${CONFIG.bufferWarnThreshold} MUSD).\nBorrowers will trigger atomic Mezo debt increases to fund micro-loans.`,
        "info",
        "buffer-low-warning"
      );
    }

    // 7. Alert Only: Mezo System Approaching Recovery Mode (TCR < 155%)
    if (state.systemTcr > 0 && state.systemTcr < 155) {
      await sendAlert(
        "MEZO SYSTEM RECOVERY MODE ALERT",
        `Mezo Base Protocol Total Collateral Ratio is at **${state.systemTcr.toFixed(1)}%** (Recovery Mode triggers at 150%).\nSpend automatically blocks new borrows if Recovery Mode activates.`,
        "warning",
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
  const hasDiscord = CONFIG.discordWebhookUrl && !CONFIG.discordWebhookUrl.includes("YOUR_");
  const hasTelegram = CONFIG.telegramBotToken && !CONFIG.telegramBotToken.includes("YOUR_");
  const PORT = Number(process.env.PORT || 3000);

  console.log(`========================================================================`);
  console.log(`                   SPEND PROTOCOL KEEPER & ALERT BOT                    `);
  console.log(`========================================================================`);
  console.log(`Network:             Mezo Testnet (ChainId: ${CONFIG.chainId})`);
  console.log(`RPC Endpoint:        ${CONFIG.rpcUrl}`);
  console.log(`Spend Contract:      ${CONFIG.spendContract}`);
  console.log(`Keeper Mode:         ${keeperAccount ? `ACTIVE (${keeperAccount.address})` : "SIMULATION / READ-ONLY (No private key set)"}`);
  console.log(`Alert Channels:      ${hasDiscord ? "DISCORD WEBHOOK" : hasTelegram ? "TELEGRAM" : "CONSOLE MODE"}`);
  console.log(`Poll Interval:       ${CONFIG.pollIntervalMs / 1000}s`);
  console.log(`Health Check Port:   ${PORT} (Ready for Render & UptimeRobot)`);
  console.log(`========================================================================\n`);

  // Start HTTP health check server for Render free web service + UptimeRobot
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          {
            status: "healthy",
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            network: "Mezo Testnet (ChainId 31611)",
            contract: CONFIG.spendContract,
            lastBlockChecked: lastBlockChecked.toString(),
            latestState: latestState
              ? {
                  btcPriceUsd: latestState.btcPriceUsd,
                  masterOpened: latestState.masterOpened,
                  masterIcr: latestState.masterOpened ? `${latestState.masterIcr.toFixed(1)}%` : "Not Opened",
                  cashBufferMusd: `${latestState.cashBufferMusd.toFixed(1)} MUSD`,
                  activeBorrowerCount: latestState.activeBorrowerCount,
                  writeDownFactorPct: `${latestState.writeDownFactorPct.toFixed(1)}%`,
                  underwaterCount: latestState.underwaterBorrowers.length,
                  warningCount: latestState.warningBorrowers.length,
                }
              : null,
          },
          null,
          2
        )
      );
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  server.listen(PORT, () => {
    console.log(`[Health Server] Listening for UptimeRobot pings on port ${PORT}`);
  });

  await sendAlert(
    "KEEPER BOT ONLINE",
    `Spend Keeper Bot started successfully.\n• Contract: \`${CONFIG.spendContract}\` on Mezo Testnet.\n• Mode: ${keeperAccount ? "Automated Execution" : "Simulation / Alerts Only"}.\n• Health Endpoint: Active on port ${PORT}.`,
    "success"
  );

  // Initial immediate run
  await runCycle();

  // Recurring loop
  const interval = setInterval(runCycle, CONFIG.pollIntervalMs);

  const shutdown = () => {
    console.log("\n[Shutdown] Stopping Spend Keeper Bot gracefully...");
    clearInterval(interval);
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startBot();
