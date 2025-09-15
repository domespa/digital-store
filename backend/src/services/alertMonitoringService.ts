import {
  PrismaClient,
  BusinessModel,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from "../generated/prisma";
import { SupportAnalyticsService } from "./supportAnalyticsService";
import { RealTimeAnalyticsService } from "./realtimeAnalyticsService";
import WebSocketService from "./websocketService";
import {
  AnalyticsAlert,
  AlertRule,
  AnalyticsHealthCheck,
  MetricCalculation,
  KPITarget,
} from "../types/support";
import {
  NotificationPriority,
  NotificationPayload,
} from "../types/notifications";
import { logger } from "../utils/logger";
import EmailService from "./emailService";
import { unknown } from "zod";

export class AlertService {
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, AnalyticsAlert>();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaClient,
    private analyticsService: SupportAnalyticsService,
    private realTimeService: RealTimeAnalyticsService,
    private websocketService: WebSocketService,
    private emailService?: EmailService
  ) {
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  // ===== ALERT RULES MANAGEMENT =====

  private initializeDefaultRules(): void {
    const defaultRules: Omit<AlertRule, "id" | "createdAt" | "updatedAt">[] = [
      {
        name: "SLA First Response Breach",
        type: "sla_breach",
        enabled: true,
        conditions: [
          {
            metric: "sla.firstResponseSLA.compliance",
            operator: "<",
            threshold: 80,
            timeWindow: 60, // 1 hour
          },
        ],
        actions: {
          email: ["admin@company.com"],
          webhook: process.env.SLACK_WEBHOOK_URL,
        },
        businessModel: BusinessModel.B2B_SALE,
        tenantId: undefined,
      },
      {
        name: "Volume Spike Alert",
        type: "volume_spike",
        enabled: true,
        conditions: [
          {
            metric: "tickets.created.hourly",
            operator: ">",
            threshold: 50,
            timeWindow: 60,
          },
        ],
        actions: {
          email: ["support-manager@company.com"],
        },
        businessModel: BusinessModel.SAAS_MULTITENANT,
        tenantId: undefined,
      },
      {
        name: "Satisfaction Drop",
        type: "satisfaction_drop",
        enabled: true,
        conditions: [
          {
            metric: "satisfaction.average",
            operator: "<",
            threshold: 3.0,
            timeWindow: 1440, // 24 hours
          },
        ],
        actions: {
          email: ["quality@company.com"],
        },
        businessModel: BusinessModel.MARKETPLACE_PLATFORM,
        tenantId: undefined,
      },
      {
        name: "Agent Overload",
        type: "agent_overload",
        enabled: true,
        conditions: [
          {
            metric: "agents.workload.average",
            operator: ">",
            threshold: 85,
            timeWindow: 120, // 2 hours
          },
        ],
        actions: {
          email: ["hr@company.com"],
        },
        businessModel: BusinessModel.B2B_SALE,
        tenantId: undefined,
      },
    ];

    defaultRules.forEach((rule, index) => {
      const alertRule: AlertRule = {
        ...rule,
        id: `default-rule-${index}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.alertRules.set(alertRule.id, alertRule);
    });
  }

  async createAlertRule(
    rule: Omit<AlertRule, "id" | "createdAt" | "updatedAt">
  ): Promise<AlertRule> {
    const alertRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.alertRules.set(alertRule.id, alertRule);

    // In a real implementation, save to database
    logger.info(`Alert rule created: ${alertRule.name}`);
    return alertRule;
  }

  async updateAlertRule(
    ruleId: string,
    updates: Partial<Omit<AlertRule, "id" | "createdAt" | "updatedAt">>
  ): Promise<AlertRule> {
    const existingRule = this.alertRules.get(ruleId);
    if (!existingRule) {
      throw new Error("Alert rule not found");
    }

    const updatedRule: AlertRule = {
      ...existingRule,
      ...updates,
      updatedAt: new Date(),
    };

    this.alertRules.set(ruleId, updatedRule);
    logger.info(`Alert rule updated: ${updatedRule.name}`);
    return updatedRule;
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    if (!this.alertRules.has(ruleId)) {
      throw new Error("Alert rule not found");
    }

    this.alertRules.delete(ruleId);
    logger.info(`Alert rule deleted: ${ruleId}`);
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  // ===== MONITORING ENGINE =====

  private startMonitoring(): void {
    // Run monitoring every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runMonitoringCycle();
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error("Monitoring cycle failed:", error);
        } else {
          logger.error("Errore sconosciuto:");
        }
      }
    }, 5 * 60 * 1000);

    logger.info("Alert monitoring started");
  }

  private async runMonitoringCycle(): Promise<void> {
    const configs = await this.prisma.supportConfig.findMany({
      select: { businessModel: true, tenantId: true },
    });

    for (const config of configs) {
      await this.evaluateAlertsForConfig(config.businessModel, config.tenantId);
    }

    // Clean up resolved alerts
    await this.cleanupResolvedAlerts();
  }

  private async evaluateAlertsForConfig(
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<void> {
    const relevantRules = Array.from(this.alertRules.values()).filter(
      (rule) =>
        rule.enabled &&
        rule.businessModel === businessModel &&
        (rule.tenantId === tenantId || rule.tenantId === null)
    );

    for (const rule of relevantRules) {
      try {
        const shouldAlert = await this.evaluateRule(
          rule,
          businessModel,
          tenantId
        );
        if (shouldAlert) {
          await this.triggerAlert(rule, businessModel, tenantId);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error(`Failed to evaluate rule ${rule.name}:`, error);
        } else {
          logger.error("Errore sconosciuto:");
        }
      }
    }
  }

  private async evaluateRule(
    rule: AlertRule,
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<boolean> {
    const now = new Date();
    const timeWindowStart = new Date(
      now.getTime() - rule.conditions[0].timeWindow * 60 * 1000
    );

    const metrics = await this.calculateMetrics(businessModel, tenantId, {
      from: timeWindowStart,
      to: now,
    });

    // Check if all conditions are met
    return rule.conditions.every((condition) => {
      const value = this.getMetricValue(metrics, condition.metric);
      return this.evaluateCondition(
        value,
        condition.operator,
        condition.threshold
      );
    });
  }

  private async calculateMetrics(
    businessModel: BusinessModel,
    tenantId: string | null,
    dateRange: { from: Date; to: Date }
  ): Promise<Record<string, number>> {
    const [overview, slaMetrics, agentPerformance, realTimeMetrics] =
      await Promise.all([
        this.analyticsService.getOverview(businessModel, tenantId, dateRange),
        this.analyticsService.getSLAMetrics(businessModel, tenantId, dateRange),
        this.analyticsService.getAgentPerformance(businessModel, tenantId),
        this.realTimeService.getCurrentMetrics(businessModel, tenantId),
      ]);

    return {
      // Overview metrics
      "tickets.total": overview.totalTickets,
      "tickets.open": overview.openTickets,
      "tickets.resolved": overview.resolvedTickets,
      "response.time.avg": overview.avgResponseTime,
      "satisfaction.average": overview.satisfactionRating,

      // SLA metrics
      "sla.firstResponseSLA.compliance": slaMetrics.firstResponseSLA.compliance,
      "sla.resolutionSLA.compliance": slaMetrics.resolutionSLA.compliance,
      "sla.breaches.total":
        slaMetrics.firstResponseSLA.breaches +
        slaMetrics.resolutionSLA.breaches,

      // Agent metrics
      "agents.workload.average":
        agentPerformance.length > 0
          ? agentPerformance.reduce(
              (sum, agent) => sum + agent.workloadScore,
              0
            ) / agentPerformance.length
          : 0,
      "agents.satisfaction.average":
        agentPerformance.length > 0
          ? agentPerformance.reduce(
              (sum, agent) => sum + agent.satisfactionRating,
              0
            ) / agentPerformance.length
          : 0,

      // Real-time metrics
      "tickets.created.hourly": realTimeMetrics.todayTickets,
      "tickets.pending": realTimeMetrics.pendingTickets,
      "agents.online": realTimeMetrics.onlineAgents,
      "wait.time.avg": realTimeMetrics.avgWaitTime,
    };
  }

  private getMetricValue(
    metrics: Record<string, number>,
    metricPath: string
  ): number {
    return metrics[metricPath] || 0;
  }

  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number
  ): boolean {
    switch (operator) {
      case ">":
        return value > threshold;
      case "<":
        return value < threshold;
      case ">=":
        return value >= threshold;
      case "<=":
        return value <= threshold;
      case "==":
        return value === threshold;
      case "!=":
        return value !== threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(
    rule: AlertRule,
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<void> {
    const alertId = `${rule.id}-${Date.now()}`;

    // Check if similar alert is already active (avoid spam)
    const existingAlert = Array.from(this.activeAlerts.values()).find(
      (alert) =>
        alert.type === rule.type &&
        alert.businessModel === businessModel &&
        alert.tenantId === tenantId &&
        !alert.resolvedAt
    );

    if (existingAlert) {
      // Update existing alert timestamp instead of creating new one
      existingAlert.triggeredAt = new Date();
      return;
    }

    const alert: AnalyticsAlert = {
      id: alertId,
      type: rule.type,
      severity: this.determineSeverity(rule),
      title: rule.name,
      message: await this.generateAlertMessage(rule, businessModel, tenantId),
      businessModel,
      tenantId: tenantId || undefined,
      triggeredAt: new Date(),
      actionRequired: this.requiresAction(rule.type),
      suggestions: this.generateSuggestions(rule.type),
      metadata: {
        ruleId: rule.id,
        conditions: rule.conditions,
      },
    };

    this.activeAlerts.set(alertId, alert);

    // Execute alert actions
    await this.executeAlertActions(alert, rule);

    logger.warn(`Alert triggered: ${alert.title} (${alert.id})`);
  }

  private determineSeverity(rule: AlertRule): "info" | "warning" | "critical" {
    switch (rule.type) {
      case "sla_breach":
        return rule.conditions[0].threshold < 70 ? "critical" : "warning";
      case "volume_spike":
        return rule.conditions[0].threshold > 100 ? "critical" : "warning";
      case "satisfaction_drop":
        return rule.conditions[0].threshold < 2.5 ? "critical" : "warning";
      case "agent_overload":
        return rule.conditions[0].threshold > 90 ? "critical" : "warning";
      default:
        return "info";
    }
  }

  private async generateAlertMessage(
    rule: AlertRule,
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<string> {
    const metrics = await this.calculateMetrics(businessModel, tenantId, {
      from: new Date(Date.now() - 60 * 60 * 1000),
      to: new Date(),
    });

    const condition = rule.conditions[0];
    const currentValue = this.getMetricValue(metrics, condition.metric);

    return `${rule.name}: Current value ${currentValue.toFixed(2)} ${
      condition.operator
    } threshold ${condition.threshold}`;
  }

  private requiresAction(type: AnalyticsAlert["type"]): boolean {
    return ["sla_breach", "volume_spike", "agent_overload"].includes(type);
  }

  private generateSuggestions(type: AnalyticsAlert["type"]): string[] {
    const suggestions = {
      sla_breach: [
        "Review agent capacity and workload distribution",
        "Consider implementing auto-assignment rules",
        "Check for bottlenecks in the resolution process",
        "Increase priority for urgent tickets",
      ],
      volume_spike: [
        "Monitor for potential service issues causing increased tickets",
        "Consider activating additional support agents",
        "Review and activate emergency response procedures",
        "Implement temporary priority filtering",
      ],
      satisfaction_drop: [
        "Review recent agent interactions and feedback",
        "Conduct quality assurance audits",
        "Check for system issues affecting user experience",
        "Implement additional agent training",
      ],
      agent_overload: [
        "Redistribute workload among available agents",
        "Consider hiring additional support staff",
        "Implement priority-based task assignment",
        "Review and optimize support processes",
      ],
    };

    return (
      suggestions[type] || [
        "Review system performance and take appropriate action",
      ]
    );
  }

  private async executeAlertActions(
    alert: AnalyticsAlert,
    rule: AlertRule
  ): Promise<void> {
    // WebSocket notification to admin channel
    await this.websocketService.sendNotificationToChannel("admin", {
      id: alert.id,
      type: "SUPPORT_ALERT",
      title: alert.title,
      message: alert.message,
      priority: this.mapSeverityToPriority(alert.severity),

      data: {
        alert,
        category: "ADMIN",
        suggestions: alert.suggestions,
      },
      createdAt: alert.triggeredAt,
    });

    // Email notifications
    if (rule.actions.email && this.emailService) {
      for (const email of rule.actions.email) {
        try {
          await this.emailService.sendEmail({
            to: email,
            subject: `Support Alert: ${alert.title}`,
            html: this.generateAlertEmailHtml(alert, rule),
          });
        } catch (error: unknown) {
          if (error instanceof Error) {
            logger.error(`Failed to send alert email to ${email}:`, error);
          } else {
            logger.error(`Errore sconosciuto`);
          }
        }
      }
    }

    // Webhook notifications (e.g., Slack)
    if (rule.actions.webhook) {
      try {
        await this.sendWebhookNotification(rule.actions.webhook, alert);
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error("Failed to send webhook notification:", error);
        } else {
          logger.error(`Errore sconosciuto`);
        }
      }
    }
  }

  private mapSeverityToPriority(severity: string): NotificationPriority {
    switch (severity) {
      case "critical":
        return NotificationPriority.URGENT;
      case "warning":
        return NotificationPriority.HIGH;
      case "info":
        return NotificationPriority.NORMAL;
      default:
        return NotificationPriority.NORMAL;
    }
  }

  private generateAlertEmailHtml(
    alert: AnalyticsAlert,
    rule: AlertRule
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${this.getSeverityColor(
          alert.severity
        )}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🚨 Support Alert</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd;">
          <h2 style="color: #333;">${alert.title}</h2>
          <p><strong>Severity:</strong> <span style="color: ${this.getSeverityColor(
            alert.severity
          )}; text-transform: uppercase;">${alert.severity}</span></p>
          <p><strong>Business Model:</strong> ${alert.businessModel}</p>
          ${
            alert.tenantId
              ? `<p><strong>Tenant:</strong> ${alert.tenantId}</p>`
              : ""
          }
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Triggered At:</strong> ${alert.triggeredAt.toLocaleString()}</p>
          
          <h3>Suggested Actions:</h3>
          <ul>
            ${alert.suggestions
              .map((suggestion) => `<li>${suggestion}</li>`)
              .join("")}
          </ul>
          
          <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff;">
            <p style="margin: 0;"><strong>Alert Rule:</strong> ${rule.name}</p>
            <p style="margin: 5px 0 0 0;"><small>Rule ID: ${rule.id}</small></p>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; background-color: #f8f9fa; border-top: 1px solid #ddd;">
          <p style="margin: 0; color: #6c757d; font-size: 12px;">
            This alert was automatically generated by the Support Analytics System
          </p>
        </div>
      </div>
    `;
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case "critical":
        return "#dc3545";
      case "warning":
        return "#ffc107";
      case "info":
        return "#17a2b8";
      default:
        return "#6c757d";
    }
  }

  private async sendWebhookNotification(
    webhookUrl: string,
    alert: AnalyticsAlert
  ): Promise<void> {
    // Implement webhook sending (e.g., for Slack)
    const payload = {
      text: `🚨 *Support Alert: ${alert.title}*`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            {
              title: "Severity",
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: "Business Model",
              value: alert.businessModel,
              short: true,
            },
            {
              title: "Message",
              value: alert.message,
              short: false,
            },
          ],
          footer: "Support Analytics System",
          ts: Math.floor(alert.triggeredAt.getTime() / 1000),
        },
      ],
    };

    // In a real implementation, use fetch or axios to send to webhook
    logger.info(`Would send webhook notification to ${webhookUrl}:`, payload);
  }

  private async cleanupResolvedAlerts(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const alertsToRemove: string[] = [];

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.resolvedAt && alert.resolvedAt < oneHourAgo) {
        alertsToRemove.push(alertId);
      }
    }

    alertsToRemove.forEach((alertId) => {
      this.activeAlerts.delete(alertId);
    });

    if (alertsToRemove.length > 0) {
      logger.info(`Cleaned up ${alertsToRemove.length} resolved alerts`);
    }
  }

  // ===== ALERT MANAGEMENT =====

  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    alert.resolvedAt = new Date();
    alert.metadata = {
      ...alert.metadata,
      resolvedBy,
    };

    // Notify resolution
    const notification: NotificationPayload = {
      id: `resolved-${alertId}`,
      type: "SYSTEM_NOTIFICATION",
      title: "Alert Resolved",
      message: `Alert "${alert.title}" has been resolved`,
      priority: NotificationPriority.LOW,
      data: { alert },
      createdAt: new Date(),
    };

    await this.websocketService.sendNotificationToChannel(
      "admin",
      notification
    );

    logger.info(`Alert resolved: ${alert.title} (${alertId})`);
  }

  getActiveAlerts(): AnalyticsAlert[] {
    return Array.from(this.activeAlerts.values()).filter(
      (alert) => !alert.resolvedAt
    );
  }

  getAlertHistory(limit: number = 100): AnalyticsAlert[] {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
      .slice(0, limit);
  }

  // ===== CLEANUP =====

  cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    logger.info("Alert service cleanup completed");
  }
}

