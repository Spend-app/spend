# Spend: Contract Verification & Security Invariants

This document details the exact build configuration, verification parameters, and core security invariants of the Spend smart contract deployed on the Mezo testnet.

---

## 1. Verified Contract Details

* **Contract Address**: [`0xdADB2C17199E2247C3FB65E75F62Db6bAFc4b7a0`](https://explorer.test.mezo.org/address/0xdADB2C17199E2247C3FB65E75F62Db6bAFc4b7a0)
* **Contract Name**: `Spend`
* **Explorer Status**: Verified (Full Source Code & ABI published)
* **Network**: Mezo Testnet (Chain ID: `31611`)
* **Source Path**: `contract/src/Spend.sol`

---

## 2. Compiler & Build Configuration

The contract is compiled using Foundry with the following parameters:

* **Compiler Version**: `v0.8.24+commit.e11b9ed9`
* **Optimization**: Enabled (`true`)
* **Optimization Runs**: `200`
* **via-IR Codegen**: `true`
* **EVM Version**: Default / Cancun

### Reproducing the Build Locally
To compile the contract locally with the exact same bytecode:

```bash
cd contract
forge build --via-ir
```

---

## 3. Constructor Arguments

Spend connects directly to Mezo's canonical protocol deployments on testnet:

### Decoded Parameters
1. `_borrowerOperations` (address): `0xcdf7028ceab81fa0c6971208e83fa7872994bee5`
2. `_troveManager` (address): `0xe47c80e8c23f6b4a1ae41c34837a0599d5d16bb0`
3. `_priceFeed` (address): `0x86bcf0841622a5dac14a313a15f96a95421b9366`
4. `_musd` (address): `0x118917a40faf1cd7a13db0ef56c86de7973ac503`

### Raw ABI-Encoded Hex
```text
000000000000000000000000cdf7028ceab81fa0c6971208e83fa7872994bee5000000000000000000000000e47c80e8c23f6b4a1ae41c34837a0599d5d16bb000000000000000000000000086bcf0841622a5dac14a313a15f96a95421b9366000000000000000000000000118917a40faf1cd7a13db0ef56c86de7973ac503
```

---

## 4. Architectural & Security Invariants

Spend is engineered with explicit safety mechanisms to ensure user funds and protocol solvency remain protected even under market volatility and protocol stress.

### Invariant 1: Master Debt Floor (1,810 MUSD)
Mezo enforces a minimum net debt of 1,800 MUSD (`minNetDebt`). If a vault tries to repay below this threshold, Mezo reverts the entire transaction.
* Spend enforces an internal safe floor: `minNetDebt + 10e18` (1,810 MUSD).
* When users repay, excess MUSD is used to pay down Mezo master debt, but the contract strictly stops paydowns at 1,810 MUSD. This guarantees transactions never revert due to debt boundary limits and keeps the master Trove healthy.

### Invariant 2: Internal Collateral Retention on Liquidation
Unlike protocols that pay out high liquidation bonuses (which bleed collateral out of the system), Spend liquidates positions falling below 130% ICR and retains 100% of the collateral inside the master Trove.
* Because the position is closed at ~130% ICR, there is roughly $1.30 of BTC collateral remaining for every $1.00 of written-off user debt.
* This excess collateral strengthens the master Trove's ICR, benefiting all remaining depositors and safeguarding the pool.

### Invariant 3: Pro-Rata Write-Down & Redemption Shield
If Mezo processes an external redemption that draws down the master Trove collateral:
* Spend tracks a monotonic global `writeDownFactor`.
* Any reduction in collateral is distributed proportionally across all user claims rather than allowing early withdrawers to drain 100% of the collateral and leave late withdrawers empty-handed.
* This prevents run-on-the-bank exploits during high redemption activity.

### Invariant 4: Instant Wind-Down with Full Debt Forgiveness
If Mezo's protocol triggers a liquidation or redemption of the master Trove, Spend enters wind-down mode:
* Any surplus BTC in Mezo's `CollSurplusPool` is immediately claimed via `claimCollateral()`.
* All outstanding user debt is completely forgiven: no user owes MUSD to exit.
* Users can withdraw their pro-rata share of remaining BTC immediately without any mandatory lockup or delay.

### Invariant 5: Reentrancy & Access Isolation
* All state-changing functions (`borrow`, `repay`, `liquidateUser`, `claimInWindDown`) are protected with `nonReentrant`.
* Privileged administrative functions (`refinanceMasterDebt`, `addCollateral`) are strictly gated by `onlyOwner`.
* The keeper liquidation method `liquidateUser()` is completely permissionless, allowing anyone or any automated keeper to maintain system health without special privileges.
