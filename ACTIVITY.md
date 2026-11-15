# Spend: On-Chain Activity & Lifecycle Log

This log documents the real on-chain transactions executed against the verified Spend contract on Mezo testnet. Every transaction listed below is live on Mezo's Blockscout explorer and was executed directly against Mezo's canonical testnet protocol contracts.

---

## 1. Network & Deployment Summary

- **Network**: Mezo Testnet (Chain ID: `31611`)
- **Spend Contract**: [`0xdADB2C17199E2247C3FB65E75F62Db6bAFc4b7a0`](https://explorer.test.mezo.org/address/0xdADB2C17199E2247C3FB65E75F62Db6bAFc4b7a0)
- **Contract Status**: Verified on Explorer (Standard JSON Input, Solc 0.8.24, viaIR: true)
- **Contract Owner**: `0xb43C9F0F2bb65A37761E7867a6f1903799f45D65`
- **Connected Mezo Protocol Contracts**:
  - BorrowerOperations: `0xcdf7028ceab81fa0c6971208e83fa7872994bee5`
  - TroveManager: `0xe47c80e8c23f6b4a1ae41c34837a0599d5d16bb0`
  - PriceFeed: `0x86bcf0841622a5dac14a313a15f96a95421b9366`
  - MUSD Token: `0x118917a40faf1cd7a13db0ef56c86de7973ac503`

---

## 2. On-Chain Lifecycle Verification

Spend bridges the gap between Mezo's 1,800 MUSD minimum loan threshold and everyday Bitcoin holders who want to borrow micro amounts (10 to 500 MUSD). Every phase of the protocol lifecycle has been executed on testnet.

### Step 1: Master Trove Genesis

- **Transaction**: [`0x1c9b97bcac5b5dc26d5775bafab0df549dfad23630dc019d867a2f40a224dc96`](https://explorer.test.mezo.org/tx/0x1c9b97bcac5b5dc26d5775bafab0df549dfad23630dc019d867a2f40a224dc96)
- **Block**: `16,677,510`
- **Action**: `openMasterTrove()`
- **Parameters**:
  - Collateral Deposited: `0.0668975 BTC`
  - Master Debt Minted: `2,000 MUSD`
  - Interest Rate: Fixed `1.00%` (100 bps)
- **Outcome**: Established anchor Trove on Mezo with > 250% ICR, seeding the internal cash buffer for instant micro-loan disbursement.

* **Action**: Master Trove initialized through `openMasterTrove()`
* **Mechanism**: BTC collateral is locked into Mezo's `BorrowerOperations`, composite debt is minted (including the 200 MUSD gas compensation and borrowing fee), and the internal cash buffer is funded.
* **Master ICR Target**: Kept above 250% (comfortably above the 220% pause threshold).

### Step 2: Micro-Borrowing (10 to 50 MUSD)

Borrowers deposited native BTC and received MUSD instantly from Spend's buffer without needing $3,000 in BTC collateral:

- **Action**: User deposits native BTC and borrows micro amounts of MUSD.
- **Mechanism**:
  - The user's BTC is transferred directly into Mezo's master Trove, instantly boosting total collateral.
  - MUSD is disbursed immediately to the user from Spend's internal cash buffer.
  - If the cash buffer falls below `bufferThreshold` (500 MUSD), Spend atomically calls Mezo's `adjustTrove` to mint fresh MUSD and refill the buffer in the same transaction.
  - The borrower is added to the active borrower registry for tracking.

* **Borrow 1 (20 MUSD)**:
  - **Borrower**: [`0x62C647c5792D3bE19e474C3ad5F0eC50A8d5a2DF`](https://explorer.test.mezo.org/address/0x62C647c5792D3bE19e474C3ad5F0eC50A8d5a2DF)
  - **Tx**: [`0xfcaaf16d32f7fc24f17901b6bc4e24f1415edb5442ea2fc71d40ee7af2d2bb6e`](https://explorer.test.mezo.org/tx/0xfcaaf16d32f7fc24f17901b6bc4e24f1415edb5442ea2fc71d40ee7af2d2bb6e) | Block: `16,677,545`
  - **Amounts**: Principal 20 MUSD, 0.0004059 BTC deposited, 19.94 MUSD received (0.06 MUSD origination fee).

- **Action**: Borrower repays principal plus accrued interest (4% simple APR).
- **Mechanism**:
  - User approves Spend to pull MUSD.
  - Spend pulls the exact payoff amount.
  - Spend returns 100% of the user's deposited BTC directly back to their wallet.
  - Smart debt reduction: Repaid MUSD pays down Mezo master debt down to the safe 1,810 MUSD floor (`minNetDebt + 10e18`), while maintaining the 500 MUSD operational buffer so Mezo's minimum debt check never reverts.
  - The borrower is cleanly removed from the array via swap-and-pop to minimize gas.

* **Borrow 2 (10 MUSD)**:
  - **Borrower**: [`0xA9B7936De0Aa9B4c000E2acc2Ff1a81C10D342f8`](https://explorer.test.mezo.org/address/0xA9B7936De0Aa9B4c000E2acc2Ff1a81C10D342f8)
  - **Tx**: [`0x5d7678431c970a7de391659940a7b926940f569f7aa38814b59437d57b23333b`](https://explorer.test.mezo.org/tx/0x5d7678431c970a7de391659940a7b926940f569f7aa38814b59437d57b23333b) | Block: `16,677,557`
  - **Amounts**: Principal 10 MUSD, 0.0002029 BTC deposited, 9.97 MUSD received (0.03 MUSD fee).

* **Borrow 3 (50 MUSD)**:
  - **Borrower**: [`0xFCABee4934c13C1467c7403163F7079438b46348`](https://explorer.test.mezo.org/address/0xFCABee4934c13C1467c7403163F7079438b46348)
  - **Tx**: [`0xa2c8e06a1aa644de3a4051a85d418f4c3909205082368ffb58a2fb1ec81a1fab`](https://explorer.test.mezo.org/tx/0xa2c8e06a1aa644de3a4051a85d418f4c3909205082368ffb58a2fb1ec81a1fab) | Block: `16,678,858`
  - **Amounts**: Principal 50 MUSD, 0.0010121 BTC deposited, 49.85 MUSD received (0.15 MUSD fee).

### Step 3: Full Repayment & Collateral Return

Borrowers repaid their loans in full with accrued interest. In every case, 100% of their deposited BTC was returned to their wallet with zero lockup or penalty:

- **Repayment 1 (10 MUSD Loan)**:
  - **Borrower**: [`0xA9B7936De0Aa9B4c000E2acc2Ff1a81C10D342f8`](https://explorer.test.mezo.org/address/0xA9B7936De0Aa9B4c000E2acc2Ff1a81C10D342f8)
  - **Tx**: [`0x5a2bb2ef97c70b881aa66fa52488ada088426f5d62356c6b5d91996e28f7699b`](https://explorer.test.mezo.org/tx/0x5a2bb2ef97c70b881aa66fa52488ada088426f5d62356c6b5d91996e28f7699b) | Block: `16,677,587`
  - **Amounts**: Repaid 10.0000015 MUSD, received exact `0.000202989 BTC` back.

- **Repayment 2 (50 MUSD Loan)**:
  - **Borrower**: [`0xFCABee4934c13C1467c7403163F7079438b46348`](https://explorer.test.mezo.org/address/0xFCABee4934c13C1467c7403163F7079438b46348)
  - **Tx**: [`0xae83e4f9cb6b4fd0acce6a921927d1eae67d6ca10d50b764915e24665e1b6976`](https://explorer.test.mezo.org/tx/0xae83e4f9cb6b4fd0acce6a921927d1eae67d6ca10d50b764915e24665e1b6976) | Block: `16,678,925`
  - **Amounts**: Repaid 50.0000177 MUSD, received exact `0.001012145 BTC` back.

- **Repayment 3 (Repeated High-Volume Cycles)**:
  - **Borrower**: [`0xFCABee4934c13C1467c7403163F7079438b46348`](https://explorer.test.mezo.org/address/0xFCABee4934c13C1467c7403163F7079438b46348)
  - Cycle A Repay: [`0xad3a711124cd430d3b8eac39427cb7a3bf1bc6523ea15335249fc20c5827b035`](https://explorer.test.mezo.org/tx/0xad3a711124cd430d3b8eac39427cb7a3bf1bc6523ea15335249fc20c5827b035) | Block: `16,689,608`
  - Cycle B Repay: [`0xbfd02a6b9b5dec53a274a45eeace573d9e61fbab88a01b235ad4ea71537747fc`](https://explorer.test.mezo.org/tx/0xbfd02a6b9b5dec53a274a45eeace573d9e61fbab88a01b235ad4ea71537747fc) | Block: `16,690,019`
  - Cycle C Repay: [`0xe00c0c826cf0fad60671e1bd6efb83f507eba93eb6186b7603482876b3526bd3`](https://explorer.test.mezo.org/tx/0xe00c0c826cf0fad60671e1bd6efb83f507eba93eb6186b7603482876b3526bd3) | Block: `16,690,051`
  - **Outcome**: Verified that consecutive 50 MUSD borrows and repayments execute cleanly. Collateral was returned accurately, and the borrower registry was cleaned up using swap-and-pop with flat gas across all cycles.

### Step 4: Autonomous Keeper Liquidation

To verify that the system handles underwater positions automatically:

- **Undercollateralized Position**:
  - **Borrower**: [`0xA9B7936De0Aa9B4c000E2acc2Ff1a81C10D342f8`](https://explorer.test.mezo.org/address/0xA9B7936De0Aa9B4c000E2acc2Ff1a81C10D342f8)
  - Borrow Tx: [`0xf9d907cb4fb6f8fd32f0ff296db4475a61873bf85cd8354afc510ff1ba6c7ea8`](https://explorer.test.mezo.org/tx/0xf9d907cb4fb6f8fd32f0ff296db4475a61873bf85cd8354afc510ff1ba6c7ea8) | Block: `16,680,098`
  - Position fell below the liquidation line (136.32% ICR).

- **Live Execution by Watchdog Keeper**:
  - **Liquidation Tx**: [`0x545ad528cd9aab178ffe25e8c22512927c15cd4a61b088bb9753278e60b736a5`](https://explorer.test.mezo.org/tx/0x545ad528cd9aab178ffe25e8c22512927c15cd4a61b088bb9753278e60b736a5)
  - **Block**: `16,680,395`
  - **Status**: Success (`0x1`)
  - **Gas Used**: `108,824 gas`
  - **Principal Forfeited**: `20.00 MUSD`
  - **Collateral Retained**: `0.00036443 BTC`
  - **Solvency Impact**: Liquidated collateral remained 100% inside the Master Trove. Because the position closed at 136.32% ICR, roughly $1.36 of BTC backing stayed in the pool for every $1.00 of wiped debt, directly raising the Master Trove's ICR and strengthening the pool.

* **Action**: Autonomous keeper liquidated an undercollateralized position whose ICR dropped below 130%.
* **Live Execution Details**:
  - **Transaction Hash**: [`0x545ad528cd9aab178ffe25e8c22512927c15cd4a61b088bb9753278e60b736a5`](https://explorer.test.mezo.org/tx/0x545ad528cd9aab178ffe25e8c22512927c15cd4a61b088bb9753278e60b736a5)
  - **Block Number**: `16,680,395`
  - **Status**: Success (`0x1`)
  - **Liquidated Account**: `0xA9B7936De0Aa9B4c000E2acc2Ff1a81C10D342f8`
  - **Gas Used**: `108,824 gas`
  - **Keeper Service**: Running 24/7 on Render with Discord webhook alerts and `/health` uptime monitoring.
  - **Solvency Impact**: Liquidated collateral was forfeited directly to the master reserve. For every $1 of bad debt closed, roughly 130 cents worth of BTC remained in the master Trove, directly boosting overall pool health.

---

## 3. Real Tester Wallet Log & Feedback

Here is the log of real test wallets that executed transactions on Spend:

| Wallet Address                                                                                           | Transactions Tested                                                                                                                                                    | Observations & Verified Behavior                                                                                                |
| :------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| [`0x62C647...5a2DF`](https://explorer.test.mezo.org/address/0x62C647c5792D3bE19e474C3ad5F0eC50A8d5a2DF)  | Borrow 20 MUSD ([tx](https://explorer.test.mezo.org/tx/0xfcaaf16d32f7fc24f17901b6bc4e24f1415edb5442ea2fc71d40ee7af2d2bb6e))                                            | Micro-borrowing below Mezo's 1,800 MUSD limit verified. Payout arrived instantly from buffer.                                   |
| [`0xA9B793...342f8`](https://explorer.test.mezo.org/address/0xA9B7936De0Aa9B4c000E2acc2Ff1a81C10D342f8)  | Borrow 10 MUSD, Repay 10 MUSD, Borrow 20 MUSD, Liquidated ([tx](https://explorer.test.mezo.org/tx/0x545ad528cd9aab178ffe25e8c22512927c15cd4a61b088bb9753278e60b736a5)) | Lifecycle fully tested: borrowing, exact-BTC return on repayment, and automated keeper liquidation when ICR breached threshold. |
| [`0xFCABee...b46348`](https://explorer.test.mezo.org/address/0xFCABee4934c13C1467c7403163F7079438b46348) | 4 consecutive Borrow (50 MUSD) and Repay cycles ([latest tx](https://explorer.test.mezo.org/tx/0xe00c0c826cf0fad60671e1bd6efb83f507eba93eb6186b7603482876b3526bd3))    | Tested consecutive borrowing and full repayment cycles. Deposited collateral was returned immediately each time, and swap-and-pop array cleanup kept transaction gas flat across all 4 cycles. |

---

## 4. Key Takeaways from Live Testnet Data

1. **Exact-BTC Return Holds**: Across all completed repayments, 100% of deposited collateral was returned to the borrower's address down to the exact wei.
2. **Master Debt Paydown & Solvency**: Repayments directly target Mezo master debt reduction down to the safe 1,810 MUSD floor, while the 500 MUSD buffer threshold ensures the master Trove maintains working capital without breaching Mezo's minNetDebt.
3. **No Liquidation Collateral Bleed**: Spend's liquidation retained all collateral in the master Trove, generating surplus equity rather than bleeding 5% bonuses out to third parties.
4. **Autonomous Operations**: The watchdog bot runs 24/7 on Render, monitoring health via Multicall3 and executing liquidations without manual intervention.
