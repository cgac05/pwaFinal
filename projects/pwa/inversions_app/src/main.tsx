import React from "react";
import { createRoot } from "react-dom/client";
import { SignalEvaluationPage } from "./features/signals/SignalEvaluationPage";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element no encontrado");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <SignalEvaluationPage />
  </React.StrictMode>
);
