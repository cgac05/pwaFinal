import express from "express";
import { createAuditHistoryRouter } from "./routes/audit/history";
import { createOperationDetailRouter } from "./routes/audit/operationDetail";
import { createApprovalRouter } from "./routes/execution/approve";
import { createExecutionRouter } from "./routes/execution/execute";
import { AuditHistoryService } from "./modules/audit/historyService";
import { ApprovalService } from "./modules/execution/approvalService";
import { ExecutionService } from "./modules/execution/executionService";
import { signalDetailsRouter } from "./routes/signals/details";
import { signalEvaluateRouter } from "./routes/signals/evaluate";

const app = express();
app.use(express.json());

const auditHistoryService = new AuditHistoryService();
const approvalService = new ApprovalService();
const executionService = new ExecutionService();

app.use("/api/signals", signalEvaluateRouter);
app.use("/api/signals", signalDetailsRouter);
app.use("/api/execution", createApprovalRouter(approvalService));
app.use("/api/execution", createExecutionRouter(executionService));
app.use("/api/audit", createAuditHistoryRouter(auditHistoryService));
app.use("/api/audit", createOperationDetailRouter());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Backend escuchando en puerto ${port}`);
});
