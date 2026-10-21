import { useApp } from '../context/AppContext'
import { MUSD_PRICE, PRICE } from '../data/mock'
import { btc, musd, usd } from '../lib/format'
import { Card } from './ui'

/** Wallet balances with dollar values. Shows nothing until a wallet is connected. */
export default function Balances() {
  const { connected, btcBalance, musdBalance } = useApp()
  if (!connected) return null

  return (
    <Card>
      <p className="text-sm font-semibold text-slate-900">Wallet</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile label="BTC" amount={btc(btcBalance, 6)} value={usd(btcBalance * PRICE)} />
        <Tile label="MUSD" amount={musd(musdBalance)} value={usd(musdBalance * MUSD_PRICE)} />
      </div>
    </Card>
  )
}

function Tile({ label, amount, value }: { label: string; amount: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{amount}</p>
      <p className="text-xs tabular-nums text-slate-500">≈ {value}</p>
    </div>
  )
}
