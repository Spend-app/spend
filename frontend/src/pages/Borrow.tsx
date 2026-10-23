import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowRight, Info, PauseCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { CONFIG, PRICE } from "../data/mock";
import { quoteFor } from "../lib/quote";
import { btc, musd, num, pct, usd } from "../lib/format";
import Coin from "../components/Coin";
import SafetyBar from "../components/SafetyBar";
import { Button, Card, Notice, Row } from "../components/ui";
import type { Tab } from "../types";

const QUICK = [10, 50, 100, 250, 500];

export default function Borrow({ go }: { go: (t: Tab) => void }) {
  const { connected, connect, position, paused, borrow, btcBalance } = useApp();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const n = Number(amount) || 0;
  const q = quoteFor(n);

  let error: string | null = null;
  if (n > 0 && n < CONFIG.minBorrow)
    error = `The smallest loan is ${usd(CONFIG.minBorrow, 0)}.`;
  else if (n > CONFIG.maxBorrow)
    error = `The largest loan is ${usd(CONFIG.maxBorrow, 0)}.`;
  else if (connected && n > 0 && q.toSend > btcBalance)
    error = "You do not have enough Bitcoin in your wallet for this amount.";

  const blocked = paused || !!position;
  const canSubmit = n >= CONFIG.minBorrow && !error && !blocked;

  const submit = async () => {
    if (!connected) return connect();
    setBusy(true);
    try {
      await toast.promise(borrow(n, q.toSend), {
        loading: "Confirm in your wallet…",
        success: `Done. ${musd(q.receive)} is in your wallet`,
        error: "That didn't go through. Please try again.",
      });
      go("position");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        {paused && (
          <Notice tone="amber" icon={<PauseCircle className="h-4 w-4" />}>
            New loans are paused for now. You can still repay a loan you already
            have.
          </Notice>
        )}
        {position && (
          <Notice tone="violet" icon={<Info className="h-4 w-4" />}>
            You already have a loan. Repay it to borrow again.{" "}
            <button
              onClick={() => go("position")}
              className="font-semibold underline underline-offset-2"
            >
              See my loan
            </button>
          </Notice>
        )}

        <Card>
          <label htmlFor="amount" className="text-sm font-medium text-ink">
            How much do you want to borrow?
          </label>
          <div
            className={`mt-2 flex items-center rounded-xl border px-4 focus-within:ring-2 ${
              error
                ? "border-red-400 focus-within:ring-red-100"
                : "border-line focus-within:border-primary focus-within:ring-primary/15"
            } ${blocked ? "bg-soft" : "bg-white"}`}
          >
            <span className="text-lg text-mute">$</span>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={blocked}
              className="w-full bg-transparent py-3.5 pl-2 text-lg font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-mute/60"
            />
            <span className="text-sm font-semibold text-mute">MUSD</span>
          </div>
          <p
            className={`mt-2 text-sm ${error ? "font-medium text-red-700" : "text-mute"}`}
          >
            {error ??
              `You can borrow between ${usd(CONFIG.minBorrow, 0)} and ${usd(CONFIG.maxBorrow, 0)}.`}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK.filter(
              (v) => v >= CONFIG.minBorrow && v <= CONFIG.maxBorrow,
            ).map((v) => (
              <button
                key={v}
                type="button"
                disabled={blocked}
                onClick={() => setAmount(String(v))}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  n === v
                    ? "border-primary bg-primary-soft text-primary-dark"
                    : "border-line text-ink hover:border-primary/50"
                }`}
              >
                ${v}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Ticket
            kind="btc"
            label="You lock"
            value={n > 0 ? btc(q.toSend, 6) : "0 BTC"}
            sub={n > 0 ? `About ${usd(q.toSend * PRICE)}` : "Enter an amount"}
          />
          <span className="mx-auto flex h-8 w-8 rotate-90 items-center justify-center rounded-full border border-line bg-white text-mute sm:rotate-0">
            <ArrowRight className="h-4 w-4" />
          </span>
          <Ticket
            kind="musd"
            label="You get"
            value={n > 0 ? musd(q.receive) : "0 MUSD"}
            sub={n > 0 ? `After a ${musd(q.fee)} fee` : "Enter an amount"}
          />
        </div>

        <Button
          full
          loading={busy}
          disabled={connected && !canSubmit}
          onClick={submit}
        >
          {!connected
            ? "Connect wallet to borrow"
            : position
              ? "You already have a loan"
              : paused
                ? "Loans are paused"
                : `Borrow ${n > 0 ? usd(n, 0) : ""}`.trim()}
        </Button>
      </div>

      <div className="lg:col-span-2">
        <Card className="lg:sticky lg:top-20">
          <h2 className="font-display text-base font-semibold text-ink">
            Before you confirm
          </h2>
          <div className="mt-2 divide-y divide-line">
            <Row
              label={`Fee (${pct(CONFIG.originationFeeBps / 100, 2)}, paid once)`}
              value={n > 0 ? musd(q.fee) : "—"}
            />
            <Row
              label="Interest"
              value={`${pct(CONFIG.userInterestRate)} a year`}
            />
            <Row label="Bitcoin price" value={usd(PRICE)} />
            {connected && (
              <Row label="Your Bitcoin" value={btc(btcBalance, 5)} />
            )}
          </div>

          <div className="mt-4 rounded-xl bg-soft p-4">
            <p className="text-sm font-semibold text-ink">
              How safe is your loan?
            </p>
            <p className="mt-1 text-sm text-mute">
              {n > 0
                ? `If Bitcoin's price falls about ${num(q.dropPct, 1)}% (to ${usd(q.liqPrice, 0)}), your loan would be at risk and your locked Bitcoin could be taken to cover it.`
                : "Enter an amount to see how far the price can fall."}
            </p>
            <div className="mt-3">
              <SafetyBar ratio={q.ratio || CONFIG.minUserICR} />
            </div>
          </div>

          <p className="mt-4 flex gap-2 text-xs text-mute">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            We ask for 1% extra Bitcoin in case the price moves. You get all of
            it back when you repay.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Ticket({
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
    <div className="flex items-center gap-3 rounded-xl bg-soft p-4">
      <Coin kind={kind} size={40} />
      <div className="min-w-0">
        <p className="text-sm text-mute">{label}</p>
        <p className="truncate font-display text-lg font-semibold tabular-nums text-ink">
          {value}
        </p>
        <p className="truncate text-xs text-mute">{sub}</p>
      </div>
    </div>
  );
}
