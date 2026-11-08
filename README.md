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
| **Repayment Handling** | All repaid MUSD remained in the cash buffer; master debt was never reduced, progressively degrading master ICR. | **Smart Master Debt Reduction**: Repaid MUSD fills the cash buffer to `bufferThreshold`, and any excess automatically pays down master Trove debt (respecting Mezo's `minNetDebt`). |
| **Closed Trove Handling** | If Mezo redeemed or liquidated the master Trove, `repay()` reverted and user collateral was permanently locked. | **Dedicated Wind-Down Mode & Exit Path**: `claimInWindDown()` allows users to claim their pro-rata collateral and automatically forgives outstanding principal debt. Users are never frozen. |
| **Collateral Recovery** | Redemption leftovers in Mezo's `CollSurplusPool` were unhandled. | **Surplus Pool Integration**: `claimMasterCollateral()` / auto-claim pulls surplus BTC into Spend, softening write-downs for users. |
| **Recovery Mode** | Minimal handling during Mezo system stress. | **Full Recovery Mode Safeguards**: New borrows are strictly blocked; repayments check projected ICR against `CCR` (150%) / `MCR` (110%) before withdrawing collateral. |
| **Borrow Mutation** | Multi-step interactions that could invalidate hints. | **Atomic `adjustTrove` Execution**: User collateral deposit and buffer top-up execute in a single atomic transaction. |
| **Verification & Testing** | Manual testnet scripts. | **Complete Foundry Test Suite**: 100% passing automated unit and integration tests covering normal flows, pro-rata write-downs, recovery mode, and wind-down exits. |

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
           | (Top up Cash Buffer)                                                        | (Pay Down Master Trove Debt)
           v                                                                             v
[ Keep MUSD up to bufferThreshold ]                            [ Call Mezo repayMUSD for Excess (capped at minNetDebt) ]
                                                  |
                                                  v
                     [ Withdraw User's Pro-Rata Claimed BTC & Return to User ]
```

1. **User Repayment:** The user approves and pays their total debt (`principal + simple interest`).
2. **Buffer Prioritization:** The contract ensures the cash buffer maintains at least `bufferThreshold` (default: 500 MUSD).
3. **Automatic Master Debt Paydown:** Any MUSD received beyond `bufferThreshold` is automatically routed to Mezo via `borrowerOperations.repayMUSD()`, paying down the master Trove debt while strictly respecting Mezo's `minNetDebt` (1,800 MUSD).
4. **Collateral Return:** The user receives their effective BTC claim back (`originalBtc * writeDownFactor / 1e18`).

### 3.3 Pro-Rata Write-Down Engine
If Mezo executes a redemption or liquidation against Spend's master Trove, collateral is lost. Spend ensures fair, deterministic, and pro-rata sharing of this loss across all open positions:

$$\text{writeDownFactor} = \min\left(\text{writeDownFactor}_{\text{current}}, \frac{\text{availableBTC} \times 10^{18}}{\text{totalOriginalBtc}}\right)$$

$$\text{effectiveClaim} = \frac{\text{userOriginalBtc} \times \text{writeDownFactor}}{10^{18}}$$

- **Monotonically Decreasing:** The factor can only decrease or stay constant; protocol capital additions increase master safety without artificially inflating user claims beyond their original deposits.
- **Fair Accounting:** If the master Trove loses 15% of its collateral in a redemption, all user claims scale down by 15% synchronously.
- **Surplus Softening:** Leftover collateral in Mezo's `CollSurplusPool` can be claimed by anyone via `claimMasterCollateral()`, adding back to `availableBTC` before applying write-downs.

### 3.4 Wind-Down Mode & Exit Path
If extreme market conditions or a full Mezo redemption causes the master Trove to close:
1. Anyone can trigger `enterWindDown()`.
2. Spend automatically claims any available collateral from Mezo's `CollSurplusPool` and locks the write-down factor.
3. New borrowing is permanently stopped.
4. Users call `claimInWindDown()`:
   - Receives their fair pro-rata share of all recovered BTC.
   - Outstanding user principal debt is completely **forgiven**.
   - Position is closed cleanly.
   - **Guaranteed Outcome:** Zero user funds are permanently trapped.

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
- `repay(address upperHint, address lowerHint)`: Repays MUSD principal + interest, returns pro-rata BTC, and pays down master debt.
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
| `test_BorrowAndRepay_Normal` | 286,457 | Alice borrows 100 MUSD against BTC. Validates buffer distribution, fees, and clean repayment with exact BTC return. |
| `test_ProRataWriteDown_OnRedemption` | 423,405 | Simulates a Mezo redemption taking 20% of master collateral. Proves user claims scale down pro-rata, preventing pool underflow. |
| `test_RecoveryMode_BlocksNewBorrows` | 53,720 | Simulates Mezo entering system-wide Recovery Mode. Verifies that `borrow()` immediately reverts. |
| `test_WindDownExit_WhenMasterTroveClosed` | 244,314 | Simulates master Trove closure by Mezo. Verifies `enterWindDown()`, collateral claim, and `claimInWindDown()` debt forgiveness without reverting. |

---

## 8. Verified Deployments & Network Details

- **Network:** Mezo Testnet (`matsnet`)
- **Chain ID:** `31611`
- **RPC URL:** `https://rpc.test.mezo.org`

### Verified Mezo Protocol Addresses
- **BorrowerOperations:** `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`
- **TroveManager:** `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`
- **PriceFeed:** `0x86bCF0841622a5dAC14A313a15f96A95421b9366`
- **MUSD Token:** `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- **SortedTroves:** `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA`
- **HintHelpers:** `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6`
