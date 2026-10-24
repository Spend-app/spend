import { AlertCircle, LogOut, Wallet } from "lucide-react";
import { useApp } from "../context/AppContext";
import { num, short, usd } from "../lib/format";
import Coin from "./Coin";
import { Button } from "./ui";

/** Sidebar wallet: connect button, or the address with BTC and MUSD balances in dollars. */
export default function WalletCard() {
  const {
    connected,
    address,
    btcBalance,
    musdBalance,
    musdPrice,
    connect,
    disconnect,
    isWrongNetwork,
    switchToMezo,
    price,
  } = useApp();

  if (!connected) {
    return (
      <div className="rounded-2xl bg-soft p-4">
        <p className="text-sm text-ink">
          Connect your wallet to see your balance and borrow.
        </p>
        <Button className="mt-3 w-full" onClick={connect}>
          <Wallet className="h-4 w-4" />
          Connect wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-soft p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span
            className={`h-2 w-2 rounded-full ${
              isWrongNetwork ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
            }`}
          />
          {short(address)}
        </span>
        <button
          onClick={disconnect}
          aria-label="Disconnect wallet"
          className="rounded-lg p-1.5 text-mute hover:bg-white hover:text-ink cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {isWrongNetwork ? (
        <div className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Wrong network</span>
          </div>
          <button
            onClick={switchToMezo}
            className="mt-2 w-full rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer"
          >
            Switch to Mezo Testnet
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Line
            kind="btc"
            name="Bitcoin"
            amount={`${num(btcBalance, 5)} BTC`}
            value={usd(btcBalance * price)}
          />
          <Line
            kind="musd"
            name="MUSD"
            amount={`${num(musdBalance, 2)} MUSD`}
            value={usd(musdBalance * musdPrice)}
          />
        </div>
      )}
    </div>
  );
}

function Line({
  kind,
  name,
  amount,
  value,
}: {
  kind: "btc" | "musd";
  name: string;
  amount: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Coin kind={kind} size={34} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{value}</p>
        <p className="truncate text-xs text-mute">
          {name}: {amount}
        </p>
      </div>
    </div>
  );
}
