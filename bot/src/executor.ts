import { CONFIG, publicClient, walletClient, keeperAccount } from "./config.js";
import { spendAbi } from "./abi.js";
import { BorrowerHealth } from "./scanner.js";
import { sendAlert } from "./notifier.js";

export async function executeLiquidation(
  borrower: BorrowerHealth,
  liquidationThreshold: number
): Promise<boolean> {
  console.log(`[Executor] Processing liquidation for borrower ${borrower.address} (ICR: ${borrower.icr.toFixed(1)}%, Threshold: ${liquidationThreshold}%)...`);

  if (!walletClient || !keeperAccount) {
    console.warn(`[Executor] No KEEPER_PRIVATE_KEY configured. Running in SIMULATION mode.`);
    await sendAlert(
      "LIQUIDATION DETECTED (SIMULATION ONLY)",
      `Borrower \`${borrower.address}\` is underwater at **${borrower.icr.toFixed(1)}% ICR** (Threshold: ${liquidationThreshold}%).\n• Principal: $${borrower.principalMusd.toFixed(2)} MUSD\n• Collateral: ${borrower.originalBtc.toFixed(6)} BTC\n\n**Action Required:** Liquidate manually in the Admin Operations UI or configure KEEPER_PRIVATE_KEY in .env.`,
      "danger",
      `liq-sim-${borrower.address}`
    );
    return false;
  }

  try {
    // 1. Simulate on-chain call first to protect gas
    const { request } = await publicClient.simulateContract({
      account: keeperAccount,
      address: CONFIG.spendContract,
      abi: spendAbi,
      functionName: "liquidateUser",
      args: [borrower.address],
    });

    console.log(`[Executor] Simulation successful! Broadcasting liquidation transaction...`);

    // 2. Broadcast transaction
    const txHash = await walletClient.writeContract(request);
    console.log(`[Executor] Tx broadcasted: ${txHash}`);

    // 3. Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`[Executor] Liquidation confirmed in block ${receipt.blockNumber}! Status: ${receipt.status}`);

    if (receipt.status === "success") {
      await sendAlert(
        "USER LIQUIDATED SUCCESSFULLY",
        `**Liquidated Borrower:** \`${borrower.address}\`\n• ICR at Liquidation: ${borrower.icr.toFixed(1)}%\n• Principal Cleared: $${borrower.principalMusd.toFixed(2)} MUSD\n• Collateral Retained by Master: ${borrower.originalBtc.toFixed(6)} BTC\n• [View on Explorer](https://explorer.test.mezo.org/tx/${txHash})`,
        "success",
        `liq-success-${borrower.address}`
      );
      return true;
    } else {
      console.error(`[Executor] Liquidation transaction reverted on-chain.`);
      return false;
    }
  } catch (err: any) {
    console.error(`[Executor] Liquidation failed:`, err?.message || err);
    await sendAlert(
      "LIQUIDATION EXECUTION FAILED",
      `Failed to liquidate borrower \`${borrower.address}\`.\nReason: ${err?.shortMessage || err?.message || "Unknown error"}.`,
      "danger",
      `liq-err-${borrower.address}`
    );
    return false;
  }
}

export async function executeSyncWriteDown(currentPct: number, projectedPct: number): Promise<boolean> {
  console.log(`[Executor] Mezo collateral loss detected. Write-down needed (${currentPct.toFixed(1)}% -> ${projectedPct.toFixed(1)}%)...`);

  if (!walletClient || !keeperAccount) {
    await sendAlert(
      "WRITE-DOWN SYNC REQUIRED",
      `Mezo redemption detected! Master Trove lost collateral.\n• Current Write-down Factor: ${currentPct.toFixed(1)}%\n• Projected Factor: ${projectedPct.toFixed(1)}%\n\n**Action Required:** Click 'Sync Write-Down' in Admin Operations or configure KEEPER_PRIVATE_KEY.`,
      "warning",
      "writedown-manual"
    );
    return false;
  }

  try {
    const { request } = await publicClient.simulateContract({
      account: keeperAccount,
      address: CONFIG.spendContract,
      abi: spendAbi,
      functionName: "syncWriteDown",
    });

    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "success") {
      await sendAlert(
        "WRITE-DOWN SYNCED AUTONOMOUSLY",
        `Spend successfully synced write-down factor.\n• Old Factor: ${currentPct.toFixed(1)}%\n• New Factor: ${projectedPct.toFixed(1)}%\n• [View on Explorer](https://explorer.test.mezo.org/tx/${txHash})`,
        "success",
        "writedown-success"
      );
      return true;
    }
  } catch (err: any) {
    console.error(`[Executor] Write-down execution failed:`, err?.message || err);
  }
  return false;
}

export async function executeWindDown(): Promise<boolean> {
  console.log(`[Executor] Master Trove closed by Mezo. Executing enterWindDown()...`);

  if (!walletClient || !keeperAccount) {
    await sendAlert(
      "CRITICAL: MASTER TROVE CLOSED BY MEZO",
      "Mezo closed the master Trove. Immediate call to `enterWindDown()` is required to rescue surplus and unlock safe user claims.\nPlease trigger enterWindDown() via the Admin dashboard.",
      "danger",
      "winddown-manual"
    );
    return false;
  }

  try {
    const { request } = await publicClient.simulateContract({
      account: keeperAccount,
      address: CONFIG.spendContract,
      abi: spendAbi,
      functionName: "enterWindDown",
    });

    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "success") {
      await sendAlert(
        "EMERGENCY: WIND-DOWN ACTIVATED",
        `Spend has successfully entered wind-down mode. User principal debt is forgiven and pro-rata collateral recovery is open.\nTx: https://explorer.test.mezo.org/tx/${txHash}`,
        "danger",
        "winddown-success"
      );
      return true;
    }
  } catch (err: any) {
    console.error(`[Executor] Wind-down execution failed:`, err?.message || err);
  }
  return false;
}
