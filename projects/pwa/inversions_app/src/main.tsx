import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { MainDashboard } from "./features/dashboard/MainDashboard";

import { VolatilityAnalysisPage } from "./pages/ai/VolatilityAnalysisPage";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element no encontrado");
}

const path = window.location.pathname;

createRoot(rootElement).render(
  <React.StrictMode>
    {path === "/ai/evaluacion-tabla" ? <VolatilityAnalysisPage /> : <MainDashboard />}
  </React.StrictMode>
);
