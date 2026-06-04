import { promises as fs } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AvailabilityDashboard,
  AvailabilitySloService
} from "../observability/availabilitySlo";
import {
  AvailabilityNotificationService,
  type NotificationConfig,
  type AvailabilityNotificationPayload
} from "../services/notificationService";

export interface MonthlyAvailabilityReportResult {
  reportPath: string;
  month: number;
  year: number;
  overallAvailabilityPercent: number;
  sc005Compliant: boolean;
  supabaseRecordId?: string; // ID del registro en Supabase, si se persiste
}

export interface MonthlyAvailabilityReportOptions {
  outputDir?: string;
  format?: "json" | "md";
  supabaseClient?: SupabaseClient; // Cliente Supabase para persistencia
  notificationConfig?: NotificationConfig; // Configuración para notificaciones Slack/Email (T002d)
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function renderMarkdown(report: AvailabilityDashboard): string {
  const lines: string[] = [];

  lines.push("# Monthly Availability Report");
  lines.push("");
  lines.push(`- Period: ${report.year}-${pad2(report.month)}`);
  lines.push(`- Generated At (UTC): ${report.generatedAtUtc}`);
  lines.push(`- Overall Availability: ${report.overallAvailabilityPercent}%`);
  lines.push(`- SC-005 Compliant: ${report.evidenceBoard.sc005Compliant ? "YES" : "NO"}`);
  lines.push("");

  lines.push("## Dependency Summary");
  lines.push("");
  lines.push("| Dependency | Availability % | Target % | SLO | Requests | Failures | P95 ms | Top Errors |");
  lines.push("|---|---:|---:|---|---:|---:|---:|---|");

  for (const item of report.dependencies) {
    const topErrors = item.topErrorCodes.length
      ? item.topErrorCodes.map((entry) => `${entry.errorCode}:${entry.count}`).join(", ")
      : "-";

    lines.push(
      `| ${item.dependency} | ${item.availabilityPercent} | ${item.targetPercent} | ${item.sloCompliant ? "PASS" : "FAIL"} | ${item.totalRequests} | ${item.failedRequests} | ${item.latency.p95Ms} | ${topErrors} |`
    );
  }

  lines.push("");
  lines.push("## Evidence Board");
  lines.push("");
  lines.push(`- Monthly Target: ${report.evidenceBoard.monthlyTargetPercent}%`);
  lines.push(`- Total Samples: ${report.evidenceBoard.totalSamples}`);
  lines.push(`- Failed Samples: ${report.evidenceBoard.failedSamples}`);
  for (const note of report.evidenceBoard.notes) {
    lines.push(`- ${note}`);
  }

  return lines.join("\n");
}

/**
 * Interfaz para el registro en Supabase de reportes mensuales de disponibilidad.
 * Implementa T002b: Agregar métricas diarias en tabla Supabase: monthly_availability_report
 *
 * Interface for Supabase record of monthly availability reports.
 * Implements T002b: Store monthly metrics in Supabase table.
 */
export interface SupabaseMonthlyAvailabilityRecord {
  id?: string; // Auto-generado por Supabase
  month: number;
  year: number;
  overall_availability_percent: number;
  sc005_compliant: boolean;
  total_samples: number;
  failed_samples: number;
  generated_at_utc: string;
  report_json: AvailabilityDashboard;
  dependencies_summary: Array<{
    dependency: string;
    availability_percent: number;
    target_percent: number;
    slo_compliant: boolean;
    error_budget_remaining_percent: number;
  }>;
  created_at?: string; // Timestamp automático
}

export class MonthlyAvailabilityReportJob {
  constructor(private readonly availabilitySloService: AvailabilitySloService) {}

  async run(
    year: number,
    month: number,
    options: MonthlyAvailabilityReportOptions = {}
  ): Promise<MonthlyAvailabilityReportResult> {
    const format = options.format ?? "json";
    const outputDir = options.outputDir ?? path.join(process.cwd(), "backend", "reports", "availability");

    const report = this.availabilitySloService.getDashboardForMonth(year, month);

    await fs.mkdir(outputDir, { recursive: true });

    const fileBaseName = `availability-${year}-${pad2(month)}`;
    const extension = format === "md" ? "md" : "json";
    const reportPath = path.join(outputDir, `${fileBaseName}.${extension}`);

    // 🧠 FIC: Persist monthly SLO evidence for audit and operational reviews (EN)
    // 🧠 FIC: Persistir evidencia mensual de SLO para auditoria y revisiones operativas (ES)
    if (format === "md") {
      await fs.writeFile(reportPath, renderMarkdown(report), "utf8");
    } else {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    }

    // 🧠 FIC: T002b - Persistir en Supabase si cliente disponible (EN)
    // 🧠 FIC: T002b - Persist in Supabase if client available (ES)
    let supabaseRecordId: string | undefined;
    if (options.supabaseClient) {
      supabaseRecordId = await this.persistToSupabase(report, options.supabaseClient);
    }

    // 🧠 FIC: Auditar generación del reporte (EN)
    // 🧠 FIC: Audit report generation (ES)
    if (options.supabaseClient) {
      await this.auditReportGeneration(year, month, report, options.supabaseClient);
    }

    // 🧠 FIC: T002d - Enviar notificaciones a stakeholders (EN)
    // 🧠 FIC: T002d - Send notifications to stakeholders (ES)
    if (options.notificationConfig) {
      await this.notifyStakeholders(report, options.notificationConfig);
    }

    return {
      reportPath,
      month,
      year,
      overallAvailabilityPercent: report.overallAvailabilityPercent,
      sc005Compliant: report.evidenceBoard.sc005Compliant,
      supabaseRecordId
    };
  }

