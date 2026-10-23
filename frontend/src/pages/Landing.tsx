import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDown,
  Check,
  ChevronDown,
  HandCoins,
  Landmark,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { CONFIG, PRICE } from "../data/mock";
import { quoteFor } from "../lib/quote";
import { btc, musd, num, pct, usd } from "../lib/format";
import { Logo } from "../components/AppShell";
import Coin from "../components/Coin";
import { Button } from "../components/ui";
import type { Tab } from "../types";

export default function Landing({ go }: { go: (t: Tab) => void }) {
  const sample = quoteFor(100);
  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-5">
          <a
            href="#how"
            className="hidden text-sm font-semibold text-mute hover:text-white sm:block"
          >
            How it works
          </a>
          <a
            href="#faq"
            className="hidden text-sm font-semibold text-mute hover:text-white sm:block"
          >
            Questions
          </a>
          <Button onClick={() => go("dashboard")}>Open the app</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div>
          <h1 className="font-display text-5xl font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Get cash from your Bitcoin without selling it
          </h1>
          <p className="mt-6 max-w-lg text-lg text-mist/80">
            Lock a little BTC, get MUSD right away, and get the same BTC back
            when you repay. Loans start at {usd(CONFIG.minBorrow, 0)}.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              className="px-6 py-3.5 text-base"
              onClick={() => go("dashboard")}
            >
              Open the app
            </Button>
            <a
              href="#how"
              className="rounded-xl border border-white/10 px-6 py-3.5 text-base font-semibold text-mist hover:bg-white/5"
            >
              See how it works
            </a>
          </div>
          <ul className="mt-9 space-y-2.5 text-mist/90">
            {[
              `Borrow ${usd(CONFIG.minBorrow, 0)} to ${usd(CONFIG.maxBorrow, 0)}, no big minimum`,
              `${pct(CONFIG.userInterestRate)} simple interest and a ${pct(CONFIG.originationFeeBps / 100, 2)} one-time fee`,
              "Repay any time and get your exact BTC back",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint/15 text-mint">
                  <Check className="h-3 w-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <TryIt onOpen={() => go("dashboard")} />
      </section>

      {/* How it works */}
      <section
        id="how"
        className="scroll-mt-8 border-y border-white/10 bg-night-950/60 py-20"
      >
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="max-w-xl font-display text-4xl font-semibold tracking-tight text-white">
            Three steps, and your Bitcoin stays yours
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            <Step n={1} title="Pick an amount">
              Choose how much MUSD you need. You see exactly how much BTC to
              lock and what it costs before you confirm.
            </Step>
            <Step n={2} title="Lock BTC, get MUSD">
              Your BTC goes into Spend's trove on Mezo as collateral. The MUSD
              lands in your wallet in the same transaction.
            </Step>
            <Step n={3} title="Repay, get your BTC">
              Pay back the MUSD plus interest whenever you want. The same amount
              of BTC you locked comes back to you.
            </Step>
          </ol>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-4xl font-semibold tracking-tight text-white">
              Borrowing on Mezo starts big. Spend starts small.
            </h2>
            <p className="mt-5 text-mist/80">
              Opening your own trove on Mezo needs about 1,800 MUSD. Spend keeps
              one trove and lends from its MUSD cash buffer, so you can borrow a
              little without opening one yourself.
            </p>
          </div>
          <dl className="grid gap-x-10 sm:grid-cols-2">
            <Feature
              icon={<HandCoins className="h-5 w-5" />}
              title="Made for small amounts"
            >
              {usd(CONFIG.minBorrow, 0)} up to {usd(CONFIG.maxBorrow, 0)}. No
              1,800 MUSD minimum for you.
            </Feature>
            <Feature
              icon={<Landmark className="h-5 w-5" />}
              title="Your BTC stays in Mezo"
            >
              Every deposit lands in Mezo's own contracts, so it adds to Mezo's
              real TVL.
            </Feature>
            <Feature
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Safety built in"
            >
              You borrow at {pct(CONFIG.minUserICR)} collateral or more. Spend
              also pauses new loans if its own trove gets too thin.
            </Feature>
            <Feature
              icon={<RotateCcw className="h-5 w-5" />}
              title="Clear costs"
            >
              One {pct(CONFIG.originationFeeBps / 100, 2)} fee and{" "}
              {pct(CONFIG.userInterestRate)} simple interest. You see both
              before you confirm.
            </Feature>
          </dl>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-8 px-5 pb-20">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-white">
          Questions
        </h2>
        <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
          <Faq q="Do I get my own BTC back?">
            Yes. Spend records the exact amount of BTC you sent and returns that
            amount when you repay in full.
          </Faq>
          <Faq q="Can I lose my collateral?">
            If BTC drops and your collateral ratio falls to around{" "}
            {CONFIG.liquidationRange}, Spend can liquidate your loan. Your BTC
            is then forfeited to cover the debt, so you don't get it back. Watch
            your ratio on the My loan page. Safety ratios are targets, not
            guarantees against big market moves.
          </Faq>
          <Faq q="What are redemptions?">
            Mezo can redeem against troves, which can reduce both the collateral
            and the debt of Spend's trove. Spend plans to share the effect
            across users in a transparent way, for example pro-rata. It is a
            known risk.
          </Faq>
          <Faq q="How many loans can I have?">
            One open loan per wallet, between {usd(CONFIG.minBorrow, 0)} and{" "}
            {usd(CONFIG.maxBorrow, 0)}.
          </Faq>
          <Faq q="Why do I need to approve MUSD?">
            Repaying moves MUSD from your wallet to Spend. The approval is a
            one-time permission for that.
          </Faq>
          <Faq q="Is this live?">
            Not yet. Spend runs on Mezo Testnet, so it uses test funds only.
          </Faq>
        </div>
      </section>

      {/* Closing */}
      {/* Closing */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-night-800 px-6 py-12 sm:px-12 sm:py-16">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-[90px]"
            aria-hidden
          />
          <div className="relative grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Try your first loan on testnet
              </h2>
              <p className="mt-4 max-w-md text-lg text-mist/80">
                Connect a wallet and borrow a few dollars. It takes about a
                minute.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Button
                  className="px-6 py-3.5 text-base"
                  onClick={() => go("dashboard")}
                >
                  Open the app
                </Button>
                <span className="text-sm text-mute">
                  Test funds only. Nothing real is at risk.
                </span>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xs">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-night-950/60 p-3.5">
                <Coin kind="btc" size={40} />
                <div>
                  <p className="text-sm text-mute">You lock</p>
                  <p className="font-display text-lg font-semibold tabular-nums text-white">
                    {btc(sample.toSend, 6)}
                  </p>
                </div>
              </div>
              <div className="my-2 flex justify-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-night-700 text-primary-light">
                  <ArrowDown className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-night-950/60 p-3.5">
                <Coin kind="musd" size={40} />
                <div>
                  <p className="text-sm text-mute">You get</p>
                  <p className="font-display text-lg font-semibold tabular-nums text-white">
                    {musd(sample.receive)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-sm text-mute">
        Spend on {`Mezo Testnet`}. Demo data only.
      </footer>
    </div>
  );
}

/** Live calculator: the same amount slider as the app, so people feel it before they connect. */
function TryIt({ onOpen }: { onOpen: () => void }) {
  const [amount, setAmount] = useState(100);
  const q = quoteFor(amount);
  const fill =
    ((amount - CONFIG.minBorrow) / (CONFIG.maxBorrow - CONFIG.minBorrow)) * 100;

  return (
    <div className="relative">
      {/* the one glow on the page */}
      <div
        className="pointer-events-none absolute -inset-10 rounded-full bg-primary/30 blur-[90px]"
        aria-hidden
      />

      <div className="relative rounded-[28px] border border-white/10 bg-night-800 p-6 shadow-2xl sm:p-8">
        <p className="text-mute">Try it. How much do you need?</p>
        <p className="mt-1 font-display text-7xl font-semibold tabular-nums text-white">
          <span className="text-primary-light">$</span>
          {amount}
        </p>

        <div className="mt-6">
          <input
            type="range"
            className="dial"
            aria-label="Loan amount"
            min={CONFIG.minBorrow}
            max={CONFIG.maxBorrow}
            step={5}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{ "--fill": `${fill}%` } as CSSProperties}
          />
          <div className="mt-2 flex justify-between text-xs text-mute">
            <span>{usd(CONFIG.minBorrow, 0)}</span>
            <span>{usd(CONFIG.maxBorrow, 0)}</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Line
            kind="btc"
            label="You lock"
            value={btc(q.toSend, 6)}
            sub={`About ${usd(q.toSend * PRICE)}`}
          />
          <Line
            kind="musd"
            label="You get"
            value={musd(q.receive)}
            sub={`After a ${musd(q.fee)} fee`}
          />
        </div>

        <p className="mt-5 text-sm text-mute">
          BTC would have to fall about {num(q.dropPct, 1)}% before liquidation
          risk starts.
        </p>

        <Button full className="mt-5" onClick={onOpen}>
          Borrow {usd(amount, 0)}
        </Button>
      </div>
    </div>
  );
}

function Line({
  kind,
  label,
  value,
  sub,
}: {
  kind: "btc" | "musd";
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-night-950/60 p-3.5">
      <Coin kind={kind} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-mute">{label}</p>
        <p className="truncate font-display text-lg font-semibold tabular-nums text-white">
          {value}
        </p>
      </div>
      <p className="hidden text-right text-xs text-mute sm:block">{sub}</p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li>
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/50 bg-primary/15 font-display text-lg font-bold text-primary-light">
        {n}
      </span>
      <h3 className="mt-5 font-display text-xl font-semibold text-white">
        {title}
      </h3>
      <p className="mt-2 text-mist/75">{children}</p>
    </li>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-white/10 py-6 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
      <dt className="flex items-center gap-2.5 font-display text-lg font-semibold text-white">
        <span className="text-primary-light">{icon}</span>
        {title}
      </dt>
      <dd className="mt-2 text-mist/75">{children}</dd>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold text-white [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="h-5 w-5 shrink-0 text-mute transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 max-w-2xl text-mist/75">{children}</p>
    </details>
  );
}
