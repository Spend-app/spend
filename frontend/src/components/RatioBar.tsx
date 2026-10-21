import { CONFIG } from '../data/mock'

const MIN = 120
const MAX = 200

const at = (v: number) => `${Math.min(100, Math.max(0, ((v - MIN) / (MAX - MIN)) * 100))}%`

/**
 * Collateral ratio gauge. Red = liquidation zone, amber = close to it, green = safe.
 * The dot is the user's current ratio.
 */
export default function RatioBar({ ratio }: { ratio: number }) {
  const liq = CONFIG.liquidationStart
  const min = CONFIG.minUserICR

  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full">
        <div className="absolute inset-y-0 bg-red-400" style={{ left: 0, width: at(liq) }} />
        <div className="absolute inset-y-0 bg-amber-400" style={{ left: at(liq), width: `calc(${at(min)} - ${at(liq)})` }} />
        <div className="absolute inset-y-0 bg-emerald-400" style={{ left: at(min), right: 0 }} />
      </div>

      <div className="relative -mt-[1.15rem] h-5">
        <span
          className="absolute top-0 h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-white bg-slate-900 shadow"
          style={{ left: at(ratio) }}
          aria-label={`Current ratio ${ratio.toFixed(1)}%`}
        />
      </div>

      <div className="relative mt-2 h-4 text-[11px] text-slate-400">
        <span className="absolute -translate-x-1/2" style={{ left: at(liq) }}>
          {liq}%
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: at(min) }}>
          {min}%
        </span>
      </div>

      <div className="mt-1 flex justify-between text-[11px] font-medium">
        <span className="text-red-600">Liquidation</span>
        <span className="text-amber-600">Close</span>
        <span className="text-emerald-600">Safe</span>
      </div>
    </div>
  )
}
