import "dotenv/config";
import express from "express";
import { initializeEnvironment } from "./config/environment";
import { printValidationResult, validateEnvironment } from "./config/envValidator";
import { createAuditHistoryRouter } from "./routes/audit/history";
import { createOperationDetailRouter } from "./routes/audit/operationDetail";
import { createApprovalRouter } from "./routes/execution/approve";
import { createExecutionRouter } from "./routes/execution/execute";
import { AuditHistoryService } from "./modules/audit/historyService";
import { ApprovalService } from "./modules/execution/approvalService";
import { ExecutionService } from "./modules/execution/executionService";
import { signalDetailsRouter } from "./routes/signals/details";
import { signalEvaluateRouter } from "./routes/signals/evaluate";
import { signalConfluenceRouter } from "./routes/signals/confluence";
import { dashboardOrchestratorRouter } from "./routes/dashboard/orchestrator";
import confluenceViewPresetsRouter from "./routes/dashboard/confluenceViewPresets";
import { watchlistRouter } from "./routes/watchlist";
import { runtimeModeRouter } from "./routes/runtime/runtimeMode";
import { instrumentsCatalogRouter } from "./routes/catalogs/instruments";
import { brokerCapabilitiesRouter } from "./routes/brokers/capabilities";
import { marketDataOhlcRouter } from "./routes/market-data/ohlc";
import { marketQuotesRouter } from "./routes/market/quotes";
import { indicatorsCatalogRouter } from "./routes/indicators/catalog";
import { rsiRouter } from "./routes/indicators/rsi";
import { macdRouter } from "./routes/indicators/macd";
import { emaRouter } from "./routes/indicators/ema";
import { adxRouter } from "./routes/indicators/adx";
import { bollingerRouter } from "./routes/indicators/bollinger";
import { indicatorsConfluenceRouter } from "./routes/indicators/confluence";
import { indicatorsHealthRouter } from "./routes/indicators/health";
import { chatExplainRouter } from "./routes/indicators/chatExplain";
import { technicalAnalysisRouter } from "./routes/indicators/technicalAnalysis";
import { confluenceTableRouter } from "./routes/signals/confluenceTable";
import { simulationRunRouter } from "./routes/simulation/run";
import { indicatorsRateLimit, chatRateLimit } from "./middleware/indicatorsRateLimit";
import { institutionalAnalysisRouter } from "./routes/institutional/institutionalAnalysis";
import { regulatoryPositionsRouter } from "./routes/institutional/regulatoryPositions";
import { institutionalCopilotRouter } from "./routes/ai/institutionalCopilot";
import volatilityAnalysisRouter from "./routes/ai/volatilityAnalysis";
import { coverageAnalyzeRouter } from "./routes/coverage/analyze";
import { coverageCompareRouter } from "./routes/coverage/compare";
import { coverageSimulateRouter } from "./routes/coverage/simulate";
import { optionChainRouter } from "./routes/options/chain";
import { optionExpirationsRouter } from "./routes/options/expirations";
import { supabaseClient } from "./database/supabase/client";
import { calendarSpreadRouter } from "./routes/strategies/term/calendarSpread";
import { diagonalSpreadRouter } from "./routes/strategies/term/diagonalSpread";
import { createFundamentalAnalyzeRouter } from "./routes/fundamental/analyze";
import { createCompanyProfileRouter } from "./routes/fundamental/companyProfile";
import { createOptionsRouter } from "./routes/strategies/optionsRouter";
import { createOptionsAnalysisQARouter } from "./routes/strategies/optionsAnalysisQARouter";

const envValidation = validateEnvironment();
if (!envValidation.isValid) {
  console.error(printValidationResult(envValidation));
  process.exit(1);
}

if (envValidation.warnings.length > 0) {
  console.warn(printValidationResult(envValidation));
}

initializeEnvironment();

const app = express();
app.use(express.json());

