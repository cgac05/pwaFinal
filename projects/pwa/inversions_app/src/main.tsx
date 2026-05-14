import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { MainDashboard } from "./features/dashboard/MainDashboard";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element no encontrado");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <MainDashboard />
  </React.StrictMode>
);
