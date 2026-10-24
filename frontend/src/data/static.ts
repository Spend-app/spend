// Genuinely static client constants.
// There is no mock/demo data here: every live protocol value (config, master
// trove, prices, positions) is read from the Spend contract on Mezo, and the
// MUSD price is fetched live from CoinGecko (see ../lib/musdPrice.ts).

/** Quote margin over the oracle price to absorb block-to-block BTC drift (+1%). */
export const PRICE_DRIFT_BUFFER = 1.01;

/** Internal-liquidation zone, from the proposal (no on-chain getter exists). */
export const LIQUIDATION_RANGE = "130–140%";

/** Top of the internal-liquidation warning zone, in % – used as the safety-bar mark. */
export const LIQUIDATION_START = 140;