const auditHistoryService = new AuditHistoryService();
const approvalService = new ApprovalService();
const executionService = new ExecutionService();

app.use("/api/signals", signalEvaluateRouter);
app.use("/api/signals", signalDetailsRouter);
app.use("/api/signals", signalConfluenceRouter);
app.use("/api/signals", indicatorsRateLimit, confluenceTableRouter);
app.use("/api/simulation", indicatorsRateLimit, simulationRunRouter);
app.use("/api/dashboard", dashboardOrchestratorRouter);
app.use("/api/dashboard", confluenceViewPresetsRouter);
app.use("/api/execution", createApprovalRouter(approvalService));
app.use("/api/execution", createExecutionRouter(executionService));
app.use("/api/audit", createAuditHistoryRouter(auditHistoryService));
app.use("/api/audit", createOperationDetailRouter());
app.use("/api/watchlist", watchlistRouter);
app.use("/api/runtime", runtimeModeRouter);
app.use("/api/catalogs", instrumentsCatalogRouter);
app.use("/api/brokers", brokerCapabilitiesRouter);
app.use("/api/market-data", marketDataOhlcRouter);
app.use("/api/market", marketQuotesRouter);
app.use("/api/indicators", indicatorsCatalogRouter);
app.use("/api/indicators", indicatorsRateLimit, rsiRouter);
app.use("/api/indicators", indicatorsRateLimit, macdRouter);
app.use("/api/indicators", indicatorsRateLimit, emaRouter);
app.use("/api/indicators", indicatorsRateLimit, adxRouter);
app.use("/api/indicators", indicatorsRateLimit, bollingerRouter);
app.use("/api/indicators", indicatorsRateLimit, indicatorsConfluenceRouter);
app.use("/api/indicators", indicatorsRateLimit, technicalAnalysisRouter);
app.use("/api/indicators", indicatorsHealthRouter);
app.use("/api/chat", chatRateLimit, chatExplainRouter);
app.use("/api/institutional", institutionalAnalysisRouter);
app.use("/api/institutional", regulatoryPositionsRouter);
app.use("/api/ai", institutionalCopilotRouter);
app.use("/api/ai/volatility", volatilityAnalysisRouter);
app.use("/api/coverage", coverageAnalyzeRouter);
app.use("/api/coverage", coverageCompareRouter);
app.use("/api/coverage", coverageSimulateRouter);
app.use("/api/options", indicatorsRateLimit, optionChainRouter);
app.use("/api/options", indicatorsRateLimit, optionExpirationsRouter);

// ── Team-03 routes ──────────────────────────────────────────────────
app.use("/api/team-03/fundamental", createFundamentalAnalyzeRouter(supabaseClient));
app.use("/api/team-03/fundamental", createCompanyProfileRouter(supabaseClient));
app.use("/api/team-03/options", createOptionsRouter(supabaseClient));
app.use("/api/team-03/options", createOptionsAnalysisQARouter(supabaseClient));

// ── Team-09 routes: Calendar & Diagonal Spreads ──────────────────────
app.use("/api/v1/strategies/term", calendarSpreadRouter);
app.use("/api/v1/strategies/term", diagonalSpreadRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Debug: list all registered routes (temporary helper)
app.get("/_debug/routes", (_req, res) => {
  const routes: Array<{ path: string; methods: string[] }> = [];
  const stack = (app as any)._router?.stack ?? [];
  for (const layer of stack) {
    if (layer.route && layer.route.path) {
      routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      for (const l of layer.handle.stack) {
        if (l.route && l.route.path) {
          // attempt to reconstruct mount path
          const prefix = layer.regexp && layer.regexp.source ? layer.regexp.source : '';
          routes.push({ path: `${prefix}${l.route.path}`, methods: Object.keys(l.route.methods) });
        }
      }
    }
  }
  res.json({ routes });
});
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Backend escuchando en puerto ${port}`);
});
