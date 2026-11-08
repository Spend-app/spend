import { ExternalLink } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { btc, musd, pct, short } from "../../lib/format";
import { Button, Card, Row, SectionTitle } from "../../components/ui";
import { MEZO_ADDRESSES, SPEND_CONTRACT_ADDRESS } from "../../config/contracts";
import { Action, tx } from "./common";

export default function AdminOperations() {
  const {
    paused,
    setPaused,
    refinanceMasterDebt,
    claimMasterCollateral,
    closeMasterTrove,
    syncWriteDown,
    enterWindDown,
    masterState,
    activeBorrowers,
    liquidateUser,
    config,
  } = useApp();

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

  const triggerSyncWriteDown = async () => {
    await tx("Write-down factor synced with Mezo collateral", () =>
      syncWriteDown(),
    );
  };

  const triggerWindDown = async () => {
    await tx("Protocol entered wind-down mode", () => enterWindDown());
  };

  const closeReserve = async () => {
    if (masterState.totalUserPrincipal > 0)
      throw new Error("Cannot close reserve while users have active loans.");
    await tx("Master reserve closed", () => closeMasterTrove());
  };

  return (
    <div className="space-y-6">
      {/* Active Borrowers & Liquidation Table */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle
            title="Active Borrower Positions & Liquidation"
            hint={`Live health of open micro-loans. Positions below ${pct(config.liquidationICR)} can be liquidated to safeguard the master reserve.`}
          />
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-soft text-mute">
            {activeBorrowers.length} active {activeBorrowers.length === 1 ? "loan" : "loans"}
          </span>
        </div>

        {activeBorrowers.length === 0 ? (
          <div className="py-8 text-center text-sm text-mute">
            No active borrower loans currently on Spend.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-mute uppercase tracking-wider">
                  <th className="pb-3 pl-1">Borrower</th>
                  <th className="pb-3 text-right">Debt</th>
                  <th className="pb-3 text-right">Collateral</th>
                  <th className="pb-3 text-right">ICR</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right pr-1">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {activeBorrowers.map((borrower) => {
                  const isSafe = borrower.icr >= config.minUserICR;
                  const isUnder = borrower.isLiquidatable;
                  return (
                    <tr
                      key={borrower.address}
                      className="hover:bg-soft/50 transition-colors"
                    >
                      <td className="py-3 pl-1 font-mono text-xs font-medium">
                        <a
                          href={`https://explorer.test.mezo.org/address/${borrower.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          {short(borrower.address)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="py-3 text-right tabular-nums font-medium text-ink">
                        {musd(borrower.totalOwed, 2)}
                      </td>
                      <td className="py-3 text-right tabular-nums text-mute">
                        {btc(borrower.currentBtcClaim)}
                      </td>
                      <td className="py-3 text-right tabular-nums font-semibold">
                        <span
                          className={
                            isUnder
                              ? "text-red-700"
                              : isSafe
                                ? "text-emerald-700"
                                : "text-amber-700"
                          }
                        >
                          {pct(borrower.icr)}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isUnder
                              ? "bg-red-100 text-red-800"
                              : isSafe
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isUnder ? "Liquidatable" : isSafe ? "Safe" : "Low"}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-1">
                        {isUnder ? (
                          <Button
                            variant="danger"
                            onClick={() =>
                              tx(
                                `Position ${short(borrower.address)} liquidated`,
                                () => liquidateUser(borrower.address),
                              )
                            }
                          >
                            Liquidate
                          </Button>
                        ) : (
                          <span className="text-xs text-mute/50">Healthy</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="Protocol Safety & Maintenance"
          hint="Control emergency pauses and Mezo integrations."
        />
        <div className="divide-y divide-line">
          <Action
            title={paused ? "Open new loans again" : "Pause new loans"}
            text="Halts or resumes new borrowing. Existing borrowers can always repay."
          >
            <Button variant="secondary" onClick={togglePause}>
              {paused ? "Open Loans" : "Pause Loans"}
            </Button>
          </Action>

          <Action
            title="Update Interest Rate & Borrowing Cap with Mezo"
            text="Calls refinance() on Mezo BorrowerOperations to re-align fixed rate and reset maximum borrowing capacity."
          >
            <Button variant="secondary" onClick={updateRefinance}>
              Sync Rate
            </Button>
          </Action>

          <Action
            title="Recover Collateral Surplus"
            text="Claims any native BTC stranded in Mezo's CollSurplusPool from redemptions or liquidations."
          >
            <Button variant="secondary" onClick={claimSurplus}>
              Claim Surplus
            </Button>
          </Action>

          <Action
            title="Sync Collateral Write-Down"
            text={`Synchronizes write-down factor against current Mezo collateral. (Current factor: ${(masterState.writeDownFactor * 100).toFixed(2)}%).`}
          >
            <Button variant="secondary" onClick={triggerSyncWriteDown}>
              Sync Write-Down
            </Button>
          </Action>

          <Action
            title="Enter Wind-Down Mode"
            text="Permanently activates wind-down exit path if master Trove is liquidated or closed by Mezo. Forgives debts and returns recovered collateral."
          >
            <Button
              variant="danger"
              disabled={masterState.windDown}
              onClick={triggerWindDown}
            >
              {masterState.windDown ? "In Wind-Down" : "Enter Wind-Down"}
            </Button>
          </Action>

          <Action
            title="Close Master Reserve Trove"
            text={`Teardown master Trove. Requires total user principal to be 0. (Currently ${musd(masterState.totalUserPrincipal, 0)} active).`}
          >
            <Button
              variant="danger"
              disabled={masterState.totalUserPrincipal > 0}
              onClick={closeReserve}
            >
              Close Trove
            </Button>
          </Action>
        </div>
      </Card>

      {/* Contract Address Reference */}
      <Card>
        <SectionTitle
          title="Contract Addresses & Network"
          hint="Verified Mezo testnet addresses configured in the application."
        />
        <div className="divide-y divide-line text-xs font-mono">
          <Row
            label="Spend Contract"
            value={
              <a
                href={`https://explorer.test.mezo.org/address/${SPEND_CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                {short(SPEND_CONTRACT_ADDRESS)}
                <ExternalLink className="h-3 w-3" />
              </a>
            }
          />
          <Row
            label="MUSD Token"
            value={
              <a
                href={`https://explorer.test.mezo.org/address/${MEZO_ADDRESSES.musd}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                {short(MEZO_ADDRESSES.musd)}
                <ExternalLink className="h-3 w-3" />
              </a>
            }
          />
          <Row
            label="BorrowerOperations"
            value={short(MEZO_ADDRESSES.borrowerOperations)}
          />
          <Row
            label="TroveManager"
            value={short(MEZO_ADDRESSES.troveManager)}
          />
          <Row
            label="PriceFeed Oracle"
            value={short(MEZO_ADDRESSES.priceFeed)}
          />
        </div>
      </Card>
    </div>
  );
}

