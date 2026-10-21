import { LogOut, Wallet, Zap } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { NETWORK } from '../data/mock'
import { short } from '../lib/format'
import type { Tab } from '../types'

const TABS: { id: Tab; label: string }[] = [
  { id: 'borrow', label: 'Borrow' },
  { id: 'position', label: 'Position' },
  { id: 'admin', label: 'Admin' },
]

export default function Header({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const { connected, address, connect, disconnect } = useApp()

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <button onClick={() => onTab('home')} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <Zap className="h-4 w-4" />
          </span>
          <span className="text-lg font-bold tracking-tight">Spend</span>
        </button>

        <nav className="hidden items-center gap-1 rounded-xl bg-slate-100 p-1 sm:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {NETWORK.name}
          </span>

          {connected ? (
            <button
              onClick={disconnect}
              title="Disconnect"
              className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="h-2 w-2 rounded-full bg-primary" />
              {short(address)}
              <LogOut className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
            </button>
          ) : (
            <button
              onClick={connect}
              className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              <Wallet className="h-4 w-4" />
              Connect
            </button>
          )}
        </div>
      </div>

      {/* mobile nav */}
      <nav className="flex gap-1 border-t border-slate-100 px-4 py-2 sm:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${
              tab === t.id ? 'bg-primary-soft text-primary' : 'text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
