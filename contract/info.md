### Live deployment status (verified 2026-10-25 via RPC `https://rpc.test.mezo.org`, chainId 31611)

Spend contract `0xD4f45a4A2B0EF9B64b2dA17c8287F5B429b00513` **answered every view call**:

| Call                         | Live value                                 |
| ---------------------------- | ------------------------------------------ |
| `masterOpened()`             | `true` — Master Trove is open              |
| `paused()`                   | `false` — borrowing is open                |
| `getPrice()`                 | 80,383.63 USD/BTC (oracle)                 |
| `getCashBuffer()`            | 1,740.30 MUSD funded                       |
| `getMasterICR()`             | 285.6% (in 250–300% target zone)           |
| `getMasterInterestRateBps()` | 100 bps (1.00% fixed)                      |
| `minBorrow` / `maxBorrow`    | 10 / 500 MUSD                              |
| `userInterestRate`           | 4.00% (simple, 1e16)                       |
| `originationFeeBps`          | 30 (0.30%)                                 |
| `bufferThreshold`            | 500 MUSD                                   |
| `totalUserPrincipal`         | 60 MUSD in active user loans               |
| `owner()`                    | 0xb43c9f0f2bb65a37761e7867a6f1903799f45d65 |

---

# 1. Everything inside the file & what each part is used for

### A. Verified protocol header (lines 1–47)

One place that documents every assumption you can now trust: the 7 verified Mezo addresses, live protocol values (min debt 1,800, gas comp 200, 0.1% fee, 1% fixed rate), the unit conventions (1e18 for money/price/ICR, 1e20 for NICR), and the three integration rules (approve-unlimited, burn-not-transfer for master repayment, hint pipeline).

### B. Interfaces (lines 48–135) — "everything Spend needs to call Mezo from inside itself"

| Interface                        | Functions it exposes & why                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `IBorrowerOperations`            | All 9 mutators Spend can legally call: `openTrove`, `addColl`, `withdrawColl`, `withdrawMUSD`, `repayMUSD`, `adjustTrove`, `closeTrove`, **`refinance`** (rate/cap refresh), **`claimCollateral`** (recover redemption surplus). Plus 6 views for monitoring: `getBorrowingFee`, `minNetDebt`, `borrowingRate`, `MUSD_GAS_COMPENSATION`, `MCR`, `CCR`. |
| `ITroveManager`                  | ICR/TCR/recovery-mode reads + full trove state: `getCurrentICR`, `getTCR`, `checkRecoveryMode`, `getEntireDebtAndColl`, `getTroveColl/Principal/InterestOwed/InterestRate/LastInterestUpdateTime/MaxBorrowingCapacity/Status`, `getNominalICR`, owner-array views.                                                                                     |
| `IPriceFeed`                     | `fetchPrice()` → USD/BTC @1e18.                                                                                                                                                                                                                                                                                                                        |
| `IInterestRateManager`           | `interestRate()` → uint16 bps (the fixed rate applied at open).                                                                                                                                                                                                                                                                                        |
| `IHintHelpers` + `ISortedTroves` | `getApproxHint` / `findInsertPosition` / `validInsertPosition` — the hint pipeline the app uses for every trove call.                                                                                                                                                                                                                                  |
| `IMUSD`                          | ERC-20 core + **`allowance`/`permit`/`nonces`/`DOMAIN_SEPARATOR`** — enables the approve flow and the optional gasless-repay relay.                                                                                                                                                                                                                    |

### C. Contract state (lines 136–176)

- **Mezo refs** (immutable): `borrowerOperations`, `troveManager`, `priceFeed`, `musd`.
- **Admin**: `owner`, `paused`, `masterOpened` (new guard).
- **Limits & fees**: `minUserICR` (150%), `pauseICR` (220%), `minBorrow`/`maxBorrow`, `bufferThreshold`, `originationFeeBps` (0.30%), `userInterestRate` (4% simple).
- **User ledger**: `positions[user]` (exact BTC deposited, principal, start time), `totalUserPrincipal`, `grossFees` (fees owed to owner), `masterOpenedRateBps`.

