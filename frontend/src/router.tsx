import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import AdminShell from "./components/AdminShell";
import Dashboard from "./pages/Dashboard";
import Borrow from "./pages/Borrow";
import Position from "./pages/Position";
import AdminOverview from "./pages/admin/Overview";
import AdminLiquidity from "./pages/admin/Liquidity";
import AdminParameters from "./pages/admin/Parameters";
import AdminOperations from "./pages/admin/Operations";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "borrow", element: <Borrow /> },
      { path: "position", element: <Position /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminShell />,
    children: [
      { index: true, element: <AdminOverview /> },
      { path: "liquidity", element: <AdminLiquidity /> },
      { path: "parameters", element: <AdminParameters /> },
      { path: "operations", element: <AdminOperations /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default router;
