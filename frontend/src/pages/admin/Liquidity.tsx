import { useApp } from "../../context/AppContext";
import { btc, musd } from "../../lib/format";
import { Button, Card, SectionTitle } from "../../components/ui";
import { AmountCard, tx } from "./common";

export default function AdminLiquidity() {
  const {
    address,
    masterState,
    config,
    addCollateral,
    increaseMasterDebt,
    decreaseMasterDebt,
    withdrawFees,
  } = useApp();

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
      throw new Error(`You only have ${musd(masterState.cashBuffer, 0)} in buffer.`);
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

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <AmountCard
          title="Deposit Bitcoin Collateral"
          hint="Adds native BTC to the master reserve on Mezo. Strengthens ICR safety."
          unit="BTC"
          button="Deposit BTC"
          onSubmit={depositBitcoin}
        />

        <AmountCard
          title="Mint Cash to Lend"
          hint="Borrows additional MUSD from Mezo to increase available loan buffer."
          unit="MUSD"
          button="Mint MUSD"
          onSubmit={addCash}
        />

        <AmountCard
          title="Pay Down Master Borrowing"
          hint="Burns MUSD from cash buffer to repay Mezo debt. Trove must keep >= 1,800 MUSD minNetDebt."
          unit="MUSD"
          button="Pay down"
          onSubmit={payDown}
        />

        <Card>
          <SectionTitle
            title="Protocol Earnings & Fees"
            hint="Origination fees and user interest accumulated in the contract."
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-mute">Available to withdraw</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-ink">
                {musd(masterState.grossFees)}
              </p>
            </div>
            <Button
              disabled={masterState.grossFees <= 0}
              onClick={withdrawEarnings}
            >
              Withdraw to Wallet
            </Button>
          </div>
          <p className="mt-3 text-xs text-mute border-t border-line/60 pt-2">
            Only withdrawable when cash buffer remains above threshold (
            {musd(config.bufferThreshold, 0)}) and master ICR is healthy.
          </p>
        </Card>
      </div>
    </div>
  );
}

