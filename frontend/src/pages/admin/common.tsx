import { useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { num } from "../../lib/format";
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

  const needed = price > 0 ? (Number(cash) * 2.5) / price : 0;

  return (
    <Card>
      <SectionTitle
        title="Open the master reserve"
        hint="Spend needs to open its master reserve on Mezo once. You deposit Bitcoin and mint initial buffer MUSD."
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
          {Number(cash) > 0 && price > 0 && (
            <p className="mt-1.5 text-xs text-mute">
              About {num(needed, 4)} BTC keeps the reserve at a safe 250% ICR.
            </p>
          )}
          {Number(cash) > 0 && price <= 0 && (
            <p className="mt-1.5 text-xs text-amber-600">
              BTC price not loaded yet. Enter the deposit amount manually.
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
          <p className="mt-1.5 text-xs text-mute">
            At least 1,800 MUSD (Mezo minimum debt).
          </p>
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

