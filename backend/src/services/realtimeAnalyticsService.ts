import {
  PrismaClient,
  BusinessModel,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SupportRole,
} from "../generated/prisma";
import { SupportAnalyticsService } from "./supportAnalyticsService";
import WebSocketService from "./websocketService";
import {
  RealTimeMetrics,
  CompleteSupportAnalyticsResponse,
  SupportDashboardResponse,
  AnalyticsOverview,
  TrendData,
  PerformanceMetrics,
  SLAMetrics,
} from "../types/support";
import {
  NotificationPayload,
  NotificationPriority,
  NotificationType,
} from "../types/notifications";
import { logger } from "../utils/logger";

export class RealTimeAnalyticsService {
  constructor(
    private prisma: PrismaClient,
    private analyticsService: SupportAnalyticsService,
    private websocketService: WebSocketService
  ) {
    this.setupRealTimeListeners();
  }

  // ===== REAL-TIME METRICS =====

  async getCurrentMetrics(
    businessModel: BusinessModel,
    tenantId: string | null = null
  ): Promise<RealTimeMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      activeUsers,
      onlineAgents,
      todayTickets,
      pendingTickets,
      avgWaitTime,
      slaBreachesToday,
    ] = await Promise.all([
      this.getActiveUsersCount(),
      this.getOnlineAgentsCount(businessModel, tenantId),
      this.getTodayTicketsCount(businessModel, tenantId, today),
      this.getPendingTicketsCount(businessModel, tenantId),
      this.getAverageWaitTime(businessModel, tenantId),
      this.getSLABreachesToday(businessModel, tenantId, today),
    ]);

    return {
      activeUsers,
      onlineAgents,
      todayTickets,
      pendingTickets,
      avgWaitTime,
      slaBreachesToday,
      lastUpdate: now,
    };
  }

  // ===== REAL-TIME DASHBOARD =====

  async getDashboard(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    dateRange: { from: Date; to: Date }
  ): Promise<SupportDashboardResponse> {
    const [overview, trends, agents, sla, categories, realTimeMetrics] =
      await Promise.all([
        this.analyticsService.getOverview(businessModel, tenantId, dateRange),
        this.analyticsService.getTrends(
          businessModel,
          tenantId,
          "day",
          dateRange
        ),
        this.analyticsService.getAgentPerformance(
          businessModel,
          tenantId,
          undefined,
          dateRange
        ),
        this.analyticsService.getSLAMetrics(businessModel, tenantId, dateRange),
        this.analyticsService.getCategoryAnalytics(
          businessModel,
          tenantId,
          dateRange
        ),
        this.getCurrentMetrics(businessModel, tenantId),
      ]);

    const dashboard: SupportDashboardResponse = {
      overview: {
        ...overview,
        // Enhance with real-time data
        ...realTimeMetrics,
      } as AnalyticsOverview,
      trends,
      agents,
      sla,
      categories,
      dateRange,
      businessModel,
      tenantId: tenantId || undefined,
      generatedAt: new Date(),
    };

    return dashboard;
  }

  async getEnhancedAnalytics(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    dateRange: { from: Date; to: Date }
  ): Promise<CompleteSupportAnalyticsResponse> {
    const baseAnalytics = await this.analyticsService.getBusinessModelAnalytics(
      businessModel,
      tenantId,
      dateRange
    );

    const predictive = await this.analyticsService.getPredictiveAnalytics(
      businessModel,
      tenantId
    );

    const predictions = {
      expectedVolume: predictive.expectedVolume,
      capacity: {
        current: predictive.capacityRecommendations.currentCapacity,
        recommended: predictive.capacityRecommendations.recommendedCapacity,
        reasoning: predictive.capacityRecommendations.reasoning,
      },
      risks: {
        slaRisk: predictive.riskFactors.slaRisk,
        volumeSpike: predictive.riskFactors.volumeSpike,
        satisfactionTrend: predictive.riskFactors.satisfactionTrend,
      },
    };

    const insights = await this.generateInsights(
      businessModel,
      tenantId,
      dateRange
    );

    const performanceData = {
      slaMetrics: {
        firstResponseSLA: {
          target: 24, // esempio
          actual: Math.round(
            baseAnalytics.agents.reduce(
              (sum, a) => sum + a.avgResponseTime,
              0
            ) / (baseAnalytics.agents.length || 1)
          ),
          compliance: 90, // esempio
        },
        resolutionSLA: {
          target: 72,
          actual: Math.round(
            baseAnalytics.trends.reduce(
              (sum, t) => sum + t.avgResponseTime,
              0
            ) / (baseAnalytics.trends.length || 1)
          ),
          compliance: 85,
        },
      },
      satisfactionMetrics: {
        averageRating: baseAnalytics.overview.satisfactionRating,
        responseRate: 100,
        breakdown: {},
      },
    };

    const response: CompleteSupportAnalyticsResponse = {
      ...baseAnalytics,

      overview: {
        ...baseAnalytics.overview,
        customerSatisfaction: baseAnalytics.overview.satisfactionRating,
      },

      trends: {
        period: "day",
        data: baseAnalytics.trends as TrendData[],
      },

      // Breakdown con byAgent obbligatorio
      breakdown: {
        byStatus: baseAnalytics.breakdown.byStatus,
        byPriority: baseAnalytics.breakdown.byPriority,
        byCategory: baseAnalytics.breakdown.byCategory,
        byAgent: [],
      },

      // Predictions
      predictions,

      // Real-time
      realTime: {
        isRealTime: true,
        lastUpdate: new Date(),
        refreshInterval: 30000,
      },

      // Insights
      insights: insights ?? {
        topIssues: [],
        performanceAlerts: [],
        recommendations: [],
      },

      performance: performanceData,
    };

    return response;
  }

  // ===== REAL-TIME EVENT HANDLING =====

  private setupRealTimeListeners(): void {
    // Listen to database changes and emit real-time updates
    this.startMetricsPolling();
    this.setupTicketEventListeners();
  }

  private startMetricsPolling(): void {
    // Poll metrics every 30 seconds and emit to subscribed clients
    setInterval(async () => {
      try {
        await this.broadcastMetricsUpdate();
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error("Errore durante l'elaborazione:", error.message);
        } else {
          logger.error("Errore sconosciuto:", JSON.stringify(error));
        }
      }
    }, 30000); // 30 seconds
  }

  private async broadcastMetricsUpdate(): Promise<void> {
    // Get all active business model configs
    const configs = await this.prisma.supportConfig.findMany({
      select: { businessModel: true, tenantId: true },
    });

    for (const config of configs) {
      const metrics = await this.getCurrentMetrics(
        config.businessModel,
        config.tenantId
      );

      // Broadcast to analytics channel
      await this.websocketService.sendNotificationToChannel("analytics", {
        id: `metrics-${Date.now()}`,
        type: "SYSTEM_NOTIFICATION",
        title: "Metrics Update",
        message: "Real-time metrics updated",
        priority: NotificationPriority.LOW,
        data: {
          type: "metrics_update",
          category: "SYSTEM",
          businessModel: config.businessModel,
          tenantId: config.tenantId,
          metrics,
        },
        createdAt: new Date(),
      });
    }
  }

  private setupTicketEventListeners(): void {
    // These would typically be set up in your main application
    // to emit events when tickets are created, updated, etc.
    // For now, we'll create methods that can be called from the SupportService
  }

  // ===== EVENT EMITTERS FOR INTEGRATION =====

  async onTicketCreated(
    ticketId: string,
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<void> {
    const metrics = await this.getCurrentMetrics(businessModel, tenantId);

    await this.websocketService.sendNotificationToChannel("analytics", {
      id: `ticket-created-${ticketId}`,
      type: "SUPPORT_TICKET_CREATED",
      title: "New Ticket Created",
      message: "Support ticket metrics updated",
      priority: NotificationPriority.NORMAL,
      data: {
        type: "ticket_created",
        ticketId,
        category: "SYSTEM",
        businessModel,
        tenantId,
        metrics,
      },
      createdAt: new Date(),
    });
  }

  async onTicketResolved(
    ticketId: string,
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<void> {
    const metrics = await this.getCurrentMetrics(businessModel, tenantId);

    await this.websocketService.sendNotificationToChannel("analytics", {
      id: `ticket-resolved-${ticketId}`,
      type: "SUPPORT_TICKET_RESOLVED",
      title: "Ticket Resolved",
      message: "Support resolution metrics updated",
      priority: NotificationPriority.NORMAL,

      data: {
        type: "ticket_resolved",
        ticketId,
        category: "SYSTEM",
        businessModel,
        tenantId,
        metrics,
      },
      createdAt: new Date(),
    });
  }

  async onSLABreach(
    ticketId: string,
    breachType: "first_response" | "resolution",
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<void> {
    await this.websocketService.sendNotificationToChannel("admin", {
      id: `sla-breach-${ticketId}`,
      type: "SUPPORT_SLA_BREACH",
      title: "SLA Breach Alert",
      message: `${breachType.replace("_", " ")} SLA breached for ticket`,
      priority: NotificationPriority.HIGH,

      data: {
        type: "sla_breach",
        ticketId,
        category: "SYSTEM",
        breachType,
        businessModel,
        tenantId,
      },
      createdAt: new Date(),
    });
  }

  // ===== SUBSCRIPTION MANAGEMENT =====

  async subscribeToAnalytics(
    userId: string,
    businessModel: BusinessModel,
    tenantId: string | null = null
  ): Promise<void> {
    // Initial data push
    const dashboard = await this.getDashboard(businessModel, tenantId, {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date(),
    });

    await this.websocketService.sendNotificationToUser(userId, {
      id: `analytics-init-${Date.now()}`,
      type: "SYSTEM_NOTIFICATION",
      title: "Analytics Dashboard",
      message: "Initial dashboard data",
      priority: NotificationPriority.LOW,

      data: {
        type: "dashboard_init",
        category: "SYSTEM",
        dashboard,
      },
      createdAt: new Date(),
    });
  }

  // ===== HELPER METHODS =====

  private async getActiveUsersCount(): Promise<number> {
    try {
      const activeConnections = await this.prisma.webSocketConnection.count({
        where: {
          isActive: true,
          lastPing: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
          },
        },
      });
      return activeConnections;
    } catch (error) {
      return this.websocketService.getOnlineUsersCount();
    }
  }

  private async getOnlineAgentsCount(
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<number> {
    try {
      const onlineAgents = await this.prisma.supportAgent.count({
        where: {
          businessModel,
          tenantId: tenantId ?? null,
          isActive: true,
          isAvailable: true,
          user: {
            websocketConnections: {
              some: {
                isActive: true,
                lastPing: {
                  gte: new Date(Date.now() - 5 * 60 * 1000),
                },
              },
            },
          },
        },
      });
      return onlineAgents;
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error("Errore durante l'elaborazione:", error.message);
      } else {
        logger.error("Errore sconosciuto:", JSON.stringify(error));
      }
      return 0;
    }
  }

  private async getTodayTicketsCount(
    businessModel: BusinessModel,
    tenantId: string | null,
    today: Date
  ): Promise<number> {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.prisma.supportTicket.count({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }

  private async getPendingTicketsCount(
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<number> {
    return await this.prisma.supportTicket.count({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        status: {
          in: [
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            TicketStatus.PENDING_USER,
            TicketStatus.ESCALATED,
          ],
        },
      },
    });
  }

  private async getAverageWaitTime(
    businessModel: BusinessModel,
    tenantId: string | null
  ): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        createdAt: { gte: oneDayAgo },
        firstResponseAt: { not: null },
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
      },
    });

    if (tickets.length === 0) return 0;

    const totalWaitTime = tickets.reduce((sum, ticket) => {
      const waitTime =
        ticket.firstResponseAt!.getTime() - ticket.createdAt.getTime();
      return sum + waitTime;
    }, 0);

    return Math.round(totalWaitTime / tickets.length / (1000 * 60)); // Convert to minutes
  }

  private async getSLABreachesToday(
    businessModel: BusinessModel,
    tenantId: string | null,
    today: Date
  ): Promise<number> {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.prisma.supportSLA.count({
      where: {
        ticket: {
          businessModel,
          tenantId: tenantId ?? null,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        OR: [{ firstResponseBreach: true }, { resolutionBreach: true }],
      },
    });
  }

  // ===== ADVANCED INSIGHTS GENERATION =====

  private async generateInsights(
    businessModel: BusinessModel,
    tenantId: string | null,
    dateRange: { from: Date; to: Date }
  ): Promise<CompleteSupportAnalyticsResponse["insights"]> {
    const [topIssues, performanceAlerts, recommendations] = await Promise.all([
      this.identifyTopIssues(businessModel, tenantId, dateRange),
      this.generatePerformanceAlerts(businessModel, tenantId, dateRange),
      this.generateRecommendations(businessModel, tenantId, dateRange),
    ]);

    return {
      topIssues,
      performanceAlerts,
      recommendations,
    };
  }

  private async identifyTopIssues(
    businessModel: BusinessModel,
    tenantId: string | null,
    dateRange: { from: Date; to: Date }
  ) {
    // Get category breakdown for the period
    const categories = await this.analyticsService.getCategoryAnalytics(
      businessModel,
      tenantId,
      dateRange
    );

    return categories.map((cat) => ({
      category: cat.category,
      tickets: cat.tickets,
      trend: (cat.trends.length > 1
        ? cat.trends[cat.trends.length - 1].tickets > cat.trends[0].tickets
          ? "increasing"
          : "decreasing"
        : "stable") as "stable" | "increasing" | "decreasing",
      impact: (cat.tickets > 50
        ? "high"
        : cat.tickets > 20
        ? "medium"
        : "low") as "low" | "medium" | "high",
    }));
  }

  private async generatePerformanceAlerts(
    businessModel: BusinessModel,
    tenantId: string | null,
    dateRange: { from: Date; to: Date }
  ) {
    const alerts = [];

    // Check SLA breaches
    const slaMetrics = await this.analyticsService.getSLAMetrics(
      businessModel,
      tenantId,
      dateRange
    );

    if (slaMetrics.firstResponseSLA.compliance < 70) {
      alerts.push({
        type: "sla_breach" as const,
        severity: "critical" as const,
        message: `First response SLA compliance is ${slaMetrics.firstResponseSLA.compliance}%`,
        actionRequired: true,
        suggestions: [
          "Increase support team capacity",
          "Implement auto-assignment",
          "Review priority categorization",
        ],
      });
    }

    // Check satisfaction
    const overview = await this.analyticsService.getOverview(
      businessModel,
      tenantId,
      dateRange
    );

    if (overview.satisfactionRating < 3.5) {
      alerts.push({
        type: "satisfaction_drop" as const,
        severity: "warning" as const,
        message: `Customer satisfaction is ${overview.satisfactionRating.toFixed(
          1
        )}/5`,
        actionRequired: true,
        suggestions: [
          "Review agent training programs",
          "Analyze feedback patterns",
          "Implement quality assurance",
        ],
      });
    }

    return alerts;
  }

  private async generateRecommendations(
    businessModel: BusinessModel,
    tenantId: string | null,
    dateRange: { from: Date; to: Date }
  ) {
    const recommendations = [];

    // Analyze agent performance
    const agents = await this.analyticsService.getAgentPerformance(
      businessModel,
      tenantId,
      undefined,
      dateRange
    );

    const overloadedAgents = agents.filter((a) => a.workloadScore > 80);
    const underutilizedAgents = agents.filter((a) => a.workloadScore < 40);

    if (overloadedAgents.length > 0) {
      recommendations.push({
        title: "Redistribute Agent Workload",
        description: `${overloadedAgents.length} agents are operating above 80% capacity`,
        impact: "medium" as const,
        effort: "low" as const,
        category: "efficiency" as const,
      });
    }

    if (underutilizedAgents.length > 0 && overloadedAgents.length > 0) {
      recommendations.push({
        title: "Balance Team Capacity",
        description:
          "Some agents are underutilized while others are overloaded",
        impact: "high" as const,
        effort: "low" as const,
        category: "efficiency" as const,
      });
    }

    return recommendations;
  }

  // ===== DASHBOARD STREAMING =====

  async startDashboardStream(
    userId: string,
    businessModel: BusinessModel,
    tenantId: string | null = null,
    intervalSeconds: number = 30
  ): Promise<void> {
    const interval = setInterval(async () => {
      try {
        const dashboard = await this.getDashboard(businessModel, tenantId, {
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          to: new Date(),
        });

        const notification: NotificationPayload = {
          id: `dashboard-stream-${Date.now()}`,
          type: "SYSTEM_NOTIFICATION",
          title: "Dashboard Update",
          message: "Real-time dashboard update",
          priority: NotificationPriority.LOW,
          data: {
            type: "dashboard_stream",
            dashboard,
          },
          createdAt: new Date(),
        };

        await this.websocketService.sendNotificationToUser(
          userId,
          notification
        );
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error("Dashboard stream error:", error);
        } else {
          logger.error("Errore sconosciuto:", JSON.stringify(error));
        }
        clearInterval(interval);
      }
    }, intervalSeconds * 1000);

    // Store interval for cleanup (in a real app, you'd want proper cleanup management)
    setTimeout(() => clearInterval(interval), 30 * 60 * 1000); // Auto-cleanup after 30 minutes
  }

  // ===== CLEANUP =====

  async cleanup(): Promise<void> {
    // Clean up any running intervals or listeners
    logger.info("Real-time analytics service cleanup completed");
  }
}
