import { CONFIG as DEFAULT_CONFIG, PRICE as DEFAULT_PRICE } from "../data/mock";
import type { AppConfig } from "../context/AppContext";
import { icr } from "./calc";

/** What a loan of `n` MUSD costs and how safe it is, using live or default settings. */
export function quoteFor(
  n: number,
  config: AppConfig = DEFAULT_CONFIG,
  price: number = DEFAULT_PRICE,
) {
  const activePrice = price > 0 ? price : DEFAULT_PRICE;
  const fee = (n * config.originationFeeBps) / 10_000;
  const required = (n * config.minUserICR) / 100 / activePrice;
  const toSend = required * config.priceDriftBuffer;
  const ratio = n > 0 ? icr(toSend, activePrice, n) : 0;
  const dropPct =
    n > 0 ? Math.max(0, (1 - config.liquidationStart / ratio) * 100) : 0;
  const liqPrice = n > 0 ? (activePrice * config.liquidationStart) / ratio : 0;
  return { fee, receive: n - fee, required, toSend, ratio, dropPct, liqPrice };
}