  /**
   * Persiste el reporte consolidado en la tabla `monthly_availability_report` de Supabase.
   * Implementa T002b.
   *
   * Persist consolidated report to Supabase `monthly_availability_report` table.
   * Implements T002b.
   */
  private async persistToSupabase(
    report: AvailabilityDashboard,
    supabaseClient: SupabaseClient
  ): Promise<string | undefined> {
    try {
      const record: SupabaseMonthlyAvailabilityRecord = {
        month: report.month,
        year: report.year,
        overall_availability_percent: report.overallAvailabilityPercent,
        sc005_compliant: report.evidenceBoard.sc005Compliant,
        total_samples: report.evidenceBoard.totalSamples,
        failed_samples: report.evidenceBoard.failedSamples,
        generated_at_utc: report.generatedAtUtc,
        report_json: report,
        dependencies_summary: report.dependencies.map((dep) => ({
          dependency: dep.dependency,
          availability_percent: dep.availabilityPercent,
          target_percent: dep.targetPercent,
          slo_compliant: dep.sloCompliant,
          error_budget_remaining_percent: dep.errorBudgetRemainingPercent
        }))
      };

      const { data, error } = await supabaseClient
        .from("monthly_availability_report")
        .insert([record])
        .select("id");

      if (error) {
        console.error("[MonthlyAvailabilityReportJob] Error persisting to Supabase:", error);
        return undefined;
      }

      if (!data || data.length === 0) {
        console.error("[MonthlyAvailabilityReportJob] No data returned after insert");
        return undefined;
      }

      const recordId = data[0].id;
      console.log(
        `[MonthlyAvailabilityReportJob] Report persisted to Supabase with ID: ${recordId} (${report.year}-${pad2(report.month)})`
      );

      return recordId;
    } catch (error) {
      console.error("[MonthlyAvailabilityReportJob] Exception during Supabase persist:", error);
      return undefined;
    }
  }

  /**
   * Registra en la tabla de auditoría que se generó un reporte de disponibilidad.
   * Cumple con requisitos de auditoría SC-005 y PL-011.
   *
   * Record audit trail entry for report generation.
   * Meets SC-005 and PL-011 audit requirements.
   */
  private async auditReportGeneration(
    year: number,
    month: number,
    report: AvailabilityDashboard,
    supabaseClient: SupabaseClient
  ): Promise<void> {
    try {
      const auditEntry = {
        action: "availability_report_generated",
        details: {
          month,
          year,
          overall_availability_percent: report.overallAvailabilityPercent,
          sc005_compliant: report.evidenceBoard.sc005Compliant,
          total_samples: report.evidenceBoard.totalSamples
        },
        generated_by: "system",
        generated_at: report.generatedAtUtc,
        user_id: null // Sistema, no usuario
      };

      const { error } = await supabaseClient.from("audit_trail").insert([auditEntry]);

      if (error) {
        console.warn(
          "[MonthlyAvailabilityReportJob] Warning: Could not write audit trail:",
          error.message
        );
      }
    } catch (error) {
      console.warn("[MonthlyAvailabilityReportJob] Exception during audit trail write:", error);
      // No fallar el reporte por problemas de auditoría
    }
  }

  /**
   * Envía notificaciones a stakeholders a través de Slack y/o Email.
   * Implementa T002d: Implementar notificación a stakeholders (email, Slack)
   *
   * Send notifications to stakeholders via Slack and/or Email.
   * Implements T002d: Notify stakeholders via email and Slack.
   */
  private async notifyStakeholders(
    report: AvailabilityDashboard,
    notificationConfig: NotificationConfig
  ): Promise<void> {
    try {
      const notificationService = new AvailabilityNotificationService(notificationConfig);

      const payload: AvailabilityNotificationPayload = {
        month: report.month,
        year: report.year,
        overallAvailabilityPercent: report.overallAvailabilityPercent,
        sc005Compliant: report.evidenceBoard.sc005Compliant,
        totalSamples: report.evidenceBoard.totalSamples,
        failedSamples: report.evidenceBoard.failedSamples,
        generatedAtUtc: report.generatedAtUtc,
        dependenciesSummary: report.dependencies.map((dep) => ({
          dependency: dep.dependency,
          availabilityPercent: dep.availabilityPercent,
          targetPercent: dep.targetPercent,
          sloCompliant: dep.sloCompliant
        }))
      };

      const result = await notificationService.notifyStakeholders(payload);

      console.log("[MonthlyAvailabilityReportJob] Notification results:", {
        slackSent: result.slackSent,
        emailSent: result.emailSent,
        errors: result.errors
      });

      if (result.errors.length > 0) {
        console.warn("[MonthlyAvailabilityReportJob] Notification errors:", result.errors);
      }
    } catch (error) {
      console.error("[MonthlyAvailabilityReportJob] Exception during notification:", error);
      // No fallar el reporte por problemas de notificación
    }
  }
}
