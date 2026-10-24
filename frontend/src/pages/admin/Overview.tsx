import {
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { icr } from "../../lib/calc";
import { btc, musd, pct, usd } from "../../lib/format";
import SafetyBar from "../../components/SafetyBar";
import {
  Badge,
  Card,
  Row,
  SectionTitle,
  Stat,
} from "../../components/ui";
import { SetupCard, tx } from "./common";

export default function AdminOverview() {
  const { masterState, config, price, openMasterTrove } = useApp();

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
      bad: "Mezo is in Recovery Mode (TCR < 150%)",
    },
    {
      ok: masterState.cashBuffer >= config.bufferThreshold,
      good: `Cash to lend is above ${musd(config.bufferThreshold, 0)}`,
      bad: `Cash to lend is below ${musd(config.bufferThreshold, 0)}. Add more.`,
    },
  ];

  const openReserve = async (bitcoin: number, cash: number) => {
    if (!(bitcoin > 0) || !(cash > 0)) throw new Error("Enter both amounts.");
    if (cash < 1800)
      throw new Error("Borrow at least 1,800 MUSD (Mezo minimum debt).");
    await tx("Reserve opened", () => openMasterTrove(bitcoin, cash));
  };

  if (!masterState.opened) {
    return (
      <div className="mx-auto max-w-lg pt-4">
        <SetupCard onOpen={openReserve} price={price} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Banner */}
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

      {/* Safety & Distribution */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <SectionTitle
              title="Reserve safety"
              hint="Master Trove ICR ratio on Mezo."
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
              markLabel={`Auto-pause at ${config.pauseICR}%`}
            />
          </div>
          <ul className="mt-4 space-y-2 border-t border-line/60 pt-3">
            {checks.map((c) => (
              <li key={c.good} className="flex items-start gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <span
                  className={c.ok ? "text-ink" : "font-medium text-red-700"}
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
            hint="Balance ledger across Spend and Mezo."
          />
          <div className="divide-y divide-line">
            <Row
              label="User principal active"
              value={musd(masterState.totalUserPrincipal)}
            />
            <Row
              label="Held at Mezo"
              value={`${btc(masterState.collateral, 4)} / ${musd(masterState.debt, 0)} debt`}
            />
            <Row
              label="Gross protocol fees"
              value={musd(masterState.grossFees)}
            />
            <Row
              label="Cash buffer balance"
              value={musd(masterState.cashBuffer)}
            />
            <Row label="Current BTC price" value={usd(price, 0)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

