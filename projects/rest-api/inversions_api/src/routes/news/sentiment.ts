// FIC: REST endpoints for news sentiment — explanatory analysis, never executes orders (Feature 006).
// FIC: Endpoints REST de sentimiento de noticias — analisis explicativo, nunca ejecuta ordenes (Feature 006).

import { Router } from "express";
import { InvestmentAdvisor } from "../../modules/news/investmentAdvisor";
import { URLAnalysisService } from "../../modules/news/urlAnalysisService";
import { respondError } from "../../modules/indicators/errors";

const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,10}$/;

export function createNewsSentimentRouter(
  advisor: InvestmentAdvisor = new InvestmentAdvisor(),
  urlService: URLAnalysisService = new URLAnalysisService()
): Router {
  const router = Router();

  // FIC: GET /api/news/sentiment/:symbol — consolidated sentiment + explanatory verdict.
  // FIC: GET /api/news/sentiment/:symbol — sentimiento consolidado + veredicto explicativo.
  router.get("/sentiment/:symbol", async (req, res) => {
    const symbol = String(req.params.symbol ?? "").toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) {
      return respondError(
        res,
        400,
        "invalid_symbol",
        "Simbolo invalido.",
        'Use 1-10 caracteres alfanumericos. Ejemplo: "AAPL"'
      );
    }
    try {
      const verdict = await advisor.evaluate(symbol);
      return res.status(200).json(verdict);
    } catch (err) {
      console.error("[NewsSentiment] Error:", err);
      return respondError(res, 500, "sentiment_error", "Error al evaluar el sentimiento.");
    }
  });

  // FIC: POST /api/news/analyze-url — analyze a custom source URL against a company.
  // FIC: POST /api/news/analyze-url — analiza una URL de fuente personalizada contra una empresa.
  router.post("/analyze-url", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";

    if (!url || !/^https?:\/\//i.test(url)) {
      return respondError(res, 400, "invalid_url", "El campo 'url' debe ser una URL http(s) valida.");
    }
    if (!company) {
      return respondError(res, 400, "missing_company", "El campo 'company' es obligatorio.");
    }

    try {
      const content = await urlService.fetchURLContent(url, company);
      const result = await urlService.analyzeSourceImpact(content, company);
      return res.status(200).json(result);
    } catch (err) {
      console.error("[NewsSentiment] URL error:", err);
      return respondError(res, 502, "url_fetch_error", "No fue posible obtener o analizar la URL.");
    }
  });

  return router;
}

export const newsSentimentRouter = createNewsSentimentRouter();
