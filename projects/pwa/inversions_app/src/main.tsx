import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { MainDashboard } from "./features/dashboard/MainDashboard";
import { VolatilityAnalysisPage } from "./pages/ai/VolatilityAnalysisPage";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element no encontrado");
}

function AppRouter() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (hash === "#/ai/evaluacion-tabla") {
    return <VolatilityAnalysisPage />;
  }

  return <MainDashboard />;
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
