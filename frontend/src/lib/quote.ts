import { CONFIG as DEFAULT_CONFIG, PRICE as DEFAULT_PRICE } from "../data/mock";
import type { AppConfig } from "../context/AppContext";
import { icr } from "./calc";

/** What a loan of `n` MUSD costs and how safe it is, using live or default settings. */
export function quoteFor(
  n: number,
  config: AppConfig = DEFAULT_CONFIG,
  price: number = DEFAULT_PRICE,
) {
  // No fake/scaled price: if the live price hasn't resolved yet, quote zeros and
  // let the UI re-render the moment the real price arrives.
  const activePrice = price > 0 ? price : 0;
  const fee = (n * config.originationFeeBps) / 10_000;
  const required =
    n > 0 && activePrice > 0 ? (n * config.minUserICR) / 100 / activePrice : 0;
  const toSend = required * config.priceDriftBuffer;
  const ratio = n > 0 && activePrice > 0 ? icr(toSend, activePrice, n) : 0;
  const dropPct =
    n > 0 && ratio > 0 ? Math.max(0, (1 - config.liquidationStart / ratio) * 100) : 0;
  const liqPrice = ratio > 0 ? (activePrice * config.liquidationStart) / ratio : 0;
  return { fee, receive: n - fee, required, toSend, ratio, dropPct, liqPrice };
}
