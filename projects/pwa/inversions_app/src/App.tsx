import React, { useState, useEffect, useCallback } from "react";
import { MainDashboard } from "./features/dashboard/MainDashboard";
import { StrategyLab } from "./features/strategies/StrategyLab";

type Route = "dashboard" | "strategy-lab";

function getRoute(): Route {
  const hash = window.location.hash.toLowerCase();
  if (hash.includes("strategy-lab")) return "strategy-lab";
  return "dashboard";
}

export function App() {
  const [route, setRoute] = useState<Route>(getRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigateToLab = useCallback(() => {
    window.location.hash = "#strategy-lab";
  }, []);

  const navigateToDashboard = useCallback(() => {
    window.location.hash = "";
  }, []);

  if (route === "strategy-lab") {
    return <StrategyLab onNavigateToDashboard={navigateToDashboard} />;
  }

  return <MainDashboard onNavigateToLab={navigateToLab} />;
}
