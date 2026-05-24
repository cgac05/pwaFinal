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
import newsSentimentRouter from './routes/news/sentiment';

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

app.use('/news/sentiment', newsSentimentRouter);
app.use("/api/signals", signalDetailsRouter);
app.use("/api/signals", signalConfluenceRouter);
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
app.use("/api/news", newsSentimentRouter);

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
