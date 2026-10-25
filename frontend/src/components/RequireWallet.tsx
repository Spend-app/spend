import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

/**
 * Protects a route from unauthenticated access. When no wallet is connected
 * the route renders nothing and the visitor is sent back to the landing page.
 */
export default function RequireWallet({ children }: { children: ReactNode }) {
  const { connected } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!connected) navigate("/", { replace: true });
  }, [connected, navigate]);

  if (!connected) return null;
  return <>{children}</>;
}
