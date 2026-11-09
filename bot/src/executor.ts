import { CONFIG, publicClient, walletClient, keeperAccount } from "./config.js";
import { spendAbi } from "./abi.js";
import { BorrowerHealth } from "./scanner.js";
import { sendTelegramAlert } from "./notifier.js";

export async function executeLiquidation(borrower: BorrowerHealth): Promise<boolean> {
  console.log(`[Executor] Processing liquidation for borrower ${borrower.address} (ICR: ${borrower.icr.toFixed(1)}%)...`);

  if (!walletClient || !keeperAccount) {
    console.warn(`[Executor] No KEEPER_PRIVATE_KEY configured. Running in SIMULATION mode.`);
    await sendTelegramAlert(
      "LIQUIDATION DETECTED (SIMULATION ONLY)",
      `Borrower \`${borrower.address}\` is underwater at *${borrower.icr.toFixed(1)}% ICR* (Threshold: ${CONFIG.masterIcrWarnThreshold}%).\nPrincipal: $${borrower.principalMusd.toFixed(2)} MUSD\nCollateral: ${borrower.originalBtc.toFixed(6)} BTC.\n\n*Action Required:* Liquidate manually in the Admin Operations UI or configure KEEPER_PRIVATE_KEY.`,
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
      await sendTelegramAlert(
        "USER LIQUIDATED SUCCESSFULLY",
        `*Liquidated Borrower:* \`${borrower.address}\`\n*ICR at Liquidation:* ${borrower.icr.toFixed(1)}%\n*Principal Cleared:* $${borrower.principalMusd.toFixed(2)} MUSD\n*Collateral Retained by Master:* ${borrower.originalBtc.toFixed(6)} BTC\n*Tx Hash:* [View on Explorer](https://explorer.test.mezo.org/tx/${txHash})`,
        `liq-success-${borrower.address}`
      );
      return true;
    } else {
      console.error(`[Executor] Liquidation transaction reverted on-chain.`);
      return false;
    }
  } catch (err: any) {
    console.error(`[Executor] Liquidation failed:`, err?.message || err);
    await sendTelegramAlert(
      "LIQUIDATION EXECUTION FAILED",
      `Failed to liquidate borrower \`${borrower.address}\`.\nReason: ${err?.shortMessage || err?.message || "Unknown error"}.`,
      `liq-err-${borrower.address}`
    );
    return false;
  }
}

export async function executeWindDown(): Promise<boolean> {
  console.log(`[Executor] Master Trove closed by Mezo. Executing enterWindDown()...`);

  if (!walletClient || !keeperAccount) {
    await sendTelegramAlert(
      "CRITICAL: MASTER TROVE CLOSED BY MEZO",
      "Mezo closed the master Trove. Immediate call to `enterWindDown()` is required to rescue surplus and unlock safe user claims.\nPlease trigger enterWindDown() via the Admin dashboard.",
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
      await sendTelegramAlert(
        "EMERGENCY: WIND-DOWN ACTIVATED",
        `Spend has successfully entered wind-down mode. User principal debt is forgiven and pro-rata collateral recovery is open.\nTx: https://explorer.test.mezo.org/tx/${txHash}`,
        "winddown-success"
      );
      return true;
    }
  } catch (err: any) {
    console.error(`[Executor] Wind-down execution failed:`, err?.message || err);
  }
  return false;
}
