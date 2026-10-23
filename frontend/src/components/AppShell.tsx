import type { ReactNode } from "react";
import {
  HandCoins,
  LayoutDashboard,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { short } from "../lib/format";
import type { Tab } from "../types";
import WalletCard from "./WalletCard";

const NAV: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "borrow", label: "Borrow", icon: HandCoins },
  { id: "position", label: "My loan", icon: Wallet },
];

export default function AppShell({
  tab,
  onTab,
  children,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  children: ReactNode;
}) {
  const { connected, address, connect } = useApp();
  const current = NAV.find((n) => n.id === tab);

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white p-4 md:flex">
        <Logo onClick={() => onTab("dashboard")} />

        <nav className="mt-8 space-y-1" aria-label="Main">
          {NAV.map((item) => {
            const active = item.id === tab;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary-soft text-primary-dark"
                    : "text-mute hover:bg-soft hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <WalletCard />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:px-10">
          <div className="md:hidden">
            <Logo onClick={() => onTab("dashboard")} compact />
          </div>
          <h1 className="hidden font-display text-lg font-semibold text-ink md:block">
            {current?.label}
          </h1>

          <div className="flex items-center gap-2">
            <span className="hidden whitespace-nowrap rounded-full bg-soft px-3 py-1.5 text-sm font-semibold text-mute sm:inline">
              Test mode
            </span>
            {/* On mobile the sidebar wallet is hidden, so connect lives here */}
            <button
              onClick={connect}
              className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-dark md:hidden cursor-pointer"
            >
              <Wallet className="h-4 w-4" />
              {connected ? short(address) : "Connect"}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 md:px-10 md:py-8 md:pb-12">
          {children}
        </main>
      </div>

      {/* Bottom tabs (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-line bg-white md:hidden"
        aria-label="Main"
      >
        {NAV.map((item) => {
          const active = item.id === tab;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${
                active ? "text-primary-dark" : "text-mute"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function Logo({
  onClick,
  compact,
}: {
  onClick?: () => void;
  compact?: boolean;
}) {
  const inner = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
        <Zap className="h-[18px] w-[18px]" />
      </span>
      <span
        className={`font-display font-bold tracking-tight text-ink ${compact ? "text-lg" : "text-xl"}`}
      >
        Spend
      </span>
    </>
  );
  return onClick ? (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5"
      aria-label="Spend home"
    >
      {inner}
    </button>
  ) : (
    <span className="flex items-center gap-2.5">{inner}</span>
  );
}