// ===== ANALYTICS MONITORING SERVICE =====

export class AnalyticsMonitoringService {
  constructor(
    private prisma: PrismaClient,
    private analyticsService: SupportAnalyticsService,
    private alertService: AlertService
  ) {}

  async performHealthCheck(): Promise<AnalyticsHealthCheck> {
    try {
      const [dataHealth, systemHealth, performanceHealth] = await Promise.all([
        this.checkDataHealth(),
        this.checkSystemHealth(),
        this.checkPerformanceHealth(),
      ]);

      let overallStatus: "healthy" | "degraded" | "unhealthy";
      const issues = [
        ...dataHealth.issues,
        ...systemHealth.issues,
        ...performanceHealth.issues,
      ];

      if (issues.length === 0) {
        overallStatus = "healthy";
      } else if (issues.some((issue) => issue.severity === "critical")) {
        overallStatus = "unhealthy";
      } else {
        overallStatus = "degraded";
      }

      return {
        status: overallStatus,
        details: {
          latestHourlyData: dataHealth.latestHourlyData,
          latestDailyData: dataHealth.latestDailyData,
          missingHours: dataHealth.missingHours,
          missingDays: dataHealth.missingDays,
          totalRecords: dataHealth.totalRecords,
        },
        recommendations: this.generateRecommendations(issues),
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error("Health check failed:", error);
      }
      return {
        status: "unhealthy",
        details: {
          latestHourlyData: null,
          latestDailyData: null,
          missingHours: -1,
          missingDays: -1,
          totalRecords: -1,
        },
        recommendations: [
          "System health check failed - investigate immediately",
        ],
      };
    }
  }

