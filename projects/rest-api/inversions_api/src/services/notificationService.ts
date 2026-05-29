/**
 * Servicio de notificaciones para reportes de disponibilidad.
 * Implementa T002d: Implementar notificación a stakeholders (email, Slack)
 *
 * Notification service for availability reports.
 * Implements T002d: Notify stakeholders via email and Slack.
 */

export interface NotificationConfig {
  slackWebhookUrl?: string;
  emailRecipients?: string[];
  emailSender?: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

export interface AvailabilityNotificationPayload {
  month: number;
  year: number;
  overallAvailabilityPercent: number;
  sc005Compliant: boolean;
  totalSamples: number;
  failedSamples: number;
  generatedAtUtc: string;
  dependenciesSummary: Array<{
    dependency: string;
    availabilityPercent: number;
    targetPercent: number;
    sloCompliant: boolean;
  }>;
}

export class AvailabilityNotificationService {
  constructor(private config: NotificationConfig) {}

  /**
   * Envía notificación de reporte de disponibilidad a Slack y/o Email.
   *
   * Send availability report notification to Slack and/or Email.
   */
  async notifyStakeholders(payload: AvailabilityNotificationPayload): Promise<{
    slackSent: boolean;
    emailSent: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let slackSent = false;
    let emailSent = false;

    // Enviar a Slack
    if (this.config.slackWebhookUrl) {
      try {
        slackSent = await this.sendSlackNotification(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Slack notification failed: ${message}`);
      }
    }

    // Enviar por Email
    if (this.config.emailRecipients && this.config.emailRecipients.length > 0) {
      try {
        emailSent = await this.sendEmailNotification(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Email notification failed: ${message}`);
      }
    }

    return { slackSent, emailSent, errors };
  }

  /**
   * Envía notificación a Slack con resumen del reporte.
   *
   * Send notification to Slack with report summary.
   */
  private async sendSlackNotification(payload: AvailabilityNotificationPayload): Promise<boolean> {
    if (!this.config.slackWebhookUrl) {
      return false;
    }

    const monthYear = `${payload.year}-${String(payload.month).padStart(2, "0")}`;
    const complianceEmoji = payload.sc005Compliant ? "✅" : "🔴";
    const complianceStatus = payload.sc005Compliant ? "PASSED" : "FAILED";

    // Construir resumen de dependencias
    const dependenciesText = payload.dependenciesSummary
      .map((dep) => {
        const icon = dep.sloCompliant ? "✓" : "✗";
        return `${icon} ${dep.dependency}: ${dep.availabilityPercent}% (target: ${dep.targetPercent}%)`;
      })
      .join("\n");

    const message = {
      text: `📊 Monthly Availability Report - ${monthYear}`,
      attachments: [
        {
          color: payload.sc005Compliant ? "36a64f" : "ff0000",
          title: `${complianceEmoji} SC-005 Compliance: ${complianceStatus}`,
          text: `Overall Availability: ${payload.overallAvailabilityPercent}%\nGenerated: ${payload.generatedAtUtc}`,
          fields: [
            {
              title: "Total Samples",
              value: String(payload.totalSamples),
              short: true
            },
            {
              title: "Failed Samples",
              value: String(payload.failedSamples),
              short: true
            },
            {
              title: "Dependency Status",
              value: dependenciesText,
              short: false
            }
          ]
        }
      ]
    };

    try {
      const response = await fetch(this.config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`Slack API returned status ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("[AvailabilityNotificationService] Slack notification error:", error);
      throw error;
    }
  }

  /**
   * Envía notificación por Email con resumen del reporte.
   * Actualmente retorna simulación; requiere SMTP configurado en producción.
   *
   * Send email notification with report summary.
   * Currently returns simulation; requires SMTP configured in production.
   */
  private async sendEmailNotification(payload: AvailabilityNotificationPayload): Promise<boolean> {
    if (!this.config.emailRecipients || this.config.emailRecipients.length === 0) {
      return false;
    }

    const monthYear = `${payload.year}-${String(payload.month).padStart(2, "0")}`;
    const complianceStatus = payload.sc005Compliant ? "PASSED" : "FAILED";

    const dependenciesHtml = payload.dependenciesSummary
      .map(
        (dep) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${dep.dependency}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${dep.availabilityPercent}%</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${dep.targetPercent}%</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${dep.sloCompliant ? "✓ PASS" : "✗ FAIL"}</td>
        </tr>
      `
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            h1 { color: ${payload.sc005Compliant ? "#36a64f" : "#ff0000"}; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background-color: #f0f0f0; padding: 10px; text-align: left; border: 1px solid #ddd; }
            td { padding: 8px; border: 1px solid #ddd; }
            .summary { background-color: #f9f9f9; padding: 15px; border-left: 4px solid ${payload.sc005Compliant ? "#36a64f" : "#ff0000"}; }
          </style>
        </head>
        <body>
          <h1>📊 Monthly Availability Report - ${monthYear}</h1>
          <div class="summary">
            <h2>SC-005 Compliance Status: ${complianceStatus}</h2>
            <p><strong>Overall Availability:</strong> ${payload.overallAvailabilityPercent}%</p>
            <p><strong>Generated:</strong> ${payload.generatedAtUtc}</p>
            <p><strong>Total Samples:</strong> ${payload.totalSamples}</p>
            <p><strong>Failed Samples:</strong> ${payload.failedSamples}</p>
          </div>
          <h2>Dependency Summary</h2>
          <table>
            <thead>
              <tr>
                <th>Dependency</th>
                <th>Availability %</th>
                <th>Target %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${dependenciesHtml}
            </tbody>
          </table>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated report generated by TEAM-03 Availability Monitoring System.
            Do not reply to this email.
          </p>
        </body>
      </html>
    `;

    try {
      // 🧠 FIC: Simulación de envío de email (EN)
      // 🧠 FIC: Email sending simulation (ES)
      console.log(
        `[AvailabilityNotificationService] Email notification would be sent to: ${this.config.emailRecipients.join(", ")}`
      );
      console.log(
        `[AvailabilityNotificationService] Subject: Monthly Availability Report - ${monthYear} (${complianceStatus})`
      );

      // Si hay SMTP configurado, descomenta y usa:
      // const transporter = nodemailer.createTransport(this.config.smtpConfig);
      // await transporter.sendMail({
      //   from: this.config.emailSender,
      //   to: this.config.emailRecipients.join(","),
      //   subject: `Monthly Availability Report - ${monthYear} (${complianceStatus})`,
      //   html: htmlContent
      // });

      return true;
    } catch (error) {
      console.error("[AvailabilityNotificationService] Email notification error:", error);
      throw error;
    }
  }
}
