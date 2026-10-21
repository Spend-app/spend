// Dummy values only. Replace with contract reads later.
// Names mirror the getters in the Spend ABI so wiring up is easy.

export const NETWORK = {
  name: 'Mezo Testnet',
  chainId: 31611,
  explorer: 'https://explorer.test.mezo.org',
}

export const DEMO_ADDRESS = '0x7A3fC2d9E14b8a60F5c1e0B92d4a7c6E3f81c91D'

/** USD per BTC (getPrice) */
export const PRICE = 98_420

/** USD value of 1 MUSD. MUSD is a USD-pegged stablecoin, so ~1. Replace with a real quote if you have one. */
export const MUSD_PRICE = 1

/** Auto-getters on the contract */
export const CONFIG = {
  minBorrow: 10,
  maxBorrow: 500,
  minUserICR: 150, // %
  pauseICR: 220, // %
  originationFeeBps: 30, // 0.30%
  userInterestRate: 4, // % APR, simple
  bufferThreshold: 500, // MUSD
  priceDriftBuffer: 1.01, // quote + 1%
  liquidationRange: '130–140%', // internal liquidation zone (from the proposal)
  liquidationStart: 140, // % - top of that zone, used as the conservative warning line
}

/** Spend's master trove on Mezo */
export const MASTER = {
  collateral: 0.062, // BTC
  debt: 2202, // MUSD (principal + fee + gas comp)
  cashBuffer: 1640, // MUSD
  tcr: 312, // %
  mezoRateBps: 100, // 1%
  recoveryMode: false,
  totalUserPrincipal: 360, // MUSD
  userInterest: 1.14, // MUSD accrued across users
  userBtcClaims: 0.0055, // BTC owed back to users
  grossFees: 4.82, // MUSD
  activeBorrowers: 7,
  mcr: 110,
}

export const DEMO_WALLET = {
  musd: 250,
  btc: 0.0123,
}
