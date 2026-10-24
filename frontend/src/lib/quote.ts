import type { AppConfig } from "../context/AppContext";
import { icr } from "./calc";

/**
 * What a loan of `n` MUSD costs and how safe it is, using the live
 * on-chain config and price. If the price hasn't resolved yet (0), quotes
 * come back as 0 rather than guessing at a market price.
 */
export function quoteFor(n: number, config: AppConfig, price: number) {
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
