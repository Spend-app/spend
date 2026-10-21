import { useState } from "react";
import { Toaster } from "react-hot-toast";
import Header from "./components/Header";
import Landing from "./pages/Landing";
import Borrow from "./pages/Borrow";
import Position from "./pages/Position";
import Admin from "./pages/Admin";
import { NETWORK } from "./data/mock";
import type { Tab } from "./types";

export default function App() {
  const [tab, setTabState] = useState<Tab>("home");

  const setTab = (t: Tab) => {
    setTabState(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <div className="flex min-h-screen flex-col">
        <Header tab={tab} onTab={setTab} />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
          {tab === "home" && <Landing go={setTab} />}
          {tab === "borrow" && <Borrow go={setTab} />}
          {tab === "position" && <Position go={setTab} />}
          {tab === "admin" && <Admin />}
        </main>

        <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-400">
          Spend · {NETWORK.name} (chain {NETWORK.chainId}) · Demo data only
        </footer>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: "12px", fontSize: "14px" },
          success: { iconTheme: { primary: "#7C3AED", secondary: "#fff" } },
        }}
      />
    </>
  );
}
