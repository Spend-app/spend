import { useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  LogOut,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { icr } from "../lib/calc";
import { btc, musd, num, pct, short, usd } from "../lib/format";
import { Logo } from "../components/AppShell";
import SafetyBar from "../components/SafetyBar";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Notice,
  Row,
  SectionTitle,
  Stat,
} from "../components/ui";

const FAIL = "That didn't go through. Please try again.";

/** Runs a transaction with standard toasts. Errors thrown show their message. */
function tx(success: string, work: () => Promise<void>) {
  return toast.promise(work(), {
    loading: "Confirm in your wallet…",
    success,
    error: (e) => (e instanceof Error && e.message ? e.message : FAIL),
  });
}

export default function Admin() {
  const {
    connected,
    connect,
    disconnect,
    address,
    paused,
    setPaused,
    isOwner,
    isWrongNetwork,
    switchToMezo,
    masterState,
    config,
    price,
    openMasterTrove,
    addCollateral,
    increaseMasterDebt,
    decreaseMasterDebt,
    refinanceMasterDebt,
    claimMasterCollateral,
    closeMasterTrove,
    withdrawFees,
    updateBorrowLimits,
    updateMinUserICR,
    updatePauseICR,
    updateBufferThreshold,
    updateOriginationFeeBps,
    updateUserInterestRate,
  } = useApp();

  const reserveSafety =
    masterState.debt > 0
      ? icr(masterState.collateral, price, masterState.debt)
      : 0;

  const status =
    reserveSafety >= 250
      ? { tone: "green" as const, label: "Healthy" }
      : reserveSafety >= config.pauseICR
        ? { tone: "amber" as const, label: "Watch closely" }
        : { tone: "red" as const, label: "Too low" };

  const checks = [
    {
      ok: reserveSafety >= config.pauseICR,
      good: `Reserve safety is above ${pct(config.pauseICR)}`,
      bad: `Reserve safety is below ${pct(config.pauseICR)}. New loans should pause.`,
    },
    {
      ok: !masterState.recoveryMode,
      good: "Mezo is running normally",
      bad: "Mezo is under stress right now",
    },
    {
      ok: masterState.cashBuffer >= config.bufferThreshold,
      good: `Cash to lend is above ${musd(config.bufferThreshold, 0)}`,
      bad: `Cash to lend is below ${musd(config.bufferThreshold, 0)}. Add more.`,
    },
  ];

  /* ---- Contract actions ---- */

  const openReserve = async (bitcoin: number, cash: number) => {
    if (!(bitcoin > 0) || !(cash > 0)) throw new Error("Enter both amounts.");
    if (cash < 1800)
      throw new Error("Borrow at least 1,800 MUSD (Mezo minimum debt).");
    await tx("Reserve opened", () => openMasterTrove(bitcoin, cash));
  };

  const depositBitcoin = async (n: number) => {
    if (!(n > 0)) throw new Error("Enter an amount of BTC.");
    await tx(`Added ${btc(n, 4)} to the reserve`, () => addCollateral(n));
  };

  const addCash = async (n: number) => {
    if (!(n > 0)) throw new Error("Enter an amount of MUSD.");
    await tx(`${musd(n, 0)} added to cash to lend`, () =>
      increaseMasterDebt(n),
    );
  };

  const payDown = async (n: number) => {
    if (!(n > 0)) throw new Error("Enter an amount of MUSD.");
    if (n > masterState.cashBuffer)
      throw new Error(`You only have ${musd(masterState.cashBuffer, 0)} to lend.`);
    await tx(`Paid down ${musd(n, 0)} of master debt`, () =>
      decreaseMasterDebt(n),
    );
  };

  const withdrawEarnings = async () => {
    if (masterState.grossFees <= 0) throw new Error("No earnings to withdraw.");
    await tx(`Withdrew ${musd(masterState.grossFees)}`, () =>
      withdrawFees(address, masterState.grossFees),
    );
  };

  const togglePause = async () => {
    await tx(
      paused ? "New loans are open again" : "New loans are paused",
      () => setPaused(!paused),
    );
  };

  const updateRefinance = async () => {
    await tx("Rate & borrowing capacity refreshed with Mezo", () =>
      refinanceMasterDebt(),
    );
  };

  const claimSurplus = async () => {
    await tx("Collateral surplus claimed from Mezo", () =>
      claimMasterCollateral(),
    );
  };

  const closeReserve = async () => {
    if (masterState.totalUserPrincipal > 0)
      throw new Error("Cannot close reserve while users have active loans.");
    await tx("Master reserve closed", () => closeMasterTrove());
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#/"
              className="hidden text-sm font-semibold text-mute hover:text-ink sm:block"
            >
              Go to borrower app
            </a>
            {connected ? (
              <button
                onClick={disconnect}
                className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-soft cursor-pointer"
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
        ) : isWrongNetwork ? (
          <EmptyState
            icon={<AlertCircle className="h-6 w-6 text-amber-600" />}
            title="Wrong Network"
            text="Please switch your wallet to Mezo Testnet to access the admin area."
            action={<Button onClick={switchToMezo}>Switch to Mezo Testnet</Button>}
          />
        ) : (
          <div className="space-y-5">
            {!isOwner && masterState.owner && (
              <Notice tone="amber" icon={<ShieldAlert className="h-4 w-4" />}>
                Your connected wallet ({short(address)}) is not the contract owner.
                Owner is {short(masterState.owner)}. Admin transactions will fail
                unless called from the owner account.
              </Notice>
            )}

            {!masterState.opened ? (
              <div className="mx-auto max-w-lg">
                <SetupCard onOpen={openReserve} price={price} />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h1 className="font-display text-xl font-semibold text-ink">
                    Overview
                  </h1>
                  <Badge tone={paused ? "amber" : "green"}>
                    {paused ? "New loans paused" : "New loans open"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat
                    label="Cash to lend"
                    value={musd(masterState.cashBuffer, 0)}
                    sub={`Refills below ${musd(config.bufferThreshold, 0)}`}
                  />
                  <Stat
                    label="Bitcoin held"
                    value={btc(masterState.collateral, 4)}
                    sub={`About ${usd(masterState.collateral * price, 0)}`}
                  />
                  <Stat
                    label="Borrowed from Mezo"
                    value={musd(masterState.debt, 0)}
                    sub={`${pct(masterState.mezoRateBps / 100, 1)} a year, fixed`}
                  />
                  <Stat
                    label="Owed by users"
                    value={musd(masterState.totalUserPrincipal, 0)}
                    sub="Principal across all active loans"
                  />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <SectionTitle
                        title="Reserve safety"
                        hint="How safe Spend's own Bitcoin reserve is."
                      />
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="font-display text-3xl font-semibold tabular-nums text-ink">
                      {pct(reserveSafety, 1)}
                    </p>
                    <div className="mt-2">
                      <SafetyBar
                        ratio={reserveSafety}
                        min={110}
                        max={300}
                        mark={config.pauseICR}
                        markLabel={`New loans pause at ${config.pauseICR}%`}
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
                          <span
                            className={
                              c.ok ? "text-ink" : "font-medium text-red-700"
                            }
                          >
                            {c.ok ? c.good : c.bad}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card>
                    <SectionTitle
                      title="Where the money is"
                      hint="What users are owed, what Spend holds, and what sits with Mezo."
                    />
                    <div className="divide-y divide-line">
                      <Row
                        label="User principal active"
                        value={musd(masterState.totalUserPrincipal)}
                      />
                      <Row
                        label="Held at Mezo"
                        value={`${btc(masterState.collateral, 4)} / ${musd(masterState.debt, 0)} borrowed`}
                      />
                      <Row
                        label="Gross fees accumulated"
                        value={musd(masterState.grossFees)}
                      />
                      <Row
                        label="Cash buffer balance"
                        value={musd(masterState.cashBuffer)}
                      />
                      <Row
                        label="Current BTC price"
                        value={usd(price, 0)}
                      />
                    </div>
                  </Card>
                </div>

                {/* Money in and out */}
                <div>
                  <h2 className="mb-3 font-display text-base font-semibold text-ink">
                    Add or move funds
                  </h2>
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
                      hint="Borrows more MUSD from Mezo so Spend has cash for new loans."
                      unit="MUSD"
                      button="Add cash"
                      onSubmit={addCash}
                    />
                    <AmountCard
                      title="Pay down borrowing"
                      hint="Burns MUSD from cash buffer to repay master debt to Mezo. Must keep >= 1,800 MUSD minNetDebt."
                      unit="MUSD"
                      button="Pay down"
                      onSubmit={payDown}
                    />
                    <Card>
                      <SectionTitle
                        title="Earnings"
                        hint="Origination fees and user interest collected."
                      />
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-display text-2xl font-semibold tabular-nums text-ink">
                          {musd(masterState.grossFees)}
                        </p>
                        <Button
                          disabled={masterState.grossFees <= 0}
                          onClick={withdrawEarnings}
                        >
                          Withdraw
                        </Button>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Settings */}
                <Card>
                  <SectionTitle
                    title="Loan limits and rates"
                    hint="Update on-chain parameters. Borrowers see new values immediately."
                  />
                  <div className="divide-y divide-line">
                    <SettingRow
                      label="Smallest loan"
                      current={usd(config.minBorrow, 0)}
                      unit="$"
                      onSave={async (n) => {
                        if (n <= 0 || n >= config.maxBorrow)
                          throw new Error(
                            "The smallest loan must be above 0 and less than largest loan.",
                          );
                        await tx("Smallest loan updated", () =>
                          updateBorrowLimits(n, config.maxBorrow),
                        );
                      }}
                    />
                    <SettingRow
                      label="Largest loan"
                      current={usd(config.maxBorrow, 0)}
                      unit="$"
                      onSave={async (n) => {
                        if (n <= config.minBorrow)
                          throw new Error(
                            "The largest loan cannot be below smallest loan.",
                          );
                        await tx("Largest loan updated", () =>
                          updateBorrowLimits(config.minBorrow, n),
                        );
                      }}
                    />
                    <SettingRow
                      label="Refill cash when it falls below"
                      current={musd(config.bufferThreshold, 0)}
                      unit="MUSD"
                      onSave={async (n) => {
                        if (n < 100 || n > 5000)
                          throw new Error("Enter between 100 and 5000 MUSD.");
                        await tx("Refill threshold updated", () =>
                          updateBufferThreshold(n),
                        );
                      }}
                    />
                    <SettingRow
                      label="Lowest safety level for a new loan (minUserICR)"
                      current={pct(config.minUserICR)}
                      unit="%"
                      onSave={async (n) => {
                        if (n < 130 || n > 300)
                          throw new Error("Enter between 130% and 300%.");
                        await tx("Lowest safety level updated", () =>
                          updateMinUserICR(n),
                        );
                      }}
                    />
                    <SettingRow
                      label="Pause new loans when reserve safety is below (pauseICR)"
                      current={pct(config.pauseICR)}
                      unit="%"
                      onSave={async (n) => {
                        if (n < 150 || n > 400)
                          throw new Error("Enter between 150% and 400%.");
                        await tx("Pause safety level updated", () =>
                          updatePauseICR(n),
                        );
                      }}
                    />
                    <SettingRow
                      label="Fee on each loan"
                      current={pct(config.originationFeeBps / 100, 2)}
                      unit="%"
                      onSave={async (n) => {
                        if (n < 0 || n > 2)
                          throw new Error("Enter a fee between 0% and 2%.");
                        await tx("Fee updated", () =>
                          updateOriginationFeeBps(Math.round(n * 100)),
                        );
                      }}
                    />
                    <SettingRow
                      label="Interest charged to users, per year"
                      current={pct(config.userInterestRate)}
                      unit="%"
                      onSave={async (n) => {
                        if (n < 0 || n > 20)
                          throw new Error("Enter an interest rate between 0% and 20%.");
                        await tx("Interest rate updated", () =>
                          updateUserInterestRate(n),
                        );
                      }}
                    />
                  </div>
                </Card>

                {/* Actions */}
                <Card>
                  <SectionTitle title="Other actions" />
                  <div className="divide-y divide-line">
                    <Action
                      title={paused ? "Open new loans again" : "Pause new loans"}
                      text="Stops or restarts new borrowing. People can always repay."
                    >
                      <Button variant="secondary" onClick={togglePause}>
                        {paused ? "Open loans" : "Pause loans"}
                      </Button>
                    </Action>
                    <Action
                      title="Update interest rate with Mezo"
                      text="Refreshes the rate and borrowing limit Spend has with Mezo."
                    >
                      <Button variant="secondary" onClick={updateRefinance}>
                        Update
                      </Button>
                    </Action>
                    <Action
                      title="Recover leftover Bitcoin"
                      text="Collects Bitcoin that Mezo set aside in CollSurplusPool after redemptions."
                    >
                      <Button variant="secondary" onClick={claimSurplus}>
                        Recover
                      </Button>
                    </Action>
                    <Action
                      title="Close the reserve"
                      text={`Only possible once every user has repaid. ${musd(masterState.totalUserPrincipal, 0)} is currently active.`}
                    >
                      <Button
                        variant="danger"
                        disabled={masterState.totalUserPrincipal > 0}
                        onClick={closeReserve}
                      >
                        Close
                      </Button>
                    </Action>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** A card with one amount box and one button. */
function AmountCard({
  title,
  hint,
  unit,
  button,
  onSubmit,
}: {
  title: string;
  hint: string;
  unit: string;
  button: string;
  onSubmit: (n: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const n = Number(value);

  const submit = async () => {
    setLoading(true);
    try {
      await onSubmit(n);
      setValue("");
    } catch {
      // toast handles the error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <SectionTitle title={title} hint={hint} />
      <div className="flex gap-2">
        <AmountInput
          value={value}
          onChange={setValue}
          unit={unit}
          label={title}
        />
        <Button loading={loading} disabled={!(n > 0)} onClick={submit}>
          {button}
        </Button>
      </div>
    </Card>
  );
}

function AmountInput({
  value,
  onChange,
  unit,
  label,
  placeholder = "0.00",
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  label: string;
  placeholder?: string;
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
  );
}

function SettingRow({
  label,
  current,
  unit,
  onSave,
}: {
  label: string;
  current: string;
  unit: string;
  onSave: (n: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await onSave(Number(value));
      setValue("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : FAIL);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-mute">Now: {current}</p>
      </div>
      <div className="flex w-full gap-2 sm:w-64">
        <AmountInput
          value={value}
          onChange={setValue}
          unit={unit}
          label={label}
          placeholder="New value"
        />
        <Button
          variant="secondary"
          loading={loading}
          disabled={value.trim() === "" || !Number.isFinite(Number(value))}
          onClick={save}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function Action({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-mute">{text}</p>
      </div>
      {children}
    </div>
  );
}

function SetupCard({
  onOpen,
  price,
}: {
  onOpen: (bitcoin: number, cash: number) => Promise<void>;
  price: number;
}) {
  const [bitcoin, setBitcoin] = useState("");
  const [cash, setCash] = useState("2000");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await onOpen(Number(bitcoin), Number(cash));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : FAIL);
    } finally {
      setLoading(false);
    }
  };

  const needed = (Number(cash) * 2.5) / (price || 98420);

  return (
    <Card>
      <SectionTitle
        title="Open the reserve"
        hint="Spend needs to open its master reserve on Mezo once. You deposit Bitcoin and mint buffer MUSD."
      />
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-ink">
            Bitcoin to deposit
          </label>
          <div className="mt-1.5">
            <AmountInput
              value={bitcoin}
              onChange={setBitcoin}
              unit="BTC"
              label="Bitcoin to deposit"
              placeholder="0.0000"
            />
          </div>
          {Number(cash) > 0 && (
            <p className="mt-1.5 text-xs text-mute">
              About {num(needed, 4)} BTC keeps the reserve at a safe 250% ICR.
            </p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-ink">
            MUSD to borrow
          </label>
          <div className="mt-1.5">
            <AmountInput
              value={cash}
              onChange={setCash}
              unit="MUSD"
              label="MUSD to borrow"
            />
          </div>
          <p className="mt-1.5 text-xs text-mute">At least 1,800 MUSD (Mezo minimum).</p>
        </div>
        <Button
          full
          loading={loading}
          disabled={!(Number(bitcoin) > 0)}
          onClick={submit}
        >
          Open reserve
        </Button>
      </div>
    </Card>
  );
}
