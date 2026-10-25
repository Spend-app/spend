import { HandCoins, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { accruedInterest, icr, useNow } from "../lib/calc";
import { btc, musd, num, pct, usd } from "../lib/format";
import Coin from "../components/Coin";
import SafetyBar from "../components/SafetyBar";
import { Badge, Button, Card, Stat } from "../components/ui";
import type { Tab } from "../types";

export default function Dashboard({ go }: { go?: (t: Tab) => void }) {
  const navigate = useNavigate();
  const {
    connected,
    connect,
    btcBalance,
    musdBalance,
    position,
    config,
    price,
    musdPrice,
  } = useApp();
  const now = useNow(1000);

  const toPosition = () => (go ? go("position") : navigate("/app/position"));
  const toBorrow = () => (go ? go("borrow") : navigate("/app/borrow"));

  const total = btcBalance * price + musdBalance * musdPrice;

  const owed = position
    ? position.principal +
      accruedInterest(
        position.principal,
        position.startTime,
        now,
        config.userInterestRate,
      )
    : 0;
  const ratio = position ? icr(position.btc, price, owed) : 0;
  const status =
    ratio >= config.minUserICR
      ? { tone: "green" as const, label: "Safe" }
      : ratio > config.liquidationStart
        ? { tone: "amber" as const, label: "Getting close" }
        : { tone: "red" as const, label: "At risk" };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Wallet */}
        <Card className="lg:col-span-3">
          {connected ? (
            <>
              <p className="text-sm text-mute">Your wallet is worth</p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink">
                {usd(total)}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Holding
                  kind="btc"
                  name="Bitcoin"
                  amount={`${num(btcBalance, 5)} BTC`}
                  value={usd(btcBalance * price)}
                />
                <Holding
                  kind="musd"
                  name="MUSD"
                  amount={`${num(musdBalance, 2)} MUSD`}
                  value={usd(musdBalance * musdPrice)}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-start justify-center">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Borrow dollars against your Bitcoin
              </h2>
              <p className="mt-2 max-w-md text-sm text-mute">
                Lock a little Bitcoin, get MUSD (a digital dollar) straight
                away, and get the same Bitcoin back when you repay. Loans start
                at {usd(config.minBorrow, 0)}.
              </p>
              <Button className="mt-5" onClick={connect}>
                <Wallet className="h-4 w-4" />
                Connect wallet
              </Button>
            </div>
          )}
        </Card>

        {/* Loan */}
        <Card className="lg:col-span-2">
          {position ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-mute">You owe</p>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
                {musd(owed, 2)}
              </p>
              <p className="text-sm text-mute">
                {btc(position.btc)} is locked until you repay.
              </p>
              <div className="mt-4">
                <SafetyBar ratio={ratio} />
              </div>
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={toPosition}
              >
                See my loan
              </Button>
            </>
          ) : (
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <HandCoins className="h-5 w-5" />
                </span>
                <h2 className="mt-3 font-display text-lg font-semibold text-ink">
                  You have no loan
                </h2>
                <p className="mt-1 text-sm text-mute">
                  Borrow from {usd(config.minBorrow, 0)} and keep your Bitcoin.
                  Repay whenever you like.
                </p>
              </div>
              <Button onClick={toBorrow}>Borrow now</Button>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
        {/* <Stat
          label="Cash ready to lend"
          value={musd(masterState.cashBuffer, 0)}
          sub="Available for new loans"
        /> */}
        <Stat
          label="Interest"
          value={`${pct(config.userInterestRate)} a year`}
          sub="Does not compound"
        />
        <Stat
          label="Fee"
          value={pct(config.originationFeeBps / 100, 2)}
          sub="Paid once, when you borrow"
        />
        <Stat
          label="Loan size"
          value={`${usd(config.minBorrow, 0)} to ${usd(config.maxBorrow, 0)}`}
          sub="One loan at a time"
        />
      </div>

      {!position && <HowItWorks />}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Choose an amount",
      text: "Pick how much you need. You see the cost and how much Bitcoin to lock before you confirm.",
    },
    {
      title: "Lock Bitcoin, get MUSD",
      text: "You send a little Bitcoin and the MUSD arrives in your wallet straight away.",
    },
    {
      title: "Repay, get your Bitcoin back",
      text: "Pay back what you borrowed plus interest, and the same Bitcoin returns to you.",
    },
  ];
  return (
    <Card>
      <h2 className="font-display text-base font-semibold text-ink">
        How it works
      </h2>
      <ol className="mt-4 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
              {i + 1}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
              <p className="mt-1 text-sm text-mute">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Holding({
  kind,
  name,
  amount,
  value,
}: {
  kind: "btc" | "musd";
  name: string;
  amount: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-soft p-4">
      <Coin kind={kind} size={40} />
      <div className="min-w-0">
        <p className="font-display text-base font-semibold tabular-nums text-ink">
          {value}
        </p>
        <p className="truncate text-sm text-mute">
          {name}: {amount}
        </p>
      </div>
    </div>
  );
}
