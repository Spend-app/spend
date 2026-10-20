# Spend – a small-borrower layer on top of Mezo

## 1. Executive Summary

Mezo’s core borrowing system requires a minimum of ~1,800 MUSD to open a Trove. This is intentional for protocol safety, but it excludes smaller Bitcoin holders who only need $10–$500 of liquidity.

**Spend** is a smart-contract layer built on top of Mezo. Spend is a normal Mezo account that owns one Trove. It opens that Trove once with the protocol minimum, keeps the borrowed MUSD as a cash buffer, and serves small users from that buffer whenever possible.

Users deposit small amounts of BTC into Spend and receive small amounts of MUSD. Spend deposits the BTC into its Trove (increasing collateral) and only creates new debt on Mezo when the cash buffer runs low. This design keeps Spend’s collateral ratio higher for longer and makes liquidation realistic mainly in the event of a significant BTC price crash.

All user BTC still flows into Mezo’s core contracts and increases real TVL.

---

## 2. Core Operating Model – Cash Buffer First

### Initial setup

- Spend opens one Trove on Mezo with enough BTC to borrow the protocol minimum (~2,000 MUSD including gas compensation).
- This MUSD becomes Spend’s initial **cash buffer**.
- The Trove is maintained at a high target collateral ratio (250–300% in normal conditions).

### When a user wants a small amount of MUSD (e.g. $10)

1. User requests the amount.
2. Spend calculates the required BTC at its internal safety ratio (150–180%).
3. User sends that BTC quantity to Spend.
4. Spend deposits the BTC into its Mezo Trove (collateral increases, no new debt is created yet).
5. Spend sends the user MUSD from its existing cash buffer.
6. Spend records the user’s debt (principal + allocated interest share) and the exact BTC quantity contributed.

### When the cash buffer runs low

- Spend sets a refill threshold (example: 500 MUSD).
- When available cash reaches the threshold, Spend increases the debt on its Mezo Trove to refill the buffer.
- Only at this point is new debt created on Mezo.

### When a user repays

1. User returns the MUSD principal + any interest allocated to their position.
2. Spend receives the MUSD.
3. Spend can either:
   - Keep it in the cash buffer for new users, or
   - Use it to partially repay the Mezo Trove (reducing interest cost).
4. Spend returns the original quantity of BTC the user contributed.
5. The user’s record is cleared.

**Key safety property**  
Most of the time, user BTC arrives as pure collateral without a matching immediate debt increase. This systematically improves Spend’s collateral ratio.

---

## 3. Interest, Fees and Revenue Model

### What Mezo charges Spend

- Interest: 1–5% APR (simple, fixed on the Trove)
- Issuance fee: 0.1% when Spend increases debt
- Gas compensation: 200 MUSD (one-time, part of opening the Trove)

### How Spend makes money (transparent and user-friendly)

| Revenue Source                    | How it works                                                                         | Impact on users                     |
| --------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| Interest margin                   | Spend charges users a small margin above Mezo’s rate (e.g. Mezo 3% → Spend 3.5–4%)   | Transparent, still very competitive |
| Small origination fee             | 0.3–0.5% of the borrowed amount (or a tiny flat fee on micro loans)                  | Clear and predictable               |
| Excess from internal liquidations | When a user is liquidated at 130–140%, the surplus collateral becomes protocol-owned | Only affects liquidated positions   |

Spend does **not** rely on liquidations to generate revenue. Healthy users are never penalised.

---

## 4. Risk Management

| Control                   | Target / Rule                    | Purpose                               |
| ------------------------- | -------------------------------- | ------------------------------------- |
| Spend Trove ICR (normal)  | 250–300%                         | Strong buffer                         |
| Spend Trove ICR (warning) | Pause new borrows around 220%    | Stop adding risk                      |
| Spend Trove ICR (floor)   | Aim to stay above ~200%          | Stay far from Mezo’s 110%             |
| Internal user ICR         | Require 150–180%                 | First line of defence                 |
| Internal liquidation      | Liquidate users at 130–140%      | Remove bad positions early            |
| Protocol-owned capital    | Seed + fees + liquidation excess | Real insurance                        |
| Per-user borrow limit     | Hard cap (e.g. $100–$500)        | Keep individual risk small            |
| Cash buffer threshold     | Refill when low                  | Control when new Mezo debt is created |
| Monitoring                | Mezo price feed + alerts         | Operational awareness                 |

### Important clarifications

- Liquidation of Spend’s Trove becomes realistic mainly if BTC price falls significantly. The cash-buffer design, high target ratio, pause rule and internal liquidations all work against this under normal conditions.
- Safety ratios are **targets and operational rules**, not absolute guarantees against extreme market moves.
- Admin can optionally deposit extra BTC to strengthen the buffer, but the system is not dependent on it.

### Internal liquidation settlement (designed path)

When Spend liquidates a user at 130–140%:

1. User’s BTC claim is forfeited and becomes protocol-owned capital.
2. Spend uses protocol-owned MUSD to repay that user’s share of the Mezo debt.
3. The bad position is fully removed from both the internal ledger and the Mezo Trove.

### Redemption risk

Mezo redemptions can reduce both collateral and debt of Spend’s Trove. Spend’s accounting will include a transparent policy (e.g. pro-rata) for allocating the effect across user claims. This is documented as a known risk.

---

## 5. Accounting Model

Spend maintains a clear separation:

| Item                    | Meaning                                                     |
| ----------------------- | ----------------------------------------------------------- |
| User collateral claim   | Original BTC quantity owed back to the user                 |
| User debt               | Outstanding MUSD principal + allocated interest             |
| Actual Mezo Trove state | Real collateral and real debt on Mezo                       |
| Cash buffer             | MUSD held by Spend and available to lend                    |
| Protocol-owned capital  | Capital belonging to Spend (seed, fees, liquidation excess) |
| Losses                  | Any shortfall absorbed by protocol-owned capital            |

---

## 6. Wave 1 Scope (Hackathon Deliverable)

### Must-Have

- Spend’s Trove opened and funded on Mezo Testnet
- Cash buffer logic (serve users from existing MUSD first)
- Users can deposit BTC and receive small MUSD
- Users can repay and receive their original BTC quantity back
- Internal ledger (user debt + BTC quantity + basic interest allocation)
- Basic ICR checks and pause logic
- Clear documentation of the full model, risk rules and revenue approach

### Nice-to-Have

- Simple web UI
- Event emissions
- Demo video of happy path + multi-user flow

### Deferred

- Fully automated internal liquidation settlement
- Production-grade monitoring
- Sophisticated interest allocation engine
- Ecommerce / “Pay with Mezo” features

---

## 7. Summary

Spend is a normal Mezo account that owns one Trove. It opens the Trove once, keeps the MUSD as a cash buffer, and preferentially serves small users from that buffer. User BTC is deposited as collateral and new Mezo debt is created only when needed.

Revenue comes from a transparent interest margin and a small origination fee. Excess from internal liquidations strengthens the protocol buffer. Risk is managed through high target ratios, early internal liquidations, per-user limits, and a cash-buffer-first design that makes liquidation realistic primarily in the event of a significant BTC crash.

Wave 1 delivers a working proof-of-concept on testnet that demonstrates the core model, multi-user flows, and the complete risk and revenue framework.
