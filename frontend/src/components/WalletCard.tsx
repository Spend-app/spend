import { LogOut, Wallet } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { MUSD_PRICE, PRICE } from '../data/mock'
import { num, short, usd } from '../lib/format'
import Coin from './Coin'
import { Button } from './ui'

/** Sidebar wallet: connect button, or the address with BTC and MUSD balances in dollars. */
export default function WalletCard() {
  const { connected, address, btcBalance, musdBalance, connect, disconnect } = useApp()

  if (!connected) {
    return (
      <div className="rounded-2xl bg-soft p-4">
        <p className="text-sm text-ink">Connect your wallet to see your balance and borrow.</p>
        <Button className="mt-3 w-full" onClick={connect}>
          <Wallet className="h-4 w-4" />
          Connect wallet
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-soft p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {short(address)}
        </span>
        <button
          onClick={disconnect}
          aria-label="Disconnect wallet"
          className="rounded-lg p-1.5 text-mute hover:bg-white hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <Line kind="btc" name="Bitcoin" amount={`${num(btcBalance, 5)} BTC`} value={usd(btcBalance * PRICE)} />
        <Line kind="musd" name="MUSD" amount={`${num(musdBalance, 2)} MUSD`} value={usd(musdBalance * MUSD_PRICE)} />
      </div>
    </div>
  )
}

function Line({ kind, name, amount, value }: { kind: 'btc' | 'musd'; name: string; amount: string; value: string }) {
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
  )
}
