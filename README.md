# Spend – Micro-Borrowing Middleware on Mezo

**Spend** is a decentralized micro-borrowing layer built directly on top of [Mezo](https://mezo.org). It enables everyday Bitcoin holders to borrow small amounts of liquidity ($10–$500 in MUSD) against their BTC collateral without being priced out by protocol-level borrowing minimums.

---

## 1. Executive Summary

Mezo’s core borrowing protocol requires a minimum net debt of ~1,800 MUSD (plus 200 MUSD in gas compensation) to open a Trove. This threshold ensures protocol safety and economic viability for liquidations on the base layer. However, it inadvertently locks out retail users who only need micro-loans for everyday spending.

**Spend bridges this gap.** 

Operating as an autonomous smart-contract layer on Mezo:
1. Spend opens and maintains **one shared master Trove** on Mezo meeting the protocol minimums.
2. The borrowed MUSD forms an on-contract **cash buffer**.
3. Small borrowers deposit BTC into Spend and receive micro-loans ($10–$500 in MUSD) directly from the cash buffer.
4. User BTC is deposited into Spend's Mezo Trove, expanding real on-chain TVL while strengthening the master Trove's collateral ratio.
5. New debt is minted on Mezo only when the cash buffer drops below its target refill threshold.

---

## 2. Protocol Evolution: Wave 1 vs Wave 2

### Wave 1: Core Proof-of-Concept
The initial version of Spend established the foundation:
- Opened and funded Spend’s shared Trove on Mezo Testnet (`matsnet`, chainId 31611).
- Cash-buffer-first micro-lending model delivering instantaneous small loans.
- Internal accounting ledger tracking user BTC deposits, principals, and accrued interest.
- Exact BTC return on repayment.
- Basic administrative controls, pause mechanics, and health ratio checks.

### Judge Feedback on Wave 1 (`civ_defi_mezo`)
Following Wave 1, judge review highlighted critical solvency and risk surfaces inherent in a single shared Trove:
> *“Spend already composes Mezo for real: your contract opens a trove and calls addColl and withdrawColl on every borrow and repay, which puts you at level 4 on integration. The security review confirmed one High, which caps Technical at 2. Nothing handles a redemption or liquidation of the shared trove. A full redemption closes it, after which every repay reverts and withdrawBTC stays locked behind totalUserPrincipal == 0, so user BTC is frozen. Each repay also lowers the trove's collateral ratio, which pushes it to the front of the redemption queue. For Wave 2, write user claims down pro rata when Mezo takes collateral, add a wind-down path for a closed trove and an exit in Recovery Mode, let repaid MUSD pay down master debt, and add tests covering liquidation, redemption and Recovery Mode.”*

### Wave 2: Solvency & Robustness Upgrade
In response to the audit and feedback, Spend underwent a complete architectural upgrade to ensure solvency, resilience under Mezo liquidations/redemptions, and guaranteed user exit guarantees:

| Feature / Area | Wave 1 Baseline | Wave 2 Upgrade |
|---|---|---|
| **Collateral Loss Accounting** | No handling for redemptions; ledger assumed 100% of deposited BTC was always present. | **Pro-Rata Write-Down Engine**: Monotonically decreasing `writeDownFactor` scales user BTC claims proportionately if Mezo redeems or liquidates master collateral. |
| **Repayment Handling** | All repaid MUSD remained in the cash buffer; master debt was never reduced, progressively degrading master ICR. | **Smart Master Debt Reduction**: Repaid MUSD pays down Mezo master debt (capped at user principal) while strictly protecting the 1,810 MUSD floor to satisfy Mezo's debt minimum. |
| **Closed Trove Handling** | If Mezo redeemed or liquidated the master Trove, `repay()` reverted and user collateral was permanently locked. | **Dedicated Wind-Down Mode & Exit Path**: `claimInWindDown()` returns pro-rata recovered surplus BTC (if available) and automatically forgives outstanding principal debt. Users are never frozen. |
| **Insolvent Position Risk** | No individual liquidation; underwater positions (< 150% ICR) accumulated bad debt in the pool. | **Internal User Liquidation**: `liquidateUser()` clears positions falling below 130% ICR, forfeiting user collateral to the master reserve to fortify protocol solvency. |
| **Collateral Recovery** | Redemption leftovers in Mezo's `CollSurplusPool` were unhandled. | **Surplus Pool Integration**: `claimMasterCollateral()` / auto-claim pulls surplus BTC into Spend, softening write-downs for users. |
| **Recovery Mode** | Minimal handling during Mezo system stress. | **Full Recovery Mode Safeguards**: New borrows are strictly blocked; repayments check projected ICR against `CCR` (150%) / `MCR` (110%) before withdrawing collateral. |
| **Borrow Mutation** | Multi-step interactions that could invalidate hints. | **Atomic `adjustTrove` Execution**: User collateral deposit and buffer top-up execute in a single atomic transaction. |
| **Verification & Testing** | Manual testnet scripts. | **Complete Foundry Test Suite**: 7 automated unit and integration tests covering normal flows, pro-rata write-downs, recovery mode, user liquidations, and wind-down exits. |

---

## 3. Core Mechanics & Architecture

### 3.1 Cash-Buffer-First Micro-Borrowing
Spend eliminates per-borrow Mezo minimum debt constraints by decoupling user micro-loans from on-demand Mezo debt creation:

```
[ User ] --( 1. Deposit BTC )--> [ Spend Contract ] --( 2. addColl )--> [ Mezo Master Trove ]
   |                                    |
   <-----( 3. Pay MUSD from Buffer )----+
```

1. **Borrow Request:** A user requests `musdAmount` (between $10 and $500).
2. **Collateral Requirement:** Spend computes required BTC based on current oracle price and `minUserICR` (150%).
3. **Collateral Deposit:** The user transfers BTC to Spend. All incoming BTC is immediately forwarded into the Mezo master Trove via `addColl` or `adjustTrove`.
4. **Buffer Liquidity:**
   - If the contract cash buffer has sufficient funds (`buffer >= musdToUser + bufferThreshold`), MUSD is paid out directly without minting new Mezo debt.
   - If the cash buffer is low, Spend calls `adjustTrove` with collateral addition and a debt increase in a single atomic call, minting only what is required to fulfill the loan and top up the buffer.
5. **Fee Booking:** An origination fee (0.30%) is deducted, and the user receives the net MUSD.

### 3.2 Repayment & Smart Debt Paydown
When a user repays their micro-loan:

```
[ User ] --( 1. Repay MUSD + Interest )--> [ Spend Contract ]
                                                  |
           +--------------------------------------+--------------------------------------+
           | (When Master Debt <= 1,810 Floor)                                           | (When Master Debt > 1,810 Floor)
           v                                                                             v
[ Retain MUSD in Contract Cash Buffer ]                       [ Call Mezo repayMUSD (Capped at user principal) ]
                                                  |
                                                  v
                     [ Withdraw User's Pro-Rata Claimed BTC & Return to User ]
```

1. **User Repayment:** The user approves and pays their total debt (`principal + simple interest`).
2. **Buffer Cushion Check:** The contract checks if the buffer holds excess funds above `bufferThreshold` ($500$ MUSD). Because `borrow()` automatically mints from Mezo when funding loans, the buffer is already well-stocked.
3. **Capped Master Debt Paydown:** If excess exists, the contract pays down Mezo master debt:
   - **User Principal Cap:** The paydown is strictly capped at `pos.principal`, ensuring a single micro-repayment never dumps the entire cash buffer into Mezo.
   - **The 1,810 MUSD Safe Floor:** Mezo's `BorrowerOperations.repayMUSD()` strictly requires `newNetDebt > minNetDebt` ($1,800$ MUSD). Spend enforces an exact **1,810 MUSD floor** (`minNetDebt + 10 MUSD`). If master debt reaches 1,810 MUSD, further master debt repayments pause automatically and MUSD accumulates safely in the buffer.
4. **Collateral Return:** The user receives their effective BTC claim back (`originalBtc * writeDownFactor / 1e18`).

### 3.3 Pro-Rata Write-Down Engine
If Mezo executes a redemption or liquidation against Spend's master Trove, collateral is lost. Spend ensures fair, deterministic, and pro-rata sharing of this loss across all open positions:

$$\text{writeDownFactor} = \min\left(\text{writeDownFactor}_{\text{current}}, \frac{\text{availableBTC} \times 10^{18}}{\text{totalOriginalBtc}}\right)$$

$$\text{effectiveClaim} = \frac{\text{userOriginalBtc} \times \text{writeDownFactor}}{10^{18}}$$

- **Monotonically Decreasing:** The factor can only decrease or stay constant; protocol capital additions increase master safety without artificially inflating user claims beyond their original deposits.
- **Fair Accounting:** If the master Trove loses 15% of its collateral in a redemption, all user claims scale down by 15% synchronously.
- **Surplus Softening:** Leftover collateral in Mezo's `CollSurplusPool` can be claimed by anyone via `claimMasterCollateral()`, adding back to `availableBTC` before applying write-downs.

### 3.4 Wind-Down Mode & Exit Reality
If extreme market stress or a full Mezo redemption causes the master Trove to close on Mezo:
1. Anyone can call `enterWindDown()`.
2. Spend automatically calls `borrowerOperations.claimCollateral()` to rescue any residual collateral from Mezo's `CollSurplusPool`.
3. New borrowing is permanently stopped.
4. Users call `claimInWindDown()`:
   - **Pro-Rata Collateral Return:** If Mezo left a surplus in `CollSurplusPool`, users receive their pro-rata share of that recovered BTC. If Mezo liquidated the master Trove with zero surplus, available BTC is zero and users receive 0 BTC.
   - **Debt Forgiveness:** Outstanding user principal debt is completely **forgiven**. Borrowers are never chased for unpaid MUSD and keep the liquidity they borrowed.
   - Position is closed cleanly. Users are never frozen.

### 3.5 Internal User Liquidation (`liquidateUser`)
To prevent underwater borrower positions from building up bad debt inside the pooled master reserve:
1. **Liquidation Threshold:** Default set at **130% ICR** (`liquidationICR`, owner-configurable between 115% and 145%).
2. **Trigger:** Anyone, a keeper, or the protocol admin can call `liquidateUser(address user)` when `getUserICR(user) < liquidationICR`.
3. **Solvency Benefit:**
   - The borrower's loan is removed from `totalUserPrincipal`.
   - Their collateral claim is deleted from `totalOriginalBtc`.
   - **The borrower's BTC collateral remains permanently inside Mezo's master Trove.** Because the position is liquidated at ~130% ICR, Spend retains 130 cents of BTC for every 100 cents of loan debt, immediately improving the master reserve's collateral ratio for all remaining borrowers.
4. **On-Chain Borrower Registry:** Spend maintains an `activeBorrowers` array with $O(1)$ swap-and-pop tracking, exposing live borrower health in the Admin Operations dashboard with one-click liquidation buttons.

---

## 4. Protocol Economics & Revenue Model

Spend operates with a transparent, sustainable fee model:

| Revenue / Cost Stream | Rate | Description |
|---|---|---|
| **Origination Fee** | 0.30% (30 bps) | Flat fee deducted upfront from user loan payouts. |
| **Borrower Interest Rate** | 4.00% simple APR | Accrued per-second on user principal positions. |
| **Mezo Master Borrowing Rate** | 1.00% fixed APR | Fixed interest rate charged by Mezo on the master Trove debt. |
| **Protocol Net Margin** | ~3.00% APR + fees | Net margin retained by protocol-owned equity to absorb risk and insure the buffer. |

---

## 5. Risk Management & Safety Limits

| Parameter | Value | Purpose |
|---|---|---|
| `minUserICR` | 150% | Minimum Individual Collateral Ratio required from users at loan inception. |
| `liquidationICR` | 130% | User liquidation threshold; positions below 130% ICR can be liquidated by anyone. |
| `pauseICR` | 220% | Master Trove ICR safety threshold; new borrows automatically pause if master ICR falls below this mark. |
| `minBorrow` | 10 MUSD | Prevents dust transactions. |
| `maxBorrow` | 500 MUSD | Caps single-user exposure to limit individual systemic risk. |
| `bufferThreshold` | 500 MUSD | Target cash buffer maintained for instant loan settlement. |
| `originationFeeBps`| 30 bps (0.30%) | Sustainable protocol origination fee. |
| `userInterestRate` | 4.00% APR | Transparent simple borrowing APR. |

---

## 6. Smart Contract Reference

The protocol implementation is contained in [`contract/src/Spend.sol`](file:///home/freed/Projects/spend/contract/src/Spend.sol).

### Core Mutators
- `borrow(uint256 musdAmount, address upperHint, address lowerHint)`: Deposits BTC and disburses MUSD to user.
- `repay(address upperHint, address lowerHint)`: Repays MUSD principal + interest, returns pro-rata BTC, and pays down master debt (respecting the 1,810 floor).
- `liquidateUser(address user)`: Liquidates underwater user position (< 130% ICR), forfeiting collateral to the master reserve.
- `enterWindDown()`: Enters wind-down mode when the master Trove is closed by Mezo.
- `claimInWindDown()`: Wind-down exit function for users to claim remaining BTC and forgive remaining debt.
- `syncWriteDown()`: Publicly callable function to sync the write-down factor against real Mezo collateral.
- `claimMasterCollateral()`: Claims collateral surplus from Mezo's `CollSurplusPool`.

### Key Protocol Views
- `getMasterICR()`: Returns current Individual Collateral Ratio of the master Trove.
- `getMasterTCR()`: Returns Total Collateral Ratio across Mezo.
- `isRecoveryMode()`: Returns whether Mezo is currently in Recovery Mode.
- `getCashBuffer()`: Returns total unallocated MUSD held in Spend's buffer.
- `getRequiredBTC(uint256 musdAmount)`: Computes exact BTC required to open a loan at current oracle prices.
- `getUserPosition(address user)`: Returns user position details including original deposit, current effective claim, principal, and accrued interest.
- `getUserICR(address user)`: Returns individual collateral ratio for a user position.
- `getActiveBorrowers()`: Returns on-chain array of currently active borrower addresses.
- `getActiveBorrowerCount()`: Returns total number of active borrowers.
- `isInWindDown()`: Returns protocol wind-down status.

---

## 7. Automated Testing & Verification

Spend includes an automated Foundry test harness validating all critical flows and edge cases:

```bash
cd contract
forge test -vvv
```

### Test Suite Coverage (`contract/test/Spend.t.sol`)

| Test Name | Gas | Scenario Tested |
|---|---|---|
| `test_BorrowAndRepay_Normal` | 316,400 | Alice borrows 100 MUSD against BTC. Validates buffer distribution, fees, and clean repayment with exact BTC return. |
| `test_ProRataWriteDown_OnRedemption` | 480,725 | Simulates a Mezo redemption taking 20% of master collateral. Proves user claims scale down pro-rata, preventing pool underflow. |
| `test_RecoveryMode_BlocksNewBorrows` | 53,924 | Simulates Mezo entering system-wide Recovery Mode. Verifies that `borrow()` immediately reverts. |
| `test_WindDownExit_WhenMasterTroveClosed` | 283,273 | Simulates master Trove closure by Mezo. Verifies `enterWindDown()`, collateral claim, and `claimInWindDown()` debt forgiveness without reverting. |
| `test_LiquidateUser_Healthy_Reverts` | 333,856 | Verifies that attempting to liquidate a healthy position (>= 130% ICR) strictly reverts with "Position is healthy". |
| `test_LiquidateUser_Underwater_Succeeds` | 289,864 | Simulates BTC price drop dropping Alice to 112% ICR. Verifies liquidation clears debt and leaves collateral in master Trove. |
| `test_ActiveBorrowers_Tracking` | 658,765 | Validates O(1) swap-and-pop borrower tracking across multiple simultaneous borrows and repayments. |

---

## 8. Verified Deployments & Network Details

- **Network:** Mezo Testnet (`matsnet`)
- **Chain ID:** `31611`
- **RPC URL:** `https://rpc.test.mezo.org`

### Deployed Spend Protocol
- **Spend Contract:** [`0xdADB2C17199E2247C3FB65E75F62Db6bAFc4b7a0`](https://explorer.test.mezo.org/address/0xdADB2C17199E2247C3FB65E75F62Db6bAFc4b7a0)

### Verified Mezo Protocol Addresses
- **BorrowerOperations:** `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`
- **TroveManager:** `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`
- **PriceFeed:** `0x86bCF0841622a5dAC14A313a15f96A95421b9366`
- **MUSD Token:** `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- **SortedTroves:** `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA`
- **HintHelpers:** `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6`

---

## 9. Quick Start & Local Development

### Smart Contracts (Foundry)
```bash
cd contract
forge test -vvv
```

### Frontend Application (Vite + React + Wagmi)
```bash
cd frontend
npm install
npm run dev
```

To build for production:
```bash
cd frontend
npm run build
```

### Autonomous Keeper & Alert Bot
```bash
cd bot
npm install
npm run dev
```

---

## 10. Roadmap to Mainnet & Production Hardening

Before deploying with real mainnet capital, the protocol will complete the following production hardening milestones:

1. **Third-Party Security Audit:**
   - Formal audit of [`contract/src/Spend.sol`](file:///home/freed/Projects/spend/contract/src/Spend.sol) conducted while on testnet prior to mainnet deployment.
   - Comprehensive verification of pro-rata write-down math, individual user liquidation mechanics, and reentrancy protections.

2. **Multisig Governance (Safe):**
   - The contract `owner` role will be transferred to a Gnosis Safe multisig (e.g., 2-of-3 or 3-of-5 signers).
   - Eliminates single-point-of-failure risk: parameter updates, pauses, or fee withdrawals will require multiple hardware wallet confirmations.

3. **Master Reserve Capitalization:**
   - Initial master Trove funded with deep collateral reserves targeting **>= 300% ICR** upon mainnet genesis.
   - High ICR buffer ensures the master Trove is resilient against market flash crashes and positioned safely behind other borrowers in Mezo's redemption queue.

4. **High-Availability Cloud Bot (Render / AWS):**
   - Autonomous Keeper & Alert Bot deployed as a continuous background daemon on cloud infrastructure (e.g., Render, Railway, or AWS ECS).
   - Redundant RPC connections with dynamic gas price bidding to ensure user liquidations execute reliably during market volatility.
