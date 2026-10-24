import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import router from "./router";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
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
