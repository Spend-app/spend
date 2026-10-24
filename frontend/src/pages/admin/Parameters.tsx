import { useApp } from "../../context/AppContext";
import { musd, pct, usd } from "../../lib/format";
import { Card, SectionTitle } from "../../components/ui";
import { SettingRow, tx } from "./common";

export default function AdminParameters() {
  const {
    config,
    updateBorrowLimits,
    updateBufferThreshold,
    updateMinUserICR,
    updatePauseICR,
    updateOriginationFeeBps,
    updateUserInterestRate,
  } = useApp();

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title="Loan Limits & Borrowing Rates"
          hint="Adjust on-chain parameters. Borrowers see new values immediately."
        />
        <div className="divide-y divide-line">
          <SettingRow
            label="Smallest loan size (minBorrow)"
            current={usd(config.minBorrow, 0)}
            unit="$"
            onSave={async (n) => {
              if (n <= 0 || n >= config.maxBorrow)
                throw new Error(
                  "The smallest loan must be > 0 and < largest loan.",
                );
              await tx("Smallest loan updated", () =>
                updateBorrowLimits(n, config.maxBorrow),
              );
            }}
          />
          <SettingRow
            label="Largest loan size (maxBorrow)"
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
            label="Cash buffer refill threshold"
            current={musd(config.bufferThreshold, 0)}
            unit="MUSD"
            onSave={async (n) => {
              if (n < 100 || n > 5000)
                throw new Error("Enter between 100 and 5,000 MUSD.");
              await tx("Refill threshold updated", () =>
                updateBufferThreshold(n),
              );
            }}
          />
          <SettingRow
            label="Minimum User Collateral Ratio (minUserICR)"
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
            label="Reserve Safety Pause Level (pauseICR)"
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
            label="Origination Fee (paid once on borrow)"
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
            label="User Interest Rate (per year, simple)"
            current={pct(config.userInterestRate)}
            unit="%"
            onSave={async (n) => {
              if (n < 0 || n > 20)
                throw new Error(
                  "Enter an interest rate between 0% and 20%.",
                );
              await tx("Interest rate updated", () =>
                updateUserInterestRate(n),
              );
            }}
          />
        </div>
      </Card>
    </div>
  );
}

