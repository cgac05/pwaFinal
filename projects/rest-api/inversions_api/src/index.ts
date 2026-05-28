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
import { indicatorsCatalogRouter } from "./routes/indicators/catalog";
import { rsiRouter } from "./routes/indicators/rsi";
import { macdRouter } from "./routes/indicators/macd";
import { emaRouter } from "./routes/indicators/ema";
import { adxRouter } from "./routes/indicators/adx";
import { bollingerRouter } from "./routes/indicators/bollinger";
import { indicatorsConfluenceRouter } from "./routes/indicators/confluence";
import { indicatorsHealthRouter } from "./routes/indicators/health";
import { chatExplainRouter } from "./routes/indicators/chatExplain";
import { confluenceTableRouter } from "./routes/signals/confluenceTable";
import { simulationRunRouter } from "./routes/simulation/run";
import { indicatorsRateLimit, chatRateLimit } from "./middleware/indicatorsRateLimit";

// ── TEAM-08: Complex Strategy Routes ──
import { alpacaExecutionRouter } from "./routes/strategies/complex/alpacaExecutionRouter";
import { fromChainRouter } from "./routes/strategies/complex/fromChain";
import { optionsChainRouter } from "./routes/strategies/complex/optionsChain";

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
app.use("/api/indicators", indicatorsCatalogRouter);
app.use("/api/indicators", indicatorsRateLimit, rsiRouter);
app.use("/api/indicators", indicatorsRateLimit, macdRouter);
app.use("/api/indicators", indicatorsRateLimit, emaRouter);
app.use("/api/indicators", indicatorsRateLimit, adxRouter);
app.use("/api/indicators", indicatorsRateLimit, bollingerRouter);
app.use("/api/indicators", indicatorsRateLimit, indicatorsConfluenceRouter);
app.use("/api/indicators", indicatorsHealthRouter);
app.use("/api/chat", chatRateLimit, chatExplainRouter);

// ── TEAM-08: Complex Strategy Routes ──
app.use("/api/strategies/complex", optionsChainRouter);
app.use("/api/strategies/complex", fromChainRouter);
app.use("/api/strategies/complex", alpacaExecutionRouter);

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
