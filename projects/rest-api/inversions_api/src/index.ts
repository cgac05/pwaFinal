import "dotenv/config";
import express from "express";
import { initializeEnvironment } from "./config/environment.js";
import { printValidationResult, validateEnvironment } from "./config/envValidator.js";
import { createAuditHistoryRouter } from "./routes/audit/history.js";
import { createOperationDetailRouter } from "./routes/audit/operationDetail.js";
import { createApprovalRouter } from "./routes/execution/approve.js";
import { createExecutionRouter } from "./routes/execution/execute.js";
import { AuditHistoryService } from "./modules/audit/historyService.js";
import { ApprovalService } from "./modules/execution/approvalService.js";
import { ExecutionService } from "./modules/execution/executionService.js";
import { signalDetailsRouter } from "./routes/signals/details.js";
import { signalEvaluateRouter } from "./routes/signals/evaluate.js";
import { signalConfluenceRouter } from "./routes/signals/confluence.js";
import { dashboardOrchestratorRouter } from "./routes/dashboard/orchestrator.js";
import confluenceViewPresetsRouter from "./routes/dashboard/confluenceViewPresets.js";
import { watchlistRouter } from "./routes/watchlist/index.js";
import { runtimeModeRouter } from "./routes/runtime/runtimeMode.js";
import { instrumentsCatalogRouter } from "./routes/catalogs/instruments.js";
import { brokerCapabilitiesRouter } from "./routes/brokers/capabilities.js";
import { marketDataOhlcRouter } from "./routes/market-data/ohlc.js";
import { marketQuotesRouter } from "./routes/market/quotes.js";
import { indicatorsCatalogRouter } from "./routes/indicators/catalog.js";
import { institutionalAnalysisRouter } from "./routes/institutional/institutionalAnalysis.js";
import { regulatoryPositionsRouter } from "./routes/institutional/regulatoryPositions.js";
import institutionalCopilotRouter from "./routes/ai/institutionalCopilot.js";
import volatilityAnalysisRouter from "./routes/ai/volatilityAnalysis.js";
import { coverageAnalyzeRouter } from "./routes/coverage/analyze.js";
import { coverageCompareRouter } from "./routes/coverage/compare.js";
import { coverageSimulateRouter } from "./routes/coverage/simulate.js";
import { rsiRouter } from "./routes/indicators/rsi.js";
import { macdRouter } from "./routes/indicators/macd.js";
import { emaRouter } from "./routes/indicators/ema.js";
import { adxRouter } from "./routes/indicators/adx.js";
import { bollingerRouter } from "./routes/indicators/bollinger.js";
import { indicatorsConfluenceRouter } from "./routes/indicators/confluence.js";
import { indicatorsHealthRouter } from "./routes/indicators/health.js";
import { chatExplainRouter } from "./routes/indicators/chatExplain.js";
import { confluenceTableRouter } from "./routes/signals/confluenceTable.js";
import { simulationRunRouter } from "./routes/simulation/run.js";
import { indicatorsRateLimit, chatRateLimit } from "./middleware/indicatorsRateLimit.js";
import { createCompanyProfileRouter } from "./routes/fundamental/companyProfile.js";
import { createSp500ScreenerRouter } from "./routes/fundamental/sp500Screener.js";
import { createFundamentalAnalyzeRouter } from "./routes/fundamental/analyze.js";
import { createOptionsRouter } from "./routes/strategies/optionsRouter.js";
import { createOptionsAnalysisQARouter } from "./routes/strategies/optionsAnalysisQARouter.js";
import { createFundamentalCopilotRouter } from "./routes/ai/fundamentalCopilot.js";
import { supabaseClient } from "./database/supabase/client.js";
import { registerAuditRoutes } from "./routes/auditRoutes.js";

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

// T017-T020: Registrar rutas de auditoría y trazabilidad
registerAuditRoutes(app);

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
app.use("/api/institutional", institutionalAnalysisRouter);
app.use("/api/institutional", regulatoryPositionsRouter);
app.use("/api/ai", institutionalCopilotRouter);
app.use("/api/ai/volatility", volatilityAnalysisRouter);
app.use("/api/coverage", coverageAnalyzeRouter);
app.use("/api/coverage", coverageCompareRouter);
app.use("/api/coverage", coverageSimulateRouter);
app.use("/api/indicators", indicatorsRateLimit, rsiRouter);
app.use("/api/indicators", indicatorsRateLimit, macdRouter);
app.use("/api/indicators", indicatorsRateLimit, emaRouter);
app.use("/api/indicators", indicatorsRateLimit, adxRouter);
app.use("/api/indicators", indicatorsRateLimit, bollingerRouter);
app.use("/api/indicators", indicatorsRateLimit, indicatorsConfluenceRouter);
app.use("/api/indicators", indicatorsHealthRouter);
app.use("/api/chat", chatRateLimit, chatExplainRouter);
app.use("/api/team-03/fundamental", createFundamentalAnalyzeRouter(supabaseClient));
app.use("/api/team-03/fundamental", createCompanyProfileRouter(supabaseClient));
app.use("/api/team-03/screener/sp500", createSp500ScreenerRouter(supabaseClient));
app.use("/api/team-03/options", createOptionsRouter(supabaseClient));
app.use("/api/team-03/options", createOptionsAnalysisQARouter(supabaseClient));
app.use("/api/team-03/ai", createFundamentalCopilotRouter(supabaseClient));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Backend escuchando en puerto ${port}`);
});