### D. Events + modifiers (177–194)

All original events plus `MasterDebtIncreased/Decreased`, `MasterTroveRefinanced`, `MasterCollateralClaimed`. `onlyOwner` + `nonReentrant` (guards `borrow`/`repay`).

### E. Constructor (195–212)

Takes the 4 verified addresses; validates non-zero + MUSD 18 decimals; caller becomes owner.

### F. Owner: Master Trove lifecycle (213–327)

| Function                                           | Purpose                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `openMasterTrove`                                  | Open once: sends BTC, mints buffer MUSD, records fixed rate.                         |
| `addCollateral`                                    | Extra BTC into the trove (strengthens ICR).                                          |
| `increaseMasterDebt` / `decreaseMasterDebt`        | Owner-only debt top-up / pay-down (pay-down **burns** buffer MUSD — no approve).     |
| `refinanceMasterDebt`                              | Refresh fixed rate + stale `maxBorrowingCapacity`.                                   |
| `claimMasterCollateral`                            | Recover BTC stranded in CollSurplusPool by redemptions.                              |
| `closeMasterTrove` / `extractMUSD` / `withdrawBTC` | Teardown: requires `totalUserPrincipal == 0`; extra MUSD/BTC extraction after close. |

### G. Owner parameters (328–379)

Bounded setters for pause, ICRs, limits, threshold, fees, rate, ownership + `withdrawFees` (buffer + ICR-guarded fee payout while live).

### H. Core: `borrow()` (380–430)

The heart. Checks pause → master opened → amount in range → no existing position → master ICR ≥ 220%. Computes required BTC at user's 150% ICR, deposits _all_ sent BTC into the Mezo trove, **refills the buffer only if it would drop below `bufferThreshold`** (verified: Mezo mints exactly what you request on `adjustTrove` debt increase), pays the user MUSD, books the fee.

### I. Core: `repay()` (431–460)

Pulls `principal + interest` via `transferFrom` (user must have approved — see frontend), credits interest to `grossFees`, withdraws the user's exact BTC quantity from the trove and sends it back. Works even while paused. Never reduces master debt.

### J. Views (461–541)

Everything the app/dashboard needs: `getMasterICR`, `getMasterTCR`, `isRecoveryMode`, `getCashBuffer`, `getPrice`, **`getRequiredBTC`**, `getMasterTroveState`, `getMasterInterestRateBps`, `getMasterBorrowingFee`, `getMasterMinNetDebt`, `getUserPosition`, **`getTotalOwed`**, `getUserICR`.

### K. Internals (542–552)

`_getCurrentMasterRate`, `_accruedInterest` (4% simple), `receive()`.

---

# 2. The Result

Deploy → **owner opens the master trove** (send ~0.025 BTC + request 2,000 MUSD → buffer seeded, composite debt ≈ 2,000 + 2 fee + 200 gas comp, ICR ≈ 250%). Then:

1. **User borrows $100** → app quotes BTC via `getRequiredBTC` (~0.00018 BTC) +1% → user sends BTC → contract deposits it into Mezo's trove → pays user ~99.70 MUSD → books 0.30 MUSD fee. If the buffer is below `bufferThreshold`, it mints new Mezo debt (only then!). Result: **user gets MUSD, Mezo TVL grows, Spend's ICR stays high.**
2. **User repays** → sends back ~100 MUSD + accrued interest (needs the one-time approve) → receives their exact BTC back → MUSD lands in the buffer for the next user. Result: **the exact-BTC-return promise holds, buffer never empties.**
3. **Owner economics** → collects 0.30% origination + 4% user interest; pays Mezo its **fixed 1%** (rate captured at open). Net margin ≈ 3%+ per year on user principal.
4. **Teardown** → all users repaid → owner burns master debt, closes trove, extracts BTC/MUSD.

Verified on-chain facts that make it work: buffer refill mints exactly the requested MUSD; `repayMUSD` burns (no approvals needed); `borrow`/`repay` are atomic (any Mezo revert returns the user's BTC).
