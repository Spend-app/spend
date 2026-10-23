import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>{children}</div>
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-mute">{hint}</p>}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  full?: boolean
}

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-dark disabled:bg-primary/35',
  secondary: 'border border-line bg-white text-ink hover:bg-soft disabled:text-mute/60 disabled:hover:bg-white',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300 disabled:hover:bg-white',
}

export function Button({ variant = 'primary', loading, full, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
        full ? 'w-full py-3 text-base' : ''
      } ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

type Tone = 'green' | 'amber' | 'red' | 'violet' | 'slate'

const tones: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  violet: 'bg-primary-soft text-primary-dark ring-primary/20',
  slate: 'bg-soft text-mute ring-line',
}

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-soft p-4">
      <p className="text-sm text-mute">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-mute">{sub}</p>}
    </div>
  )
}

export function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-mute">{label}</span>
      <span className={`text-right tabular-nums ${strong ? 'font-semibold text-ink' : 'text-ink'}`}>{value}</span>
    </div>
  )
}

export function Notice({ tone = 'violet', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${tones[tone]}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>{children}</div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <Card className="flex flex-col items-center py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</div>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-mute">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </Card>
  )
}
