import { useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { num, usd } from "../../lib/format";
import { Button, Card, SectionTitle } from "../../components/ui";

export const FAIL = "That didn't go through. Please try again.";

export function tx(success: string, work: () => Promise<void>) {
  return toast.promise(work(), {
    loading: "Confirm in your wallet…",
    success,
    error: (e) => (e instanceof Error && e.message ? e.message : FAIL),
  });
}

export function AmountCard({
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

export function AmountInput({
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

export function SettingRow({
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
        <p className="text-xs text-mute">Current: {current}</p>
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

export function Action({
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

export function SetupCard({
  onOpen,
  price,
}: {
  onOpen: (bitcoin: number, cash: number) => Promise<void>;
  price: number;
}) {
  const [cash, setCash] = useState("2000");
  const [targetIcr, setTargetIcr] = useState(250);
  const [loading, setLoading] = useState(false);

  const cashNum = Number(cash) || 0;
  const autoBtc =
    price > 0 && cashNum > 0 ? (cashNum * (targetIcr / 100)) / price : 0;

  const submit = async () => {
    if (cashNum < 1800) {
      toast.error("Borrow at least 1,800 MUSD (Mezo minimum debt).");
      return;
    }
    if (!(autoBtc > 0)) {
      toast.error("BTC amount must be greater than zero.");
      return;
    }
    setLoading(true);
    try {
      await onOpen(autoBtc, cashNum);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : FAIL);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <SectionTitle
        title="Open the master reserve"
        hint="Spend needs to open its master reserve on Mezo once. Enter the MUSD to borrow and the required Bitcoin collateral will be automatically calculated."
      />
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-ink">MUSD to borrow</label>
          <div className="mt-1.5">
            <AmountInput
              value={cash}
              onChange={setCash}
              unit="MUSD"
              label="MUSD to borrow"
              placeholder="2000"
            />
          </div>
          <p className="mt-1.5 text-xs text-mute">
            At least 1,800 MUSD (Mezo minimum debt).
          </p>
        </div>

        <div>
          <label htmlFor="target-icr" className="text-sm font-medium text-ink">
            Target Collateral Ratio
          </label>
          <div className="mt-1.5">
            <select
              id="target-icr"
              value={targetIcr}
              onChange={(e) => setTargetIcr(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value={200}>200% ICR</option>
              <option value={250}>250% ICR (Recommended)</option>
              <option value={300}>300% ICR (Conservative)</option>
              <option value={350}>350% ICR</option>
              <option value={400}>400% ICR</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-ink">
            Bitcoin to deposit (auto-calculated)
          </label>
          <div className="mt-1.5 flex items-center justify-between rounded-xl border border-line bg-soft px-3 py-2.5">
            <span className="text-sm font-semibold tabular-nums text-ink">
              {autoBtc > 0 ? num(autoBtc, 6) : "0.000000"}
            </span>
            <span className="text-xs font-semibold text-mute">BTC</span>
          </div>
          {price > 0 && cashNum > 0 ? (
            <p className="mt-1.5 text-xs text-mute">
              At {usd(price)}/BTC, about {num(autoBtc, 6)} BTC keeps the reserve at a safe {targetIcr}% ICR.
            </p>
          ) : price <= 0 ? (
            <p className="mt-1.5 text-xs text-amber-600">
              BTC price not loaded yet. Waiting for Mezo price feed…
            </p>
          ) : null}
        </div>

        <Button
          full
          loading={loading}
          disabled={cashNum < 1800 || !(autoBtc > 0)}
          onClick={submit}
        >
          Open reserve
        </Button>
      </div>
    </Card>
  );
}
