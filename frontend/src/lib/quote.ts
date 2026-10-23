import { CONFIG, PRICE } from '../data/mock'
import { icr } from './calc'

/** What a loan of `n` MUSD costs and how safe it is, using the dummy settings. */
export function quoteFor(n: number) {
  const fee = (n * CONFIG.originationFeeBps) / 10_000
  const required = (n * CONFIG.minUserICR) / 100 / PRICE
  const toSend = required * CONFIG.priceDriftBuffer
  const ratio = n > 0 ? icr(toSend, PRICE, n) : 0
  const dropPct = n > 0 ? Math.max(0, (1 - CONFIG.liquidationStart / ratio) * 100) : 0
  const liqPrice = n > 0 ? (PRICE * CONFIG.liquidationStart) / ratio : 0
  return { fee, receive: n - fee, required, toSend, ratio, dropPct, liqPrice }
}
