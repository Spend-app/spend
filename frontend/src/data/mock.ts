// Static marketing/display constants only.
// All live protocol data (config, master trove, prices, positions) is read
// directly from the Spend contract on Mezo — no dummy fallbacks.

/** USD per BTC (getPrice) */
export const PRICE = 98_420

/** USD value of 1 MUSD. MUSD is a USD-pegged stablecoin, so ~1. Replace with a real quote if you have one. */
export const MUSD_PRICE = 1

/** Product pitch numbers shown on the static landing page (mirrors on-chain defaults). */
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
