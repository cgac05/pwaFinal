// FIC: Regulatory positions route — 13F positions, flows, and source reports. (EN)
// FIC: Ruta de posiciones regulatorias — posiciones 13F, flujos y reportes de fuentes. (ES)

import { Router, type Request, type Response } from "express";
import { authContextMiddleware } from "../../middleware/authContext";
import {
  getInstitutionalRouteContext,
  buildInstitutionalAnalysisContractFromRequest,
  buildInstitutionalPositionsSummary,
} from "./bootstrap";

export const regulatoryPositionsRouter = Router();

// FIC: GET /api/institutional/positions — 13F positions with partial source degradation. (EN)
// FIC: GET /api/institutional/positions — posiciones 13F con degradación parcial de fuentes. (ES)
regulatoryPositionsRouter.get(
  "/positions",
  authContextMiddleware,
  async (req: Request, res: Response) => {
    const { dataService } = getInstitutionalRouteContext();

    const contract = buildInstitutionalAnalysisContractFromRequest(req);

    const resolved = await dataService.resolve(contract);

    if (resolved.overallStatus === "all_failed") {
      return res.status(503).json({ code: "ALL_SOURCES_UNAVAILABLE" });
    }

    const positionsSummary = buildInstitutionalPositionsSummary(contract);

    const sourceReports = resolved.observations.map((obs) => ({
      sourceId: obs.sourceId,
      status: obs.status,
      confidence: obs.confidence,
      asOf: obs.asOf,
    }));

    return res.status(200).json({
      ...positionsSummary,
      sourceReports,
      cacheHit: resolved.cacheHit,
      usedSourceIds: resolved.usedSourceIds,
      resolvedAt: resolved.resolvedAt,
    });
  }
);
