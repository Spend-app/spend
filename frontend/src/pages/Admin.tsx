import { useReducer, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, CheckCircle2, Lock, LogOut, Wallet } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CONFIG, MASTER, PRICE } from '../data/mock'
import { icr } from '../lib/calc'
import { btc, musd, num, pct, short, sleep, usd } from '../lib/format'
import { Logo } from '../components/AppShell'
import SafetyBar from '../components/SafetyBar'
import { Badge, Button, Card, EmptyState, Row, SectionTitle, Stat } from '../components/ui'

const FAIL = "That didn't go through. Please try again."

/** Runs a fake transaction with the standard toasts. Errors thrown with a message show that message. */
function tx(success: string, work: () => Promise<void>) {
  return toast.promise(work(), {
    loading: 'Confirm in your wallet…',
    success,
    error: (e) => (e instanceof Error ? e.message : FAIL),
  })
}

/**
 * The admin area is its own screen at #/admin. The borrower app never links to it.
 * Everything here changes the shared dummy data so the borrower screens reflect it.
 * When wiring up the contract, only show the controls if the connected wallet is the owner.
 */
export default function Admin() {
  const { connected, connect, disconnect, address, paused, setPaused } = useApp()
  const [, refresh] = useReducer((x: number) => x + 1, 0)
  const [earnings, setEarnings] = useState(MASTER.grossFees)

  const reserveSafety = icr(MASTER.collateral, PRICE, MASTER.debt)

  const status =
    reserveSafety >= 250
      ? { tone: 'green' as const, label: 'Healthy' }
      : reserveSafety >= CONFIG.pauseICR
        ? { tone: 'amber' as const, label: 'Watch closely' }
        : { tone: 'red' as const, label: 'Too low' }

  const checks = [
    {
      ok: reserveSafety >= CONFIG.pauseICR,
      good: `Reserve safety is above ${pct(CONFIG.pauseICR)}`,
      bad: `Reserve safety is below ${pct(CONFIG.pauseICR)}. New loans should pause.`,
    },
    { ok: !MASTER.recoveryMode, good: 'Mezo is running normally', bad: 'Mezo is under stress right now' },
    {
      ok: MASTER.cashBuffer >= CONFIG.bufferThreshold,
      good: `Cash to lend is above ${musd(CONFIG.bufferThreshold, 0)}`,
      bad: `Cash to lend is below ${musd(CONFIG.bufferThreshold, 0)}. Add more.`,
    },
  ]

  /* ---- actions (dummy: they update the shared numbers) ---- */

  const openReserve = async (bitcoin: number, cash: number) => {
    if (!(bitcoin > 0) || !(cash > 0)) throw new Error('Enter both amounts.')
    if (cash < 2000) throw new Error('Borrow at least 2,000 MUSD to open the reserve.')
    await tx('Reserve opened', async () => {
      await sleep(1200)
      Object.assign(MASTER, { opened: true, collateral: bitcoin, debt: cash + 202, cashBuffer: cash })
    })
    refresh()
  }

  const depositBitcoin = async (n: number) => {
    await tx(`Added ${btc(n, 4)} to the reserve`, async () => {
      await sleep(1000)
      MASTER.collateral += n
    })
    refresh()
  }

  const addCash = async (n: number) => {
    await tx(`${musd(n, 0)} added to cash to lend`, async () => {
      await sleep(1000)
      MASTER.cashBuffer += n
      MASTER.debt += n * 1.001
    })
    refresh()
  }

  const payDown = async (n: number) => {
    await tx(`Paid down ${musd(n, 0)} of borrowing`, async () => {
      await sleep(1000)
      if (n > MASTER.cashBuffer) throw new Error(`You only have ${musd(MASTER.cashBuffer, 0)} to lend.`)
      MASTER.cashBuffer -= n
      MASTER.debt -= n
    })
    refresh()
  }

  const withdrawEarnings = async () => {
    await tx(`Withdrew ${musd(earnings)}`, async () => {
      await sleep(1000)
      setEarnings(0)
    })
  }

  const saveSetting = async (label: string, apply: () => void) => {
    await tx(`${label} updated`, async () => {
      await sleep(900)
      apply()
    })
    refresh()
  }

  const togglePause = async () => {
    await tx(paused ? 'New loans are open again' : 'New loans are paused', () => setPaused(!paused))
  }

  const transferAccess = async (to: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(to.trim())) throw new Error('Enter a valid wallet address.')
    await tx(`Admin access moved to ${short(to.trim())}`, () => sleep(1000))
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#/" className="hidden text-sm font-semibold text-mute hover:text-ink sm:block">
              Go to borrower app
            </a>
            {connected ? (
              <button
                onClick={disconnect}
                className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-soft"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {short(address)}
                <LogOut className="h-4 w-4 text-mute" />
              </button>
            ) : (
              <Button onClick={connect}>
                <Wallet className="h-4 w-4" />
                Connect wallet
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {!connected ? (
          <EmptyState
            icon={<Lock className="h-6 w-6" />}
            title="Admin sign in"
            text="Connect the wallet that manages Spend to continue."
            action={<Button onClick={connect}>Connect wallet</Button>}
          />
        ) : !MASTER.opened ? (
          <div className="mx-auto max-w-lg">
            <SetupCard onOpen={openReserve} />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-xl font-semibold text-ink">Overview</h1>
              <Badge tone={paused ? 'amber' : 'green'}>{paused ? 'New loans paused' : 'New loans open'}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Cash to lend" value={musd(MASTER.cashBuffer, 0)} sub={`Refills below ${musd(CONFIG.bufferThreshold, 0)}`} />
              <Stat label="Bitcoin held" value={btc(MASTER.collateral, 4)} sub={`About ${usd(MASTER.collateral * PRICE, 0)}`} />
              <Stat label="Borrowed from Mezo" value={musd(MASTER.debt, 0)} sub={`${pct(MASTER.mezoRateBps / 100, 1)} a year, fixed`} />
              <Stat label="Owed by users" value={musd(MASTER.totalUserPrincipal, 0)} sub={`${MASTER.activeBorrowers} people with loans`} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <SectionTitle title="Reserve safety" hint="How safe Spend's own Bitcoin reserve is." />
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="font-display text-3xl font-semibold tabular-nums text-ink">{pct(reserveSafety, 1)}</p>
                <div className="mt-2">
                  <SafetyBar
                    ratio={reserveSafety}
                    min={MASTER.mcr}
                    max={300}
                    mark={CONFIG.pauseICR}
                    markLabel={`New loans pause at ${CONFIG.pauseICR}%`}
                  />
                </div>
                <ul className="mt-4 space-y-2">
                  {checks.map((c) => (
                    <li key={c.good} className="flex items-start gap-2 text-sm">
                      {c.ok ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      )}
                      <span className={c.ok ? 'text-ink' : 'font-medium text-red-700'}>{c.ok ? c.good : c.bad}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <SectionTitle title="Where the money is" hint="What users are owed, what Spend holds, and what sits with Mezo." />
                <div className="divide-y divide-line">
                  <Row label="Bitcoin owed back to users" value={btc(MASTER.userBtcClaims, 4)} />
                  <Row label="MUSD owed by users, with interest" value={musd(MASTER.totalUserPrincipal + MASTER.userInterest)} />
                  <Row label="Held at Mezo" value={`${btc(MASTER.collateral, 4)} / ${musd(MASTER.debt, 0)} borrowed`} />
                  <Row label="Spend's own Bitcoin" value={btc(MASTER.collateral - MASTER.userBtcClaims, 4)} />
                  <Row label="Fees earned" value={musd(earnings)} />
                  <Row label="Losses covered by Spend" value={musd(0)} />
                </div>
              </Card>
            </div>

            {/* Money in and out */}
            <div>
              <h2 className="mb-3 font-display text-base font-semibold text-ink">Add or move funds</h2>
              <div className="grid gap-5 md:grid-cols-2">
                <AmountCard
                  title="Deposit Bitcoin"
                  hint="Adds Bitcoin to the reserve. More Bitcoin makes the reserve safer."
                  unit="BTC"
                  button="Deposit"
                  onSubmit={depositBitcoin}
                />
                <AmountCard
                  title="Add to cash to lend"
                  hint="Borrows more MUSD from Mezo so Spend has cash for new loans. Mezo charges 0.1% on this."
                  unit="MUSD"
                  button="Add cash"
                  onSubmit={addCash}
                />
                <AmountCard
                  title="Pay down borrowing"
                  hint="Uses cash to lend to repay some of what Spend owes Mezo. This lowers interest costs."
                  unit="MUSD"
                  button="Pay down"
                  onSubmit={payDown}
                />
                <Card>
                  <SectionTitle title="Earnings" hint="Fees and interest collected from users." />
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-2xl font-semibold tabular-nums text-ink">{musd(earnings)}</p>
                    <Button disabled={earnings <= 0} onClick={withdrawEarnings}>
                      Withdraw
                    </Button>
                  </div>
                </Card>
              </div>
            </div>

            {/* Settings */}
            <Card>
              <SectionTitle title="Loan limits and rates" hint="Change a value and save it. Borrowers see the new value straight away." />
              <div className="divide-y divide-line">
                <SettingRow
                  label="Smallest loan"
                  current={usd(CONFIG.minBorrow, 0)}
                  unit="$"
                  onSave={(n) => {
                    if (n <= 0 || n > CONFIG.maxBorrow) throw new Error('The smallest loan must be above 0 and not more than the largest loan.')
                    return saveSetting('Smallest loan', () => void (CONFIG.minBorrow = n))
                  }}
                />
                <SettingRow
                  label="Largest loan"
                  current={usd(CONFIG.maxBorrow, 0)}
                  unit="$"
                  onSave={(n) => {
                    if (n < CONFIG.minBorrow) throw new Error('The largest loan cannot be below the smallest loan.')
                    return saveSetting('Largest loan', () => void (CONFIG.maxBorrow = n))
                  }}
                />
                <SettingRow
                  label="Refill cash when it falls below"
                  current={musd(CONFIG.bufferThreshold, 0)}
                  unit="MUSD"
                  onSave={(n) => {
                    if (n < 0) throw new Error('Enter 0 or more.')
                    return saveSetting('Refill level', () => void (CONFIG.bufferThreshold = n))
                  }}
                />
                <SettingRow
                  label="Lowest safety level for a new loan"
                  current={pct(CONFIG.minUserICR)}
                  unit="%"
                  onSave={(n) => {
                    if (n < 110) throw new Error('Enter 110 or more.')
                    return saveSetting('Lowest safety level', () => void (CONFIG.minUserICR = n))
                  }}
                />
                <SettingRow
                  label="Pause new loans when reserve safety is below"
                  current={pct(CONFIG.pauseICR)}
                  unit="%"
                  onSave={(n) => {
                    if (n < 110) throw new Error('Enter 110 or more.')
                    return saveSetting('Pause level', () => void (CONFIG.pauseICR = n))
                  }}
                />
                <SettingRow
                  label="Fee on each loan"
                  current={pct(CONFIG.originationFeeBps / 100, 2)}
                  unit="%"
                  onSave={(n) => {
                    if (n < 0 || n > 5) throw new Error('Enter a fee between 0 and 5.')
                    return saveSetting('Fee', () => void (CONFIG.originationFeeBps = Math.round(n * 100)))
                  }}
                />
                <SettingRow
                  label="Interest charged to users, per year"
                  current={pct(CONFIG.userInterestRate)}
                  unit="%"
                  onSave={(n) => {
                    if (n < 0 || n > 50) throw new Error('Enter an interest rate between 0 and 50.')
                    return saveSetting('Interest', () => void (CONFIG.userInterestRate = n))
                  }}
                />
              </div>
            </Card>

            {/* Actions */}
            <Card>
              <SectionTitle title="Other actions" />
              <div className="divide-y divide-line">
                <Action
                  title={paused ? 'Open new loans again' : 'Pause new loans'}
                  text="Stops or restarts new borrowing. People can always repay."
                >
                  <Button variant="secondary" onClick={togglePause}>
                    {paused ? 'Open loans' : 'Pause loans'}
                  </Button>
                </Action>
                <Action title="Update interest rate with Mezo" text="Refreshes the rate and borrowing limit Spend has with Mezo.">
                  <Button variant="secondary" onClick={() => tx('Rate updated', () => sleep(1000))}>
                    Update
                  </Button>
                </Action>
                <Action title="Recover leftover Bitcoin" text="Collects Bitcoin that Mezo set aside for Spend after other people cashed out.">
                  <Button variant="secondary" onClick={() => tx('Bitcoin recovered', () => sleep(1000))}>
                    Recover
                  </Button>
                </Action>
                <TransferAction onTransfer={transferAccess} />
                <Action
                  title="Close the reserve"
                  text={`Only possible once every user has repaid. ${musd(MASTER.totalUserPrincipal, 0)} is still owed.`}
                >
                  <Button variant="danger" disabled>
                    Close
                  </Button>
                </Action>
                <Action title="Take out leftover funds" text="Available after the reserve is closed.">
                  <Button variant="secondary" disabled>
                    Take out
                  </Button>
                </Action>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

/** A small card with one amount box and one button. */
function AmountCard({
  title,
  hint,
  unit,
  button,
  onSubmit,
}: {
  title: string
  hint: string
  unit: string
  button: string
  onSubmit: (n: number) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const n = Number(value)

  const submit = async () => {
    setLoading(true)
    try {
      await onSubmit(n)
      setValue('')
    } catch {
      /* the toast already shows the reason */
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <SectionTitle title={title} hint={hint} />
      <div className="flex gap-2">
        <AmountInput value={value} onChange={setValue} unit={unit} label={title} />
        <Button loading={loading} disabled={!(n > 0)} onClick={submit}>
          {button}
        </Button>
      </div>
    </Card>
  )
}

function AmountInput({
  value,
  onChange,
  unit,
  label,
  placeholder = '0.00',
}: {
  value: string
  onChange: (v: string) => void
  unit: string
  label: string
  placeholder?: string
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-white px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
      <input
        type="number"
        min={0}
        inputMode="decimal"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent py-2.5 text-sm tabular-nums text-ink outline-none placeholder:text-mute/60"
      />
      <span className="pl-2 text-xs font-semibold text-mute">{unit}</span>
    </div>
  )
}

/** One setting: shows the current value, with a box to type a new one and a Save button. */
function SettingRow({
  label,
  current,
  unit,
  onSave,
}: {
  label: string
  current: string
  unit: string
  onSave: (n: number) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  const save = async () => {
    setLoading(true)
    try {
      await onSave(Number(value))
      setValue('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : FAIL)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-mute">Now: {current}</p>
      </div>
      <div className="flex w-full gap-2 sm:w-64">
        <AmountInput value={value} onChange={setValue} unit={unit} label={label} placeholder="New value" />
        <Button variant="secondary" loading={loading} disabled={value.trim() === '' || !Number.isFinite(Number(value))} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  )
}

function Action({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-mute">{text}</p>
      </div>
      {children}
    </div>
  )
}

function TransferAction({ onTransfer }: { onTransfer: (to: string) => Promise<void> }) {
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)

  const go = async () => {
    setLoading(true)
    try {
      await onTransfer(to)
      setTo('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : FAIL)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="py-3">
      <p className="text-sm font-semibold text-ink">Give admin access to another wallet</p>
      <p className="text-sm text-mute">You will lose admin access once it is transferred.</p>
      <div className="mt-2 flex gap-2">
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Wallet address (0x…)"
          aria-label="New admin wallet address"
          className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none placeholder:text-mute/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <Button variant="secondary" loading={loading} disabled={to.trim() === ''} onClick={go}>
          Transfer
        </Button>
      </div>
    </div>
  )
}

/** First-time setup, shown only until the reserve has been opened. */
function SetupCard({ onOpen }: { onOpen: (bitcoin: number, cash: number) => Promise<void> }) {
  const [bitcoin, setBitcoin] = useState('')
  const [cash, setCash] = useState('2000')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      await onOpen(Number(bitcoin), Number(cash))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : FAIL)
    } finally {
      setLoading(false)
    }
  }

  const needed = (Number(cash) * 2.5) / PRICE

  return (
    <Card>
      <SectionTitle
        title="Open the reserve"
        hint="Spend needs to open its reserve on Mezo once. You deposit Bitcoin and borrow MUSD, which becomes the cash Spend lends out."
      />
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-ink">Bitcoin to deposit</label>
          <div className="mt-1.5">
            <AmountInput value={bitcoin} onChange={setBitcoin} unit="BTC" label="Bitcoin to deposit" placeholder="0.0000" />
          </div>
          {Number(cash) > 0 && (
            <p className="mt-1.5 text-xs text-mute">About {num(needed, 4)} BTC keeps the reserve at a safe 250%.</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-ink">MUSD to borrow</label>
          <div className="mt-1.5">
            <AmountInput value={cash} onChange={setCash} unit="MUSD" label="MUSD to borrow" />
          </div>
          <p className="mt-1.5 text-xs text-mute">At least 2,000 MUSD.</p>
        </div>
        <Button full loading={loading} disabled={!(Number(bitcoin) > 0)} onClick={submit}>
          Open reserve
        </Button>
      </div>
    </Card>
  )
}
