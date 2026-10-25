import { useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { AlertCircle, Check, HandCoins, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { accruedInterest, icr, useNow } from "../lib/calc";
import { btc, musd, num, pct, usd } from "../lib/format";
import SafetyBar from "../components/SafetyBar";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Notice,
  SectionTitle,
  Stat,
} from "../components/ui";
import type { Tab } from "../types";

export default function Position({ go }: { go?: (t: Tab) => void }) {
  const navigate = useNavigate();
  const {
    connected,
    connect,
    position,
    musdBalance,
    approved,
    approve,
    repay,
    config,
    price,
    musdPrice,
    isWrongNetwork,
    switchToMezo,
  } = useApp();

  const now = useNow(1000);
  const [approving, setApproving] = useState(false);
  const [repaying, setRepaying] = useState(false);

  if (!connected) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Connect your wallet"
        text="Connect to see your loan, how safe it is, and to repay it."
        action={<Button onClick={connect}>Connect wallet</Button>}
      />
    );
  }

  if (isWrongNetwork) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6 text-amber-600" />}
        title="Wrong Network"
        text="Please switch your wallet to Mezo Testnet to view and manage your loan."
        action={<Button onClick={switchToMezo}>Switch to Mezo Testnet</Button>}
      />
    );
  }

  if (!position) {
    return (
      <EmptyState
        icon={<HandCoins className="h-6 w-6" />}
        title="You have no loan"
        text={`Borrow from ${usd(config.minBorrow, 0)} against a little Bitcoin. You can repay whenever you like.`}
        action={
          <Button onClick={() => (go ? go("borrow") : navigate("/app/borrow"))}>
            Borrow now
          </Button>
        }
      />
    );
  }

  const interest = accruedInterest(
    position.principal,
    position.startTime,
    now,
    config.userInterestRate,
  );
  const owed = position.principal + interest;
  const ratio = icr(position.btc, price, owed);

  const inZone = ratio <= config.liquidationStart;
  const status =
    ratio >= config.minUserICR
      ? { tone: "green" as const, label: "Safe" }
      : !inZone
        ? { tone: "amber" as const, label: "Getting close" }
        : { tone: "red" as const, label: "At risk" };

  // How far the Bitcoin price can fall before the loan becomes risky
  const dropPct = Math.max(0, (1 - config.liquidationStart / ratio) * 100);
  const riskPrice = (price * config.liquidationStart) / ratio;

  const enough = musdBalance >= owed;

  const doApprove = async () => {
    setApproving(true);
    try {
      await toast.promise(approve(), {
        loading: "Confirm in your wallet…",
        success: "Done. You can repay now",
        error: (err) =>
          err instanceof Error && err.message
            ? err.message
            : "That didn't go through. Please try again.",
      });
    } catch {
      // toast handles the error display
    } finally {
      setApproving(false);
    }
  };

  const doRepay = async () => {
    setRepaying(true);
    try {
      await toast.promise(repay(owed), {
        loading: "Confirm in your wallet…",
        success: `Repaid. ${btc(position.btc)} is back in your wallet`,
        error: (err) =>
          err instanceof Error && err.message
            ? err.message
            : "That didn't go through. Please try again.",
      });
    } catch {
      // toast handles the error display
    } finally {
      setRepaying(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-mute">You owe</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink">
              {musd(owed, 4)}
            </p>
            <p className="mt-1 text-sm text-mute">
              About {usd(owed * musdPrice)}. It grows a little every second.
            </p>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        <div className="mt-6 rounded-xl bg-soft p-4">
          <p className="text-sm font-semibold text-ink">
            How safe is your loan?
          </p>
          <div className="mt-3">
            <SafetyBar ratio={ratio} />
          </div>
          <p className="mt-3 text-sm text-mute">
            {inZone
              ? "Your loan is at risk. Repay as soon as you can to keep your Bitcoin."
              : `Bitcoin's price can fall about ${num(dropPct, 1)}% (to ${usd(riskPrice, 0)}) before your loan is at risk. If it does, your locked Bitcoin could be taken to cover what you owe.`}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="You borrowed"
          value={musd(position.principal)}
          sub={`About ${usd(position.principal * musdPrice)}`}
        />
        <Stat
          label="Interest so far"
          value={num(interest, 6)}
          sub={`MUSD, at ${pct(config.userInterestRate)} a year`}
        />
        <Stat
          label="Bitcoin locked"
          value={btc(position.btc)}
          sub={`About ${usd(position.btc * price)}`}
        />
        <Stat label="Bitcoin price" value={usd(price, 0)} sub="Right now" />
      </div>

      <Card>
        <SectionTitle
          title="Repay your loan"
          hint="Pay back what you owe and get your Bitcoin back."
        />

        <ol className="space-y-3">
          <Step
            done={approved}
            n={1}
            title="Allow repayment"
            text="A one-time permission so Spend can pull your MUSD when you repay."
          >
            {!approved && (
              <Button
                variant="secondary"
                loading={approving}
                onClick={doApprove}
              >
                Allow
              </Button>
            )}
          </Step>
          <Step
            done={false}
            n={2}
            title="Repay"
            text={`You pay ${musd(owed, 4)} and get ${btc(position.btc)} back.`}
          >
            <Button
              loading={repaying}
              disabled={!approved || !enough}
              onClick={doRepay}
            >
              Repay
            </Button>
          </Step>
        </ol>

        {!enough && (
          <div className="mt-4">
            <Notice tone="red">
              You have {musd(musdBalance)} and need {musd(owed - musdBalance)}{" "}
              more to repay in full.
            </Notice>
          </div>
        )}
      </Card>
    </div>
  );
}

function Step({
  n,
  title,
  text,
  done,
  children,
}: {
  n: number;
  title: string;
  text: string;
  done: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? "bg-emerald-100 text-emerald-800" : "bg-ink text-white"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-mute">{done ? "Done" : text}</p>
      </div>
      {!done && children}
    </li>
  );
}
