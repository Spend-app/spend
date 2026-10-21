import { useEffect, useState } from 'react'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** Simple (non-compounding) interest, accrued per second like the contract. */
export function accruedInterest(
  principal: number,
  startTime: number,
  now: number,
  ratePct: number,
) {
  return (principal * (ratePct / 100) * Math.max(0, now - startTime)) / YEAR_MS
}

/** Collateral ratio in % */
export function icr(btc: number, price: number, debt: number) {
  if (debt <= 0) return 0
  return ((btc * price) / debt) * 100
}

/** Re-renders every `ms` and returns Date.now() */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
