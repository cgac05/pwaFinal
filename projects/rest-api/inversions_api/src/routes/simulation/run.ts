// FIC: REST POST /api/simulation/run — Phase 5 EJECUTAR SIMULACION (Kevin, TEAM-02).
// FIC: Endpoint REST POST /api/simulation/run — botón EJECUTAR SIMULACION del PDF v1 (FR-015, US6).

import { Router } from "express";
import { respondError } from "../../modules/indicators/errors";
import { runSimulation, validateSimulationRequest } from "../../modules/simulation/runner";
import { persistSimulationRun } from "../../modules/simulation/persistence";
import type { SimulationRequest } from "../../modules/indicators/types";
import {
  getInstitutionalRouteContext,
  buildInstitutionalContractForSimulation,
} from "../institutional/bootstrap";

export const simulationRunRouter = Router();

simulationRunRouter.post("/run", async (req, res) => {
  const validation = validateSimulationRequest(req.body);
  if (validation) {
    return respondError(res, 400, validation.error_code, validation.message, validation.hint);
  }
  const request = req.body as SimulationRequest;

  try {
    const institutionalContext = request.coresHabilitados.includes("A_INSTITUCIONAL")
      ? { ...getInstitutionalRouteContext(), buildContract: buildInstitutionalContractForSimulation }
      : undefined;

    const result = await runSimulation(request, { institutionalContext });
    // FIC: T088 — best-effort persistence; never blocks the response.
    void persistSimulationRun(result, req.authContext?.userId);
    return res.status(200).json(result);
  } catch (err) {
    return respondError(
      res,
      500,
      "SIMULATION_FAILED",
      err instanceof Error ? err.message : "Error desconocido en la simulacion."
    );
  }
});
