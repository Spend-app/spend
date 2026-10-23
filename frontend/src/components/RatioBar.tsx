import { CONFIG } from '../data/mock'

const MIN = 120
const MAX = 200

const at = (v: number) => `${Math.min(100, Math.max(0, ((v - MIN) / (MAX - MIN)) * 100))}%`

/**
 * Collateral ratio gauge. Coral = liquidation zone, amber = close to it, mint = safe.
 * The white dot is the current ratio.
 */
export default function RatioBar({ ratio }: { ratio: number }) {
  const liq = CONFIG.liquidationStart
  const min = CONFIG.minUserICR

  return (
    <div>
      <div className="relative h-3 rounded-full bg-white/5">
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-coral/80" style={{ width: at(liq) }} />
        <div className="absolute inset-y-0 bg-btc/80" style={{ left: at(liq), width: `calc(${at(min)} - ${at(liq)})` }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-mint/80" style={{ left: at(min) }} />
        <span
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-night-800 bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.6)]"
          style={{ left: at(ratio) }}
          role="img"
          aria-label={`Current ratio ${ratio.toFixed(1)}%`}
        />
      </div>

      <div className="relative mt-3 h-4 text-xs text-mute">
        <span className="absolute -translate-x-1/2" style={{ left: at(liq) }}>
          {liq}%
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: at(min) }}>
          {min}%
        </span>
      </div>

      <div className="mt-1 flex justify-between text-xs font-semibold">
        <span className="text-coral">Liquidation</span>
        <span className="text-btc">Close</span>
        <span className="text-mint">Safe</span>
      </div>
    </div>
  )
}
