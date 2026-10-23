import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import AppShell from "./components/AppShell";
import Dashboard from "./pages/Dashboard";
import Borrow from "./pages/Borrow";
import Position from "./pages/Position";
import Admin from "./pages/Admin";
import type { Tab } from "./types";

/** Admin lives on its own address: open the site with /admin at the end. */
function useIsAdmin() {
  const checkAdmin = () => {
    const hash = window.location.hash.replace(/^#/, "");
    return hash.startsWith("/admin") || window.location.pathname.startsWith("/admin");
  };

  const [isAdmin, setIsAdmin] = useState(checkAdmin);

  useEffect(() => {
    const onChange = () => setIsAdmin(checkAdmin());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  return isAdmin;
}

export default function App() {
  const isAdmin = useIsAdmin();
  const [tab, setTabState] = useState<Tab>("dashboard");

  const go = (t: Tab) => {
    setTabState(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      {isAdmin ? (
        <Admin />
      ) : (
        <AppShell tab={tab} onTab={go}>
          {tab === "dashboard" && <Dashboard go={go} />}
          {tab === "borrow" && <Borrow go={go} />}
          {tab === "position" && <Position go={go} />}
        </AppShell>
      )}

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#ffffff",
            color: "#15131f",
            border: "1px solid #e6e4ee",
            borderRadius: "14px",
            fontSize: "15px",
            boxShadow: "0 8px 24px rgba(21,19,31,0.08)",
          },
          success: { iconTheme: { primary: "#157347", secondary: "#ffffff" } },
          error: { iconTheme: { primary: "#b42318", secondary: "#ffffff" } },
        }}
      />
    </>
  );
}
