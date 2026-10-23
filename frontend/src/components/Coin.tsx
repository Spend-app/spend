import { Bitcoin } from 'lucide-react'

/** Round token badge: orange for BTC, black for MUSD. */
export default function Coin({ kind, size = 36 }: { kind: 'btc' | 'musd'; size?: number }) {
  const icon = Math.round(size * 0.58)
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${
        kind === 'btc' ? 'bg-btc text-white' : 'bg-ink text-white'
      }`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {kind === 'btc' ? <Bitcoin style={{ width: icon, height: icon }} /> : <span style={{ fontSize: size * 0.5 }}>$</span>}
    </span>
  )
}
