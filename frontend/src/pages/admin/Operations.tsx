import { ExternalLink } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { musd, short } from "../../lib/format";
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
    masterState,
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

  const closeReserve = async () => {
    if (masterState.totalUserPrincipal > 0)
      throw new Error("Cannot close reserve while users have active loans.");
    await tx("Master reserve closed", () => closeMasterTrove());
  };

  return (
    <div className="space-y-6">
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

