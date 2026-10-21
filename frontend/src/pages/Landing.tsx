import type { ReactNode } from 'react'
import {
  ArrowRight,
  Bitcoin,
  ChevronDown,
  HandCoins,
  Landmark,
  Layers,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { CONFIG, PRICE } from '../data/mock'
import { btc, musd, pct, usd } from '../lib/format'
import { Button } from '../components/ui'
import type { Tab } from '../types'

export default function Landing({ go }: { go: (t: Tab) => void }) {
  // Worked example so the numbers on this page match the Borrow screen
  const example = 100
  const exampleFee = (example * CONFIG.originationFeeBps) / 10_000
  const exampleBtc = ((example * CONFIG.minUserICR) / 100 / PRICE) * CONFIG.priceDriftBuffer

  return (
    <div className="-mt-8 sm:-mt-12">
      {/* Hero */}
      <section className="mx-auto max-w-3xl pt-14 text-center sm:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary-line bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          <Layers className="h-3.5 w-3.5" />
          Built on Mezo · Testnet
        </span>
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Small loans against your <span className="text-primary">Bitcoin</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-slate-600 sm:text-lg">
          Need {usd(CONFIG.minBorrow, 0)} or {usd(CONFIG.maxBorrow, 0)}, not thousands? Lock a little BTC, get MUSD
          right away, and get your exact BTC back when you repay.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={() => go('borrow')} className="px-6 py-3 text-base">
            Launch app
            <ArrowRight className="h-4 w-4" />
          </Button>
          <a
            href="#how"
            className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
          >
            How it works
          </a>
        </div>
      </section>

      {/* Numbers strip */}
      <section className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
        <Fact value={usd(CONFIG.minBorrow, 0)} label="Smallest loan" />
        <Fact value={pct(CONFIG.userInterestRate)} label="Interest per year" />
        <Fact value={pct(CONFIG.originationFeeBps / 100, 2)} label="One-time fee" />
        <Fact value={pct(CONFIG.minUserICR)} label="Minimum collateral" />
      </section>

      {/* The problem */}
      <section className="mx-auto mt-20 grid max-w-4xl items-center gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Borrowing on Mezo starts big</h2>
          <p className="mt-3 text-slate-600">
            Opening your own trove on Mezo needs a minimum of about 1,800 MUSD. That keeps the protocol safe, but it
            leaves out people who only want a small amount of cash.
          </p>
          <p className="mt-3 text-slate-600">
            Spend fixes that. It keeps one trove on Mezo and lends from its MUSD cash buffer, so you can borrow a little
            without opening a trove of your own.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Example: borrow {usd(example, 0)}</p>
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            <ExampleRow label="You send" value={btc(exampleBtc)} />
            <ExampleRow label="You receive" value={musd(example - exampleFee)} />
            <ExampleRow label="Fee" value={musd(exampleFee)} />
            <ExampleRow label="Interest" value={`${pct(CONFIG.userInterestRate)} / year`} />
            <ExampleRow label="When you repay" value="Your exact BTC comes back" />
          </dl>
          <p className="mt-3 text-xs text-slate-400">Based on a demo BTC price of {usd(PRICE, 0)}.</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto mt-20 max-w-4xl scroll-mt-24">
        <h2 className="text-center text-2xl font-bold tracking-tight">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Step n={1} icon={<Wallet className="h-5 w-5" />} title="Pick an amount">
            Choose how much MUSD you want. We show exactly how much BTC to send and what it costs.
          </Step>
          <Step n={2} icon={<Bitcoin className="h-5 w-5" />} title="Send BTC, get MUSD">
            Your BTC goes into Spend's trove on Mezo as collateral. The MUSD reaches your wallet in the same
            transaction.
          </Step>
          <Step n={3} icon={<RotateCcw className="h-5 w-5" />} title="Repay, get your BTC">
            Pay back the MUSD plus interest at any time and the same amount of BTC you sent returns to you.
          </Step>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto mt-20 max-w-4xl">
        <h2 className="text-center text-2xl font-bold tracking-tight">Why Spend</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Feature icon={<HandCoins className="h-5 w-5" />} title="Made for small amounts">
            Borrow from {usd(CONFIG.minBorrow, 0)} up to {usd(CONFIG.maxBorrow, 0)}. No 1,800 MUSD minimum for you.
          </Feature>
          <Feature icon={<Landmark className="h-5 w-5" />} title="Your BTC stays in Mezo">
            Every deposit lands in Mezo's own contracts, so your collateral adds to Mezo's real TVL.
          </Feature>
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Safety built in">
            You borrow at {pct(CONFIG.minUserICR)} collateral or more. Spend also pauses new loans if its own trove
            gets too thin.
          </Feature>
          <Feature icon={<RotateCcw className="h-5 w-5" />} title="Simple, clear costs">
            One {pct(CONFIG.originationFeeBps / 100, 2)} fee and {pct(CONFIG.userInterestRate)} simple interest. You see
            both before you confirm.
          </Feature>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-20 max-w-2xl">
        <h2 className="text-center text-2xl font-bold tracking-tight">Questions</h2>
        <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          <Faq q="Do I get my own BTC back?">
            Yes. Spend records the exact amount of BTC you sent and returns that amount when you repay in full.
          </Faq>
          <Faq q="Can I lose my collateral?">
            If BTC drops and your collateral ratio falls to around {CONFIG.liquidationRange}, Spend can liquidate your
            position. Your BTC is then forfeited to cover the debt, so you don't get it back. Watch your ratio on the
            Position page. Safety ratios are targets, not guarantees against big market moves.
          </Faq>
          <Faq q="What are redemptions?">
            Mezo can redeem against troves, which can reduce both the collateral and the debt of Spend's trove. Spend
            plans to share the effect across users in a transparent way (for example pro-rata). It's a known risk.
          </Faq>
          <Faq q="How many loans can I have?">
            One open position per wallet, between {usd(CONFIG.minBorrow, 0)} and {usd(CONFIG.maxBorrow, 0)}.
          </Faq>
          <Faq q="Why do I need to approve MUSD?">
            Repaying moves MUSD from your wallet to Spend. The approval is a one-time permission for that.
          </Faq>
          <Faq q="Is this live?">
            Not yet. Spend runs on Mezo Testnet, so it uses test funds only.
          </Faq>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-20 max-w-3xl rounded-3xl bg-primary px-6 py-12 text-center text-white">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to try it?</h2>
        <p className="mx-auto mt-2 max-w-md text-primary-line">Connect a wallet and borrow your first few dollars on testnet.</p>
        <button
          onClick={() => go('borrow')}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-primary hover:bg-primary-soft"
        >
          Launch app
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </div>
  )
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white px-4 py-5 text-center">
      <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  )
}

function ExampleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-slate-800">{value}</dd>
    </div>
  )
}

function Step({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>
        <span className="text-sm font-semibold text-slate-300">0{n}</span>
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-600">{children}</p>
    </div>
  )
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{children}</p>
      </div>
    </div>
  )
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-sm text-slate-600">{children}</p>
    </details>
  )
}
