import { LIQUIDATION_START } from '../data/static'

interface Props {
  /** Current safety level in % (for example 152) */
  ratio: number
  min?: number
  max?: number
  /** The line where things become risky */
  mark?: number
  markLabel?: string
}

/**
 * One-colour progress bar. The purple fill grows as the level gets safer.
 * The thin dark line is the point where it becomes risky.
 */
export default function SafetyBar({
  ratio,
  min = 120,
  max = 200,
  mark = LIQUIDATION_START,
  markLabel = `Risky below ${LIQUIDATION_START}%`,
}: Props) {
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`

  return (
    <div>
      <div className="relative h-8">
        <span
          className="absolute bottom-2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-ink"
          style={{ left: at(mark) }}
        >
          {markLabel}
        </span>
      </div>

      <div className="relative h-3 rounded-full bg-line">
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: at(ratio) }} />
        <span className="absolute -top-1 h-5 w-0.5 -translate-x-1/2 bg-ink" style={{ left: at(mark) }} />
        <span
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-primary bg-white shadow"
          style={{ left: at(ratio) }}
          role="img"
          aria-label={`Safety level ${ratio.toFixed(1)}%`}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs text-mute">
        <span>Riskier</span>
        <span>Safer</span>
      </div>
    </div>
  )
}
