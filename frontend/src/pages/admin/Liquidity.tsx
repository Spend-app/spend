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
    withdrawBTC,
    extractMUSD,
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
    const maxPaydown = Math.max(0, masterState.debt - 1800);
    if (n > maxPaydown)
      throw new Error(`Cannot drop below Mezo's 1,800 MUSD minimum net debt. Max paydown possible is ${musd(maxPaydown, 2)}.`);
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

  const handleWithdrawBTC = async (n: number) => {
    if (!(n > 0)) throw new Error("Enter an amount of BTC.");
    if (masterState.totalUserPrincipal > 0)
      throw new Error("Cannot extract capital while users have active loans.");
    if (n > masterState.contractBtcBalance)
      throw new Error(`Contract only holds ${btc(masterState.contractBtcBalance, 4)}.`);
    await tx(`Withdrew ${btc(n, 4)} to wallet`, () => withdrawBTC(address, n));
  };

  const handleExtractMUSD = async (n: number) => {
    if (!(n > 0)) throw new Error("Enter an amount of MUSD.");
    if (masterState.totalUserPrincipal > 0)
      throw new Error("Cannot extract capital while users have active loans.");
    if (n > masterState.cashBuffer)
      throw new Error(`Contract only has ${musd(masterState.cashBuffer, 0)} in buffer.`);
    await tx(`Extracted ${musd(n, 0)} to wallet`, () => extractMUSD(address, n));
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

        <AmountCard
          title="Withdraw Contract BTC"
          hint={`Withdraw native BTC held in the contract (e.g. after closing the reserve). Available: ${btc(masterState.contractBtcBalance, 4)}.`}
          unit="BTC"
          button="Withdraw BTC"
          onSubmit={handleWithdrawBTC}
        />

        <AmountCard
          title="Extract Contract MUSD"
          hint={`Extract remaining MUSD cash buffer to your owner wallet. Available: ${musd(masterState.cashBuffer, 0)}.`}
          unit="MUSD"
          button="Extract MUSD"
          onSubmit={handleExtractMUSD}
        />
      </div>
    </div>
  );
}

