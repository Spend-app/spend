import { useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { Check, HandCoins, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CONFIG, MUSD_PRICE, PRICE } from '../data/mock'
import { accruedInterest, icr, useNow } from '../lib/calc'
import { btc, musd, pct, usd } from '../lib/format'
import Balances from '../components/Balances'
import RatioBar from '../components/RatioBar'
import { Badge, Button, Card, EmptyState, Notice, Row, SectionTitle, Stat } from '../components/ui'
import type { Tab } from '../types'

export default function Position({ go }: { go: (t: Tab) => void }) {
  const { connected, connect, position, musdBalance, approved, approve, repay } = useApp()
  const now = useNow(1000)
  const [approving, setApproving] = useState(false)
  const [repaying, setRepaying] = useState(false)

  if (!connected) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Connect your wallet"
        text="Connect to see your balances, your open position and repay."
        action={<Button onClick={connect}>Connect wallet</Button>}
      />
    )
  }

  if (!position) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Your position</h1>
        <Balances />
        <EmptyState
          icon={<HandCoins className="h-5 w-5" />}
          title="No open position"
          text="You have nothing borrowed right now. Start with as little as $10."
          action={<Button onClick={() => go('borrow')}>Borrow MUSD</Button>}
        />
      </div>
    )
  }

  const interest = accruedInterest(position.principal, position.startTime, now, CONFIG.userInterestRate)
  const owed = position.principal + interest
  const ratio = icr(position.btc, PRICE, owed)

  const inZone = ratio <= CONFIG.liquidationStart
  const health =
    ratio >= CONFIG.minUserICR
      ? { tone: 'green' as const, label: 'Healthy' }
      : !inZone
        ? { tone: 'amber' as const, label: 'Watch closely' }
        : { tone: 'red' as const, label: 'At risk' }

  // How far BTC can fall before the ratio reaches the top of the liquidation zone
  const dropPct = Math.max(0, (1 - CONFIG.liquidationStart / ratio) * 100)
  const liqPrice = (PRICE * CONFIG.liquidationStart) / ratio

  const enough = musdBalance >= owed

  const doApprove = async () => {
    setApproving(true)
    try {
      await toast.promise(approve(), {
        loading: 'Approving MUSD…',
        success: 'MUSD approved',
        error: 'Approval failed',
      })
    } finally {
      setApproving(false)
    }
  }

  const doRepay = async () => {
    setRepaying(true)
    try {
      await toast.promise(repay(owed), {
        loading: 'Repaying…',
        success: `Done. ${btc(position.btc)} returned to your wallet`,
        error: 'Repay failed',
      })
    } finally {
      setRepaying(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your position</h1>
        <Badge tone={health.tone}>{health.label}</Badge>
      </div>

      <Balances />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Borrowed" value={musd(position.principal)} sub={`≈ ${usd(position.principal * MUSD_PRICE)}`} />
        <Stat label="Interest so far" value={musd(interest, 6)} sub={`${pct(CONFIG.userInterestRate)} APR, ticking live`} />
        <Stat label="Total owed" value={musd(owed, 4)} sub={`≈ ${usd(owed * MUSD_PRICE)}`} />
        <Stat label="Deposited (BTC locked)" value={btc(position.btc)} sub={`≈ ${usd(position.btc * PRICE)}`} />
        <Stat label="Collateral ratio" value={pct(ratio, 1)} sub={`Minimum ${pct(CONFIG.minUserICR)}`} />
        <Stat label="BTC price" value={usd(PRICE, 0)} />
      </div>

      <Card>
        <SectionTitle title="Distance from liquidation" hint={`Liquidation risk starts around ${CONFIG.liquidationRange}.`} />
        <RatioBar ratio={ratio} />
        <div className="mt-4 divide-y divide-slate-100">
          <Row label="Current ratio" value={pct(ratio, 1)} strong />
          <Row label="BTC can fall about" value={inZone ? 'Already in the zone' : pct(dropPct, 1)} />
          <Row label="Liquidation price (approx.)" value={inZone ? '—' : usd(liqPrice, 0)} />
        </div>
        {inZone && (
          <div className="mt-3">
            <Notice tone="red">Your position is in the liquidation zone. Repay as soon as you can.</Notice>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="Repay" hint="Pay back MUSD and get your exact BTC back." />

        <ol className="space-y-3">
          <Step done={approved} n={1} title="Approve MUSD" text="One-time permission so Spend can take your repayment.">
            {!approved && (
              <Button variant="secondary" loading={approving} onClick={doApprove}>
                Approve
              </Button>
            )}
          </Step>
          <Step done={false} n={2} title="Repay and get your BTC" text={`You pay ${musd(owed, 4)}. You get ${btc(position.btc)} back.`}>
            <Button loading={repaying} disabled={!approved || !enough} onClick={doRepay}>
              Repay
            </Button>
          </Step>
        </ol>

        {!enough && (
          <div className="mt-4">
            <Notice tone="red">
              Your wallet has {musd(musdBalance)}. You need {musd(owed - musdBalance)} more to repay in full.
            </Notice>
          </div>
        )}
      </Card>
    </div>
  )
}

function Step({
  n,
  title,
  text,
  done,
  children,
}: {
  n: number
  title: string
  text: string
  done: boolean
  children?: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 p-3.5">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-soft text-primary'
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-500">{done ? 'Done' : text}</p>
      </div>
      {!done && children}
    </li>
  )
}
