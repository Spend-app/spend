import Landing from "./pages/Landing";
import { createBrowserRouter } from "react-router-dom";

const router = createBrowserRouter([
  { path: "/", element: <Landing go={() => {}} /> },
]);

export default router;
