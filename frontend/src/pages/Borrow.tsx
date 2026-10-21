import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowDown, Info, PauseCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { CONFIG, PRICE } from "../data/mock";
import { btc, musd, pct, usd } from "../lib/format";
import Balances from "../components/Balances";
import { Button, Card, Notice, Row } from "../components/ui";
import type { Tab } from "../types";

const QUICK = [10, 50, 100, 250];

export default function Borrow({ go }: { go: (t: Tab) => void }) {
  const { connected, connect, position, paused, borrow, btcBalance } = useApp();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const n = Number(amount) || 0;
  const fee = (n * CONFIG.originationFeeBps) / 10_000;
  const receive = n - fee;
  const required = (n * CONFIG.minUserICR) / 100 / PRICE;
  const toSend = required * CONFIG.priceDriftBuffer;

  let error: string | null = null;
  if (n > 0 && n < CONFIG.minBorrow)
    error = `Minimum is ${musd(CONFIG.minBorrow, 0)}`;
  else if (n > CONFIG.maxBorrow)
    error = `Maximum is ${musd(CONFIG.maxBorrow, 0)}`;
  else if (connected && n > 0 && toSend > btcBalance)
    error = "Not enough BTC in your wallet";

  const blocked = paused || !!position;
  const canSubmit = n >= CONFIG.minBorrow && !error && !blocked;

  const submit = async () => {
    if (!connected) return connect();
    setBusy(true);
    try {
      await toast.promise(borrow(n, toSend), {
        loading: "Waiting for confirmation…",
        success: `You received ${musd(receive)}`,
        error: "Transaction failed",
      });
      setAmount("");
      go("position");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Borrow small, keep your Bitcoin
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Lock a little BTC and get {usd(CONFIG.minBorrow, 0)}–
          {usd(CONFIG.maxBorrow, 0)} in MUSD. Repay any time to get your exact
          BTC back.
        </p>
      </div>

      {connected && (
        <div className="my-4">
          <Balances />
        </div>
      )}

      {paused && (
        <div className="mb-4">
          <Notice tone="amber" icon={<PauseCircle className="h-4 w-4" />}>
            New borrowing is paused right now. Repaying still works.
          </Notice>
        </div>
      )}

      <Card>
        <label htmlFor="amount" className="text-sm font-medium text-slate-700">
          I want to borrow
        </label>
        <div
          className={`mt-2 flex items-center rounded-xl border bg-slate-50 px-4 py-3 focus-within:border-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20 ${
            error ? "border-red-300" : "border-slate-200"
          }`}
        >
          <input
            id="amount"
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={blocked}
            className="w-full bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-slate-300"
          />
          <span className="ml-3 rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
            MUSD
          </span>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-3 flex gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              disabled={blocked}
              onClick={() => setAmount(String(q))}
              className="flex-1 rounded-lg border border-slate-200 py-1.5 text-sm font-medium text-slate-600 hover:border-primary hover:text-primary disabled:opacity-50"
            >
              ${q}
            </button>
          ))}
        </div>

        <div className="my-4 flex justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
            <ArrowDown className="h-4 w-4" />
          </span>
        </div>

        <div className="rounded-xl bg-primary-soft px-4 py-3">
          <p className="text-xs font-medium text-primary">You send</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {n > 0 ? btc(toSend, 6) : "— BTC"}
          </p>
          {n > 0 && (
            <p className="text-xs text-slate-500">
              ≈ {usd(toSend * PRICE)} locked as collateral
            </p>
          )}
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          <Row label="You receive" value={n > 0 ? musd(receive) : "—"} strong />
          <Row
            label={`Origination fee (${pct(CONFIG.originationFeeBps / 100, 2)})`}
            value={n > 0 ? musd(fee) : "—"}
          />
          <Row
            label="Interest (simple)"
            value={`${pct(CONFIG.userInterestRate)} / year`}
          />
          <Row
            label="Collateral ratio"
            value={`${pct(CONFIG.minUserICR)} minimum`}
          />
          <Row label="Liquidation risk below" value={CONFIG.liquidationRange} />
          <Row label="BTC price" value={usd(PRICE)} />
        </div>

        <div className="mt-5">
          <Button
            full
            loading={busy}
            disabled={connected && !canSubmit}
            onClick={submit}
          >
            {!connected
              ? "Connect wallet"
              : position
                ? "You already have an open position"
                : paused
                  ? "Borrowing paused"
                  : "Borrow MUSD"}
          </Button>
        </div>

        {position && (
          <button
            onClick={() => go("position")}
            className="mt-3 w-full text-center text-sm font-medium text-primary hover:underline"
          >
            View my position
          </button>
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2 px-1 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          We add a 1% cushion to the BTC quote to cover price moves. It all
          stays in your collateral and comes back to you when you repay. One
          position per wallet.
        </p>
      </div>
    </div>
  );
}
