import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  Lock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CONFIG, MASTER, PRICE } from '../data/mock'
import { icr } from '../lib/calc'
import { btc, musd, pct, sleep, usd } from '../lib/format'
import { Badge, Button, Card, EmptyState, Row, SectionTitle, Stat } from '../components/ui'

const masterICR = icr(MASTER.collateral, PRICE, MASTER.debt)

export default function Admin() {
  const { connected, connect, paused, setPaused } = useApp()
  const [fees, setFees] = useState(MASTER.grossFees)
  const [addAmount, setAddAmount] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  if (!connected) {
    return (
      <EmptyState
        icon={<Lock className="h-5 w-5" />}
        title="Owner area"
        text="Connect the owner wallet to manage the master trove."
        action={<Button onClick={connect}>Connect wallet</Button>}
      />
    )
  }

  const run = async (key: string, loading: string, success: string, work: () => Promise<void>) => {
    setBusy(key)
    try {
      await toast.promise(work(), { loading, success, error: 'Transaction failed' })
    } finally {
      setBusy(null)
    }
  }

  const health =
    masterICR >= 250
      ? { tone: 'green' as const, label: 'Healthy' }
      : masterICR >= CONFIG.pauseICR
        ? { tone: 'amber' as const, label: 'Watch' }
        : { tone: 'red' as const, label: 'Below pause level' }

  // bar runs from Mezo's 110% minimum to 300%
  const barPct = Math.min(100, Math.max(0, ((masterICR - MASTER.mcr) / (300 - MASTER.mcr)) * 100))
  const pausePos = ((CONFIG.pauseICR - MASTER.mcr) / (300 - MASTER.mcr)) * 100

  const checks = [
    { ok: masterICR >= CONFIG.pauseICR, text: `Master ICR is above ${pct(CONFIG.pauseICR)}`, bad: `Master ICR is below ${pct(CONFIG.pauseICR)}` },
    { ok: !MASTER.recoveryMode, text: 'Mezo is not in recovery mode', bad: 'Mezo is in recovery mode' },
    { ok: MASTER.cashBuffer >= CONFIG.bufferThreshold, text: `Cash buffer is above ${musd(CONFIG.bufferThreshold, 0)}`, bad: 'Cash buffer is low' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <Badge tone={paused ? 'amber' : 'green'}>{paused ? 'Borrowing paused' : 'Borrowing live'}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cash buffer" value={musd(MASTER.cashBuffer, 0)} sub={`Refill below ${musd(CONFIG.bufferThreshold, 0)}`} />
        <Stat label="Collateral" value={btc(MASTER.collateral, 4)} sub={`≈ ${usd(MASTER.collateral * PRICE, 0)}`} />
        <Stat label="Master debt" value={musd(MASTER.debt, 0)} sub={`Mezo rate ${pct(MASTER.mezoRateBps / 100, 1)} fixed`} />
        <Stat label="User principal" value={musd(MASTER.totalUserPrincipal, 0)} sub={`${MASTER.activeBorrowers} active borrowers`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Master trove health" />
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold tabular-nums">{pct(masterICR, 1)}</p>
              <p className="text-xs text-slate-500">Mezo system TCR: {pct(MASTER.tcr)}</p>
            </div>
            <Badge tone={health.tone}>{health.label}</Badge>
          </div>

          <div className="relative mt-5 h-2.5 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary" style={{ width: `${barPct}%` }} />
            <div
              className="absolute -top-1 h-5 w-0.5 bg-amber-500"
              style={{ left: `${pausePos}%` }}
              title={`Pause at ${pct(CONFIG.pauseICR)}`}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
            <span>{pct(MASTER.mcr)} Mezo min</span>
            <span>{pct(CONFIG.pauseICR)} pause</span>
            <span>300%</span>
          </div>

          <div className="mt-5 space-y-2">
            {checks.map((c) => (
              <div key={c.text} className="flex items-center gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={c.ok ? 'text-slate-600' : 'font-medium text-red-700'}>{c.ok ? c.text : c.bad}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Settings" hint="Current values set on the contract." />
          <div className="divide-y divide-slate-100">
            <Row label="Borrow limits" value={`${musd(CONFIG.minBorrow, 0)} – ${musd(CONFIG.maxBorrow, 0)}`} />
            <Row label="Min user ICR" value={pct(CONFIG.minUserICR)} />
            <Row label="Pause ICR" value={pct(CONFIG.pauseICR)} />
            <Row label="Origination fee" value={pct(CONFIG.originationFeeBps / 100, 2)} />
            <Row label="User interest" value={`${pct(CONFIG.userInterestRate)} / year`} />
            <Row label="Buffer threshold" value={musd(CONFIG.bufferThreshold, 0)} />
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Accounting" hint="What users are owed, what Spend holds, and what is real on Mezo." />
        <div className="grid gap-x-10 sm:grid-cols-2">
          <div className="divide-y divide-slate-100">
            <Row label="User BTC claims" value={btc(MASTER.userBtcClaims, 4)} />
            <Row label="User debt (principal + interest)" value={musd(MASTER.totalUserPrincipal + MASTER.userInterest)} />
            <Row label="Cash buffer" value={musd(MASTER.cashBuffer, 0)} />
          </div>
          <div className="divide-y divide-slate-100 border-t border-slate-100 sm:border-t-0">
            <Row label="Mezo trove" value={`${btc(MASTER.collateral, 4)} / ${musd(MASTER.debt, 0)}`} />
            <Row label="Protocol-owned BTC" value={btc(MASTER.collateral - MASTER.userBtcClaims, 4)} />
            <Row label="Protocol-owned MUSD (fees)" value={musd(fees)} />
          </div>
        </div>
        <div className="mt-2 border-t border-slate-100">
          <Row label="Losses absorbed by protocol" value={musd(0)} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Fees" hint="Origination fees and interest collected from users." />
          <div className="flex items-center justify-between rounded-xl bg-primary-soft px-4 py-3">
            <div>
              <p className="text-xs font-medium text-primary">Available to withdraw</p>
              <p className="text-xl font-semibold tabular-nums">{musd(fees)}</p>
            </div>
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-4">
            <Button
              full
              loading={busy === 'fees'}
              disabled={fees <= 0}
              onClick={() =>
                run('fees', 'Withdrawing fees…', `Withdrew ${musd(fees)}`, async () => {
                  await sleep(1200)
                  setFees(0)
                })
              }
            >
              Withdraw fees
            </Button>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Add collateral" hint="Extra BTC lifts the master ICR." />
          <div className="flex gap-2">
            <div className="flex flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-primary focus-within:bg-white">
              <input
                type="number"
                min={0}
                placeholder="0.0000"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="w-full bg-transparent py-2.5 text-sm tabular-nums outline-none"
              />
              <span className="text-xs font-semibold text-slate-500">BTC</span>
            </div>
            <Button
              loading={busy === 'add'}
              disabled={!(Number(addAmount) > 0)}
              onClick={() =>
                run('add', 'Adding collateral…', `Added ${addAmount} BTC`, async () => {
                  await sleep(1200)
                  setAddAmount('')
                })
              }
            >
              Add
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Controls" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            variant="secondary"
            loading={busy === 'pause'}
            onClick={() =>
              run(
                'pause',
                paused ? 'Resuming…' : 'Pausing…',
                paused ? 'Borrowing resumed' : 'Borrowing paused',
                () => setPaused(!paused),
              )
            }
          >
            {paused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
            {paused ? 'Resume borrowing' : 'Pause borrowing'}
          </Button>
          <Button
            variant="secondary"
            loading={busy === 'refi'}
            onClick={() => run('refi', 'Refinancing…', 'Trove refinanced', () => sleep(1200))}
          >
            <RefreshCw className="h-4 w-4" />
            Refinance
          </Button>
          <Button
            variant="secondary"
            loading={busy === 'claim'}
            onClick={() => run('claim', 'Claiming…', 'Surplus collateral claimed', () => sleep(1200))}
          >
            <Wallet className="h-4 w-4" />
            Claim collateral
          </Button>
          <Button variant="danger" disabled title="Only possible when every user has repaid">
            Close trove
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Closing is locked while users still owe {musd(MASTER.totalUserPrincipal, 0)}.
        </p>
      </Card>
    </div>
  )
}
