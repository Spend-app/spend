import type { ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Coins,
  LayoutDashboard,
  Lock,
  LogOut,
  ShieldAlert,
  Sliders,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { short } from "../lib/format";
import { Logo } from "./AppShell";
import { Badge, Button, EmptyState, Notice } from "./ui";

const ADMIN_NAV: {
  path: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}[] = [
  {
    path: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    desc: "Reserve health, debt, and key metrics",
  },
  {
    path: "/admin/liquidity",
    label: "Liquidity & Funds",
    icon: Coins,
    desc: "Collateral, cash buffer, and earnings",
  },
  {
    path: "/admin/parameters",
    label: "Parameters",
    icon: Sliders,
    desc: "Loan sizes, interest rates, and fees",
  },
  {
    path: "/admin/operations",
    label: "Operations",
    icon: Activity,
    desc: "Emergency pause, Mezo sync, and maintenance",
  },
];

export default function AdminShell({ children }: { children?: ReactNode }) {
  const {
    connected,
    connect,
    disconnect,
    address,
    paused,
    isOwner,
    isWrongNetwork,
    switchToMezo,
    masterState,
  } = useApp();

  const location = useLocation();
  const currentNav =
    ADMIN_NAV.find((n) =>
      n.path === "/admin"
        ? location.pathname === "/admin" || location.pathname === "/admin/"
        : location.pathname.startsWith(n.path),
    ) || ADMIN_NAV[0];

  return (
    <div className="min-h-screen md:flex bg-slate-50/50">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white p-4 md:flex">
        <div className="flex items-center justify-between">
          <Link to="/admin">
            <Logo />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="mt-8 space-y-1" aria-label="Admin Navigation">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const isExact = item.path === "/admin";
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={isExact}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary-soft text-primary-dark"
                      : "text-mute hover:bg-soft hover:text-ink"
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer Wallet */}
        <div className="mt-auto pt-4 border-t border-line">
          {connected ? (
            <div className="rounded-xl bg-soft p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isWrongNetwork
                        ? "bg-amber-500 animate-pulse"
                        : isOwner
                          ? "bg-emerald-500"
                          : "bg-blue-500"
                    }`}
                  />
                  {short(address)}
                </span>
                <button
                  onClick={disconnect}
                  title="Disconnect"
                  aria-label="Disconnect wallet"
                  className="rounded-lg p-1 text-mute hover:bg-white hover:text-ink cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <Button className="w-full text-xs" onClick={connect}>
              <Wallet className="h-3.5 w-3.5" />
              Connect Admin Wallet
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:px-10">
          <div className="flex items-center gap-3 md:hidden">
            <Link to="/admin">
              <Logo compact />
            </Link>
            <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              Admin
            </span>
          </div>

          <div className="hidden md:block">
            <h1 className="font-display text-lg font-semibold text-ink">
              {currentNav?.label}
            </h1>
            <p className="text-xs text-mute">{currentNav?.desc}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={paused ? "amber" : "green"}>
              {paused ? "Loans Paused" : "Loans Active"}
            </Badge>

            {/* Mobile Connect / Disconnect */}
            <button
              onClick={connected ? disconnect : connect}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white md:hidden cursor-pointer"
            >
              <Wallet className="h-3.5 w-3.5" />
              {connected ? short(address) : "Connect"}
            </button>
          </div>
        </header>

        {/* Content Container */}
        <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 md:px-10 md:py-8 md:pb-12">
          {!connected ? (
            <EmptyState
              icon={<Lock className="h-6 w-6" />}
              title="Admin sign in"
              text="Connect the wallet that manages Spend to access protocol administration."
              action={<Button onClick={connect}>Connect wallet</Button>}
            />
          ) : isWrongNetwork ? (
            <EmptyState
              icon={<AlertCircle className="h-6 w-6 text-amber-600" />}
              title="Wrong Network"
              text="Please switch your wallet to Mezo Testnet to manage the Spend protocol."
              action={
                <Button onClick={switchToMezo}>Switch to Mezo Testnet</Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {/* Owner Warning Notice */}
              {!isOwner && masterState.owner && (
                <Notice tone="amber" icon={<ShieldAlert className="h-4 w-4" />}>
                  Your connected wallet ({short(address)}) is not the contract
                  owner. Owner is {short(masterState.owner)}. Admin functions
                  will revert unless executed from the owner account.
                </Notice>
              )}

              {children || <Outlet />}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-white md:hidden"
        aria-label="Admin Navigation"
      >
        {ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const isExact = item.path === "/admin";
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={isExact}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                  isActive ? "text-purple-600" : "text-mute hover:text-ink"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[70px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