  private async checkDataHealth(): Promise<{
    latestHourlyData: Date | null;
    latestDailyData: Date | null;
    missingHours: number;
    missingDays: number;
    totalRecords: number;
    issues: Array<{ type: string; severity: string; message: string }>;
  }> {
    const issues = [];

    const [latestHourly, latestDaily, totalRecords] = await Promise.all([
      this.prisma.supportAnalytics.findFirst({
        where: { hour: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { date: true, hour: true },
      }),
      this.prisma.supportAnalytics.findFirst({
        where: { hour: null },
        orderBy: { createdAt: "desc" },
        select: { date: true },
      }),
      this.prisma.supportAnalytics.count(),
    ]);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const latestHourlyDate = latestHourly
      ? new Date(
          latestHourly.date.getTime() + latestHourly.hour! * 60 * 60 * 1000
        )
      : null;

    const missingHours = latestHourlyDate
      ? Math.max(
          0,
          Math.floor(
            (oneHourAgo.getTime() - latestHourlyDate.getTime()) /
              (60 * 60 * 1000)
          )
        )
      : 24;

    const missingDays = latestDaily
      ? Math.max(
          0,
          Math.floor(
            (oneDayAgo.getTime() - latestDaily.date.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : 7;

    // Check for data freshness issues
    if (missingHours > 6) {
      issues.push({
        type: "data_freshness",
        severity: "critical",
        message: `Hourly data is ${missingHours} hours behind`,
      });
    } else if (missingHours > 2) {
      issues.push({
        type: "data_freshness",
        severity: "warning",
        message: `Hourly data is ${missingHours} hours behind`,
      });
    }

    if (missingDays > 3) {
      issues.push({
        type: "data_freshness",
        severity: "critical",
        message: `Daily data is ${missingDays} days behind`,
      });
    } else if (missingDays > 1) {
      issues.push({
        type: "data_freshness",
        severity: "warning",
        message: `Daily data is ${missingDays} days behind`,
      });
    }

    return {
      latestHourlyData: latestHourlyDate,
      latestDailyData: latestDaily?.date || null,
      missingHours,
      missingDays,
      totalRecords,
      issues,
    };
  }

  private async checkSystemHealth(): Promise<{
    issues: Array<{ type: string; severity: string; message: string }>;
  }> {
    const issues = [];

    try {
      // Check database connectivity
      await this.prisma.$queryRaw`SELECT 1`;

      // Check if critical tables exist and have data
      const ticketCount = await this.prisma.supportTicket.count();
      const configCount = await this.prisma.supportConfig.count();

      if (configCount === 0) {
        issues.push({
          type: "configuration",
          severity: "warning",
          message: "No support configurations found",
        });
      }

      // Check for recent activity
      const recentTickets = await this.prisma.supportTicket.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (ticketCount > 0 && recentTickets === 0) {
        issues.push({
          type: "activity",
          severity: "info",
          message: "No recent ticket activity in the last 24 hours",
        });
      }
    } catch (error) {
      issues.push({
        type: "database",
        severity: "critical",
        message: `Database connectivity issue: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }

    return { issues };
  }

  private async checkPerformanceHealth(): Promise<{
    issues: Array<{ type: string; severity: string; message: string }>;
  }> {
    const issues = [];

    try {
      // Test query performance
      const startTime = Date.now();
      await this.prisma.supportTicket.findFirst({
        include: {
          user: true,
          slaConfig: true,
        },
      });
      const queryTime = Date.now() - startTime;

      if (queryTime > 1000) {
        issues.push({
          type: "performance",
          severity: "warning",
          message: `Database queries are slow (${queryTime}ms)`,
        });
      }

      // Check for large table sizes that might affect performance
      const analyticsCount = await this.prisma.supportAnalytics.count();
      if (analyticsCount > 100000) {
        issues.push({
          type: "performance",
          severity: "info",
          message: `Analytics table has ${analyticsCount} records - consider archiving old data`,
        });
      }
    } catch (error) {
      issues.push({
        type: "performance",
        severity: "warning",
        message: `Performance check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }

    return { issues };
  }

  private generateRecommendations(
    issues: Array<{ type: string; severity: string; message: string }>
  ): string[] {
    const recommendations = [];

    const criticalIssues = issues.filter(
      (issue) => issue.severity === "critical"
    );
    const warningIssues = issues.filter(
      (issue) => issue.severity === "warning"
    );

    if (criticalIssues.length > 0) {
      recommendations.push("Address critical issues immediately");
    }

    if (issues.some((issue) => issue.type === "data_freshness")) {
      recommendations.push(
        "Check analytics job scheduler and ensure jobs are running"
      );
    }

    if (issues.some((issue) => issue.type === "database")) {
      recommendations.push("Check database connectivity and server status");
    }

    if (issues.some((issue) => issue.type === "performance")) {
      recommendations.push(
        "Consider database optimization or infrastructure scaling"
      );
    }

    if (warningIssues.length > 0 && criticalIssues.length === 0) {
      recommendations.push("Monitor warning conditions and plan maintenance");
    }

    return recommendations.length > 0
      ? recommendations
      : ["System appears healthy - continue regular monitoring"];
  }

  async generateHealthReport(): Promise<{
    timestamp: Date;
    healthCheck: AnalyticsHealthCheck;
    systemMetrics: {
      uptime: number;
      activeAlerts: number;
      processingQueue: number;
    };
  }> {
    const healthCheck = await this.performHealthCheck();
    const activeAlerts = this.alertService.getActiveAlerts();

    return {
      timestamp: new Date(),
      healthCheck,
      systemMetrics: {
        uptime: process.uptime(),
        activeAlerts: activeAlerts.length,
        processingQueue: 0, // Would track background job queue in real implementation
      },
    };
  }
}
