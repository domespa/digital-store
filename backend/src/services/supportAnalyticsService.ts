import {
  PrismaClient,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SupportRole,
  BusinessModel,
} from "../generated/prisma";
import {
  SupportAnalyticsResponse,
  AnalyticsFilters,
  SupportErrorCodes,
  AnalyticsOverview,
  TrendData,
  PerformanceMetrics,
  SLAMetrics,
  CategoryAnalytics,
  BusinessModelAnalytics,
  PredictiveAnalytics,
  CustomReportConfig,
} from "../types/support";

// ===== SUPPORT ANALYTICS SERVICE =====

export class SupportAnalyticsService {
  constructor(private prisma: PrismaClient) {}

  // ===== OVERVIEW ANALYTICS =====

  async getOverview(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    dateRange: { from: Date; to: Date }
  ): Promise<AnalyticsOverview> {
    const { from, to } = dateRange;

    // Calculate previous period for comparison
    const periodLength = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - periodLength);
    const previousTo = new Date(to.getTime() - periodLength);

    const [
      currentStats,
      previousStats,
      avgResponseTime,
      avgResolutionTime,
      satisfactionStats,
      slaStats,
      previousResponseTime,
      previousSatisfaction,
    ] = await Promise.all([
      this.getBasicStats(businessModel, tenantId, from, to),
      this.getBasicStats(businessModel, tenantId, previousFrom, previousTo),
      this.getAverageResponseTime(businessModel, tenantId, from, to),
      this.getAverageResolutionTime(businessModel, tenantId, from, to),
      this.getSatisfactionStats(businessModel, tenantId, from, to),
      this.getSLACompliance(businessModel, tenantId, from, to),
      this.getAverageResponseTime(
        businessModel,
        tenantId,
        previousFrom,
        previousTo
      ),
      this.getSatisfactionStats(
        businessModel,
        tenantId,
        previousFrom,
        previousTo
      ),
    ]);

    return {
      totalTickets: currentStats.total,
      openTickets: currentStats.open,
      resolvedTickets: currentStats.resolved,
      avgResponseTime,
      avgResolutionTime,
      satisfactionRating: satisfactionStats.average,
      slaCompliance: slaStats.compliance,
      periodComparison: {
        tickets: {
          current: currentStats.total,
          previous: previousStats.total,
          change: currentStats.total - previousStats.total,
        },
        responseTime: {
          current: avgResponseTime,
          previous: previousResponseTime,
          change: avgResponseTime - previousResponseTime,
        },
        satisfaction: {
          current: satisfactionStats.average,
          previous: previousSatisfaction.average,
          change: satisfactionStats.average - previousSatisfaction.average,
        },
      },
    };
  }

  // ===== TREND ANALYTICS =====

  async getTrends(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    period: "day" | "week" | "month",
    dateRange: { from: Date; to: Date }
  ): Promise<TrendData[]> {
    const { from, to } = dateRange;
    const groupBy = this.getGroupByClause(period);

    // Get aggregated analytics data
    const analyticsData = await this.prisma.supportAnalytics.groupBy({
      by: ["date"],
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        date: {
          gte: from,
          lte: to,
        },
      },
      _sum: {
        ticketsCreated: true,
        ticketsResolved: true,
        slaBreaches: true,
        totalRatings: true,
      },
      _avg: {
        avgResponseTime: true,
        avgSatisfaction: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    return analyticsData.map((data) => ({
      date: data.date.toISOString().split("T")[0],
      ticketsCreated: data._sum.ticketsCreated || 0,
      ticketsResolved: data._sum.ticketsResolved || 0,
      avgResponseTime: Math.round(data._avg.avgResponseTime || 0),
      slaBreaches: data._sum.slaBreaches || 0,
      satisfactionRating: Number((data._avg.avgSatisfaction || 0).toFixed(1)),
    }));
  }

  // ===== AGENT PERFORMANCE =====

  async getAgentPerformance(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    agentId?: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<PerformanceMetrics[]> {
    const { from, to } = dateRange || {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: new Date(),
    };

    const whereClause = {
      businessModel,
      tenantId: tenantId ?? null,
      isActive: true,
      ...(agentId && { userId: agentId }),
    };

    const agents = await this.prisma.supportAgent.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            assignedTickets: {
              where: {
                createdAt: {
                  gte: from,
                  lte: to,
                },
              },
              include: {
                slaConfig: true,
                satisfaction: true,
              },
            },
          },
        },
      },
    });

    const performanceMetrics: PerformanceMetrics[] = [];

    for (const agent of agents) {
      const tickets = agent.user.assignedTickets;
      const resolvedTickets = tickets.filter(
        (t) =>
          t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED
      );

      // Calculate response time
      const ticketsWithResponse = tickets.filter((t) => t.firstResponseAt);
      const totalResponseTime = ticketsWithResponse.reduce((sum, ticket) => {
        const responseTime =
          ticket.firstResponseAt!.getTime() - ticket.createdAt.getTime();
        return sum + responseTime;
      }, 0);

      const avgResponseTime =
        ticketsWithResponse.length > 0
          ? Math.round(
              totalResponseTime / ticketsWithResponse.length / (1000 * 60)
            )
          : 0;

      // Calculate resolution time
      const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
        const resolutionTime =
          (ticket.resolvedAt || ticket.closedAt)!.getTime() -
          ticket.createdAt.getTime();
        return sum + resolutionTime;
      }, 0);

      const avgResolutionTime =
        resolvedTickets.length > 0
          ? Math.round(
              totalResolutionTime / resolvedTickets.length / (1000 * 60)
            )
          : 0;

      // Calculate satisfaction
      const satisfactionRatings = tickets
        .filter((t) => t.satisfaction)
        .map((t) => t.satisfaction!.rating);

      const avgSatisfaction =
        satisfactionRatings.length > 0
          ? satisfactionRatings.reduce((sum, rating) => sum + rating, 0) /
            satisfactionRatings.length
          : 0;

      // Calculate SLA compliance
      const slaTickets = tickets.filter((t) => t.slaConfig);
      const slaCompliant = slaTickets.filter(
        (t) => t.slaConfig!.firstResponseMet && t.slaConfig!.resolutionMet
      );

      const slaCompliance =
        slaTickets.length > 0
          ? (slaCompliant.length / slaTickets.length) * 100
          : 0;

      // Calculate workload score
      const currentTickets = await this.prisma.supportTicket.count({
        where: {
          assignedToId: agent.userId,
          status: {
            in: [
              TicketStatus.OPEN,
              TicketStatus.IN_PROGRESS,
              TicketStatus.PENDING_USER,
            ],
          },
        },
      });

      const workloadScore = Math.round(
        (currentTickets / agent.maxConcurrentTickets) * 100
      );

      performanceMetrics.push({
        agentId: agent.userId,
        agentName: `${agent.user.firstName} ${agent.user.lastName}`.trim(),
        ticketsAssigned: tickets.length,
        ticketsResolved: resolvedTickets.length,
        avgResponseTime,
        avgResolutionTime,
        satisfactionRating: Number(avgSatisfaction.toFixed(1)),
        slaCompliance: Number(slaCompliance.toFixed(1)),
        workloadScore,
        categories: agent.categories,
        currentTickets,
      });
    }

    return performanceMetrics;
  }

  // ===== SLA ANALYTICS =====

  async getSLAMetrics(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    dateRange: { from: Date; to: Date }
  ): Promise<SLAMetrics> {
    const { from, to } = dateRange;

    const slaData = await this.prisma.supportSLA.findMany({
      where: {
        ticket: {
          businessModel,
          tenantId: tenantId ?? null,
          createdAt: {
            gte: from,
            lte: to,
          },
        },
      },
      include: {
        ticket: {
          select: {
            priority: true,
            status: true,
          },
        },
      },
    });

    if (slaData.length === 0) {
      return {
        firstResponseSLA: { target: 0, actual: 0, compliance: 0, breaches: 0 },
        resolutionSLA: { target: 0, actual: 0, compliance: 0, breaches: 0 },
        totalBreachTime: 0,
        criticalBreaches: 0,
      };
    }

    // First Response SLA
    const firstResponseMet = slaData.filter((s) => s.firstResponseMet).length;
    const firstResponseBreaches = slaData.filter(
      (s) => s.firstResponseBreach
    ).length;
    const avgFirstResponseTarget =
      slaData.reduce((sum, s) => sum + s.firstResponseSLA, 0) / slaData.length;

    // Resolution SLA
    const resolutionMet = slaData.filter((s) => s.resolutionMet).length;
    const resolutionBreaches = slaData.filter((s) => s.resolutionBreach).length;
    const avgResolutionTarget =
      slaData.reduce((sum, s) => sum + s.resolutionSLA, 0) / slaData.length;

    const totalBreachTime = slaData.reduce(
      (sum, s) => sum + s.totalBreachTime,
      0
    );
    const criticalBreaches = slaData.filter(
      (s) =>
        s.firstResponseBreach && s.ticket.priority === TicketPriority.URGENT
    ).length;

    return {
      firstResponseSLA: {
        target: Math.round(avgFirstResponseTarget),
        actual: Math.round(
          avgFirstResponseTarget * (firstResponseMet / slaData.length)
        ),
        compliance: Number(
          ((firstResponseMet / slaData.length) * 100).toFixed(1)
        ),
        breaches: firstResponseBreaches,
      },
      resolutionSLA: {
        target: Math.round(avgResolutionTarget),
        actual: Math.round(
          avgResolutionTarget * (resolutionMet / slaData.length)
        ),
        compliance: Number(((resolutionMet / slaData.length) * 100).toFixed(1)),
        breaches: resolutionBreaches,
      },
      totalBreachTime: Math.round(totalBreachTime / 60), // Convert to hours
      criticalBreaches,
    };
  }

  // ===== CATEGORY ANALYTICS =====

  async getCategoryAnalytics(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    dateRange: { from: Date; to: Date }
  ): Promise<CategoryAnalytics[]> {
    const { from, to } = dateRange;

    const categories = Object.values(TicketCategory);
    const categoryAnalytics: CategoryAnalytics[] = [];

    for (const category of categories) {
      const tickets = await this.prisma.supportTicket.findMany({
        where: {
          businessModel,
          tenantId: tenantId ?? null,
          category,
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        include: {
          satisfaction: true,
          slaConfig: true,
        },
      });

      if (tickets.length === 0) continue;

      // Calculate metrics
      const avgResponseTime = await this.calculateCategoryResponseTime(
        category,
        businessModel,
        tenantId,
        from,
        to
      );
      const avgResolutionTime = await this.calculateCategoryResolutionTime(
        category,
        businessModel,
        tenantId,
        from,
        to
      );
      const satisfactionRating = await this.calculateCategorySatisfaction(
        category,
        businessModel,
        tenantId,
        from,
        to
      );
      const slaCompliance = await this.calculateCategorySLACompliance(
        category,
        businessModel,
        tenantId,
        from,
        to
      );

      // Get trends (last 30 days)
      const trends = await this.getCategoryTrends(
        category,
        businessModel,
        tenantId,
        from,
        to
      );

      categoryAnalytics.push({
        category,
        tickets: tickets.length,
        avgResponseTime,
        avgResolutionTime,
        satisfactionRating,
        slaCompliance,
        trends,
      });
    }

    return categoryAnalytics.sort((a, b) => b.tickets - a.tickets);
  }

  // ===== BUSINESS MODEL ANALYTICS =====

  async getBusinessModelAnalytics(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    dateRange: { from: Date; to: Date }
  ): Promise<BusinessModelAnalytics> {
    const overview = await this.getOverview(businessModel, tenantId, dateRange);
    const trends = await this.getTrends(
      businessModel,
      tenantId,
      "day",
      dateRange
    );
    const agents = await this.getAgentPerformance(
      businessModel,
      tenantId,
      undefined,
      dateRange
    );

    // Get breakdown data
    const breakdown = await this.getBreakdownData(
      businessModel,
      tenantId,
      dateRange
    );

    return {
      businessModel,
      tenantId: tenantId || undefined,
      overview,
      breakdown,
      trends,
      agents,
    };
  }

  // ===== PREDICTIVE ANALYTICS =====

  async getPredictiveAnalytics(
    businessModel: BusinessModel,
    tenantId: string | null = null
  ): Promise<PredictiveAnalytics> {
    // Get historical data for predictions
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const historicalData = await this.getTrends(
      businessModel,
      tenantId,
      "day",
      {
        from: thirtyDaysAgo,
        to: now,
      }
    );

    // Simple trend-based prediction
    const recentTickets = historicalData.slice(-7);
    const avgDailyTickets =
      recentTickets.reduce((sum, day) => sum + day.ticketsCreated, 0) /
      recentTickets.length;

    const expectedVolume = {
      nextWeek: Math.round(avgDailyTickets * 7),
      nextMonth: Math.round(avgDailyTickets * 30),
      confidence: this.calculatePredictionConfidence(historicalData),
    };

    // Capacity analysis
    const agents = await this.getAgentPerformance(businessModel, tenantId);
    const totalCapacity = agents.reduce(
      (sum, agent) => sum + agent.ticketsAssigned,
      0
    );
    const currentWorkload = agents.reduce(
      (sum, agent) => sum + agent.currentTickets,
      0
    );

    const capacityRecommendations = {
      currentCapacity: totalCapacity,
      recommendedCapacity: Math.ceil(expectedVolume.nextWeek * 1.2),
      reasoning: this.generateCapacityRecommendations(agents, expectedVolume),
    };

    // Risk assessment
    const riskFactors = {
      slaRisk: this.assessSLARisk(agents) as "low" | "medium" | "high",
      volumeSpike: this.assessVolumeRisk(historicalData) as
        | "unlikely"
        | "possible"
        | "likely",
      satisfactionTrend: this.assessSatisfactionTrend(historicalData) as
        | "improving"
        | "stable"
        | "declining",
    };

    return {
      expectedVolume,
      capacityRecommendations,
      riskFactors,
    };
  }

  // ===== CUSTOM REPORTS =====

  async generateCustomReport(
    config: CustomReportConfig,
    businessModel: BusinessModel,
    tenantId: string | null = null
  ): Promise<any> {
    const dateRange = {
      from:
        config.filters.dateRange?.from ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: config.filters.dateRange?.to || new Date(),
    };

    const reportData: any = {
      config,
      generatedAt: new Date(),
      businessModel,
      tenantId,
      data: {},
    };

    // Generate requested metrics
    for (const metric of config.metrics) {
      switch (metric) {
        case "overview":
          reportData.data.overview = await this.getOverview(
            businessModel,
            tenantId,
            dateRange
          );
          break;
        case "trends":
          const validPeriods = ["day", "week", "month"];
          const period = validPeriods.includes(config.groupBy)
            ? (config.groupBy as "day" | "week" | "month")
            : "day";

          reportData.data.trends = await this.getTrends(
            businessModel,
            tenantId,
            period,
            dateRange
          );
          break;
        case "agents":
          reportData.data.agents = await this.getAgentPerformance(
            businessModel,
            tenantId,
            undefined,
            dateRange
          );
          break;
        case "sla":
          reportData.data.sla = await this.getSLAMetrics(
            businessModel,
            tenantId,
            dateRange
          );
          break;
        case "categories":
          reportData.data.categories = await this.getCategoryAnalytics(
            businessModel,
            tenantId,
            dateRange
          );
          break;
        case "predictive":
          reportData.data.predictive = await this.getPredictiveAnalytics(
            businessModel,
            tenantId
          );
          break;
      }
    }

    return reportData;
  }

  // ===== EXPORT METHODS =====

  async exportAnalytics(
    format: "csv" | "xlsx" | "json",
    data: any,
    filename: string
  ): Promise<{
    filename: string;
    mimeType: string;
    data: string | Buffer;
  }> {
    switch (format) {
      case "json":
        return {
          filename: `${filename}.json`,
          mimeType: "application/json",
          data: JSON.stringify(data, null, 2),
        };
      case "csv":
        // Implement CSV export logic
        return {
          filename: `${filename}.csv`,
          mimeType: "text/csv",
          data: this.convertToCSV(data),
        };
      case "xlsx":
        // Implement Excel export logic (would require xlsx library)
        return {
          filename: `${filename}.xlsx`,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          data: "Excel export not implemented", // Placeholder
        };
      default:
        throw new Error("Unsupported export format");
    }
  }

  // ===== PRIVATE UTILITY METHODS =====

  private async getBasicStats(
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ) {
    const [total, open, resolved] = await Promise.all([
      this.prisma.supportTicket.count({
        where: {
          businessModel,
          tenantId: tenantId ?? null,
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          businessModel,
          tenantId: tenantId ?? null,
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          businessModel,
          tenantId: tenantId ?? null,
          status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
          createdAt: { gte: from, lte: to },
        },
      }),
    ]);

    return { total, open, resolved };
  }

  private async getAverageResponseTime(
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ): Promise<number> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        firstResponseAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
      },
    });

    if (tickets.length === 0) return 0;

    const totalResponseTime = tickets.reduce((sum, ticket) => {
      const responseTime =
        ticket.firstResponseAt!.getTime() - ticket.createdAt.getTime();
      return sum + responseTime;
    }, 0);

    return Math.round(totalResponseTime / tickets.length / (1000 * 60));
  }

  private async getAverageResolutionTime(
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ): Promise<number> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        resolvedAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (tickets.length === 0) return 0;

    const totalResolutionTime = tickets.reduce((sum, ticket) => {
      const resolutionTime =
        ticket.resolvedAt!.getTime() - ticket.createdAt.getTime();
      return sum + resolutionTime;
    }, 0);

    return Math.round(totalResolutionTime / tickets.length / (1000 * 60));
  }

  private async getSatisfactionStats(
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ) {
    const satisfactionData = await this.prisma.supportSatisfaction.aggregate({
      where: {
        ticket: {
          businessModel,
          tenantId: tenantId ?? null,
          createdAt: { gte: from, lte: to },
        },
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      average: satisfactionData._avg.rating || 0,
      total: satisfactionData._count.rating || 0,
    };
  }

  private async getSLACompliance(
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ) {
    const slaData = await this.prisma.supportSLA.findMany({
      where: {
        ticket: {
          businessModel,
          tenantId: tenantId ?? null,
          createdAt: { gte: from, lte: to },
        },
      },
    });

    if (slaData.length === 0) return { compliance: 0, total: 0 };

    const compliant = slaData.filter(
      (s) => s.firstResponseMet && s.resolutionMet
    ).length;

    return {
      compliance: (compliant / slaData.length) * 100,
      total: slaData.length,
    };
  }

  private getGroupByClause(period: "day" | "week" | "month") {
    switch (period) {
      case "day":
        return "DATE(date)";
      case "week":
        return "DATE_TRUNC('week', date)";
      case "month":
        return "DATE_TRUNC('month', date)";
      default:
        return "DATE(date)";
    }
  }

  private async getBreakdownData(
    businessModel: BusinessModel,
    tenantId: string | null,
    dateRange: { from: Date; to: Date }
  ) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
      select: {
        status: true,
        priority: true,
        category: true,
      },
    });

    const byStatus: Record<TicketStatus, number> = {} as any;
    const byPriority: Record<TicketPriority, number> = {} as any;
    const byCategory: Record<TicketCategory, number> = {} as any;

    // Initialize all possible values
    Object.values(TicketStatus).forEach((status) => (byStatus[status] = 0));
    Object.values(TicketPriority).forEach(
      (priority) => (byPriority[priority] = 0)
    );
    Object.values(TicketCategory).forEach(
      (category) => (byCategory[category] = 0)
    );

    // Count tickets
    tickets.forEach((ticket) => {
      byStatus[ticket.status]++;
      byPriority[ticket.priority]++;
      byCategory[ticket.category]++;
    });

    return { byStatus, byPriority, byCategory };
  }

  private calculatePredictionConfidence(data: TrendData[]): number {
    if (data.length < 7) return 50;

    const recent = data.slice(-7);
    const variance = this.calculateVariance(
      recent.map((d) => d.ticketsCreated)
    );

    // Lower variance = higher confidence
    if (variance < 10) return 85;
    if (variance < 25) return 70;
    if (variance < 50) return 55;
    return 40;
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const variance =
      numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) /
      numbers.length;
    return variance;
  }

  private generateCapacityRecommendations(
    agents: PerformanceMetrics[],
    expectedVolume: { nextWeek: number; nextMonth: number }
  ): string[] {
    const recommendations: string[] = [];
    const overloadedAgents = agents.filter((a) => a.workloadScore > 80);
    const underutilizedAgents = agents.filter((a) => a.workloadScore < 40);

    if (overloadedAgents.length > 0) {
      recommendations.push(
        `${overloadedAgents.length} agents are overloaded (>80% capacity)`
      );
    }

    if (
      expectedVolume.nextWeek >
      agents.reduce((sum, a) => sum + a.ticketsAssigned, 0) * 0.8
    ) {
      recommendations.push("Consider hiring additional support agents");
    }

    if (underutilizedAgents.length > 0 && overloadedAgents.length > 0) {
      recommendations.push("Redistribute workload among existing agents");
    }

    return recommendations.length > 0
      ? recommendations
      : ["Current capacity appears adequate"];
  }

  private assessSLARisk(agents: PerformanceMetrics[]): string {
    const avgCompliance =
      agents.reduce((sum, a) => sum + a.slaCompliance, 0) / agents.length;
    if (avgCompliance < 70) return "high";
    if (avgCompliance < 85) return "medium";
    return "low";
  }

  private assessVolumeRisk(historicalData: TrendData[]): string {
    if (historicalData.length < 7) return "unlikely";

    const recent = historicalData.slice(-3);
    const previous = historicalData.slice(-7, -3);

    const recentAvg =
      recent.reduce((sum, d) => sum + d.ticketsCreated, 0) / recent.length;
    const previousAvg =
      previous.reduce((sum, d) => sum + d.ticketsCreated, 0) / previous.length;

    const growth = (recentAvg - previousAvg) / previousAvg;

    if (growth > 0.5) return "likely";
    if (growth > 0.2) return "possible";
    return "unlikely";
  }

  private assessSatisfactionTrend(historicalData: TrendData[]): string {
    if (historicalData.length < 7) return "stable";

    const recent = historicalData.slice(-3);
    const previous = historicalData.slice(-7, -3);

    const recentAvg =
      recent.reduce((sum, d) => sum + d.satisfactionRating, 0) / recent.length;
    const previousAvg =
      previous.reduce((sum, d) => sum + d.satisfactionRating, 0) /
      previous.length;

    const change = recentAvg - previousAvg;

    if (change > 0.2) return "improving";
    if (change < -0.2) return "declining";
    return "stable";
  }

  private async calculateCategoryResponseTime(
    category: TicketCategory,
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ): Promise<number> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        category,
        firstResponseAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
      },
    });

    if (tickets.length === 0) return 0;

    const totalResponseTime = tickets.reduce((sum, ticket) => {
      const responseTime =
        ticket.firstResponseAt!.getTime() - ticket.createdAt.getTime();
      return sum + responseTime;
    }, 0);

    return Math.round(totalResponseTime / tickets.length / (1000 * 60));
  }

  private async calculateCategoryResolutionTime(
    category: TicketCategory,
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ): Promise<number> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        category,
        resolvedAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (tickets.length === 0) return 0;

    const totalResolutionTime = tickets.reduce((sum, ticket) => {
      const resolutionTime =
        ticket.resolvedAt!.getTime() - ticket.createdAt.getTime();
      return sum + resolutionTime;
    }, 0);

    return Math.round(totalResolutionTime / tickets.length / (1000 * 60));
  }

  private async calculateCategorySatisfaction(
    category: TicketCategory,
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ): Promise<number> {
    const satisfactionData = await this.prisma.supportSatisfaction.aggregate({
      where: {
        ticket: {
          businessModel,
          tenantId: tenantId ?? null,
          category,
          createdAt: { gte: from, lte: to },
        },
      },
      _avg: { rating: true },
    });

    return Number((satisfactionData._avg.rating || 0).toFixed(1));
  }

  private async calculateCategorySLACompliance(
    category: TicketCategory,
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ): Promise<number> {
    const slaData = await this.prisma.supportSLA.findMany({
      where: {
        ticket: {
          businessModel,
          tenantId: tenantId ?? null,
          category,
          createdAt: { gte: from, lte: to },
        },
      },
    });

    if (slaData.length === 0) return 0;

    const compliant = slaData.filter(
      (s) => s.firstResponseMet && s.resolutionMet
    ).length;

    return Number(((compliant / slaData.length) * 100).toFixed(1));
  }

  private async getCategoryTrends(
    category: TicketCategory,
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ): Promise<
    Array<{ date: string; tickets: number; avgResponseTime: number }>
  > {
    const analyticsData = await this.prisma.supportAnalytics.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return analyticsData.map((data) => {
      let categoryTickets = 0;

      switch (category) {
        case TicketCategory.TECHNICAL:
          categoryTickets = data.technicalTickets;
          break;
        case TicketCategory.BILLING:
          categoryTickets = data.billingTickets;
          break;
        case TicketCategory.GENERAL:
          categoryTickets = data.generalTickets;
          break;
        case TicketCategory.PRODUCT:
          categoryTickets = data.productTickets;
          break;
        case TicketCategory.ACCOUNT:
          categoryTickets = data.accountTickets;
          break;
        case TicketCategory.BUG_REPORT:
          categoryTickets = data.bugReports;
          break;
        case TicketCategory.FEATURE_REQUEST:
          categoryTickets = data.featureRequests;
          break;
        default:
          categoryTickets = 0;
      }

      return {
        date: data.date.toISOString().split("T")[0],
        tickets: categoryTickets,
        avgResponseTime: Math.round(data.avgResponseTime || 0),
      };
    });
  }

  private convertToCSV(data: any): string {
    if (!data || typeof data !== "object") {
      return "";
    }

    const flatten = (obj: any, prefix = ""): Record<string, any> => {
      const flattened: Record<string, any> = {};

      for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          !(value instanceof Date)
        ) {
          Object.assign(flattened, flatten(value, newKey));
        } else {
          flattened[newKey] = value;
        }
      }

      return flattened;
    };

    const flattened = flatten(data);
    const headers = Object.keys(flattened);
    const values = Object.values(flattened).map((v) =>
      typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v
    );

    return [headers.join(","), values.join(",")].join("\n");
  }

  // ===== DATA AGGREGATION METHODS (Background Jobs) =====

  async aggregateHourlyData(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    hour: Date = new Date()
  ): Promise<void> {
    const hourStart = new Date(hour);
    hourStart.setMinutes(0, 0, 0);

    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    const hourData = await this.calculateHourlyMetrics(
      businessModel,
      tenantId,
      hourStart,
      hourEnd
    );

    await this.prisma.supportAnalytics.upsert({
      where: {
        businessModel_tenantId_date_hour: {
          businessModel,
          tenantId: tenantId ?? "",
          date: hourStart,
          hour: hourStart.getHours(),
        },
      },
      update: hourData,
      create: {
        businessModel,
        tenantId: tenantId ?? null,
        date: hourStart,
        hour: hourStart.getHours(),
        ...hourData,
      },
    });
  }

  async aggregateDailyData(
    businessModel: BusinessModel,
    tenantId: string | null = null,
    date: Date = new Date()
  ): Promise<void> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dailyData = await this.calculateDailyMetrics(
      businessModel,
      tenantId,
      dayStart,
      dayEnd
    );

    // Check if the record exists
    const existing = await this.prisma.supportAnalytics.findUnique({
      where: {
        businessModel_tenantId_date_hour: {
          businessModel,
          tenantId: tenantId ?? "",
          date: dayStart,
          hour: null as any,
        },
      },
    });

    if (existing) {
      await this.prisma.supportAnalytics.update({
        where: { id: existing.id },
        data: dailyData,
      });
    } else {
      await this.prisma.supportAnalytics.create({
        data: {
          businessModel,
          tenantId: tenantId ?? null,
          date: dayStart,
          hour: null as any,
          ...dailyData,
        },
      });
    }
  }

  private async calculateHourlyMetrics(
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        createdAt: { gte: from, lte: to },
      },
      include: {
        satisfaction: true,
        slaConfig: true,
      },
    });

    const resolvedTickets = tickets.filter(
      (t) =>
        t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED
    );

    const closedTickets = tickets.filter(
      (t) => t.closedAt && t.closedAt >= from && t.closedAt <= to
    );

    // Calculate response time
    const responseTimes = tickets
      .filter((t) => t.firstResponseAt)
      .map((t) => t.firstResponseAt!.getTime() - t.createdAt.getTime());

    const avgResponseTime =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((sum, time) => sum + time, 0) /
              responseTimes.length /
              (1000 * 60)
          )
        : 0;

    // Calculate resolution time
    const resolutionTimes = resolvedTickets
      .filter((t) => t.resolvedAt)
      .map((t) => t.resolvedAt!.getTime() - t.createdAt.getTime());

    const avgResolutionTime =
      resolutionTimes.length > 0
        ? Math.round(
            resolutionTimes.reduce((sum, time) => sum + time, 0) /
              resolutionTimes.length /
              (1000 * 60)
          )
        : 0;

    // Calculate satisfaction
    const satisfactionRatings = tickets
      .filter((t) => t.satisfaction)
      .map((t) => t.satisfaction!.rating);

    const avgSatisfaction =
      satisfactionRatings.length > 0
        ? satisfactionRatings.reduce((sum, rating) => sum + rating, 0) /
          satisfactionRatings.length
        : 0;

    // Calculate SLA breaches
    const slaBreaches = tickets.filter(
      (t) =>
        t.slaConfig &&
        (t.slaConfig.firstResponseBreach || t.slaConfig.resolutionBreach)
    ).length;

    // Count by priority
    const lowPriorityTickets = tickets.filter(
      (t) => t.priority === TicketPriority.LOW
    ).length;
    const mediumPriorityTickets = tickets.filter(
      (t) => t.priority === TicketPriority.MEDIUM
    ).length;
    const highPriorityTickets = tickets.filter(
      (t) => t.priority === TicketPriority.HIGH
    ).length;
    const urgentPriorityTickets = tickets.filter(
      (t) => t.priority === TicketPriority.URGENT
    ).length;

    // Count by category
    const technicalTickets = tickets.filter(
      (t) => t.category === TicketCategory.TECHNICAL
    ).length;
    const billingTickets = tickets.filter(
      (t) => t.category === TicketCategory.BILLING
    ).length;
    const generalTickets = tickets.filter(
      (t) => t.category === TicketCategory.GENERAL
    ).length;
    const productTickets = tickets.filter(
      (t) => t.category === TicketCategory.PRODUCT
    ).length;
    const accountTickets = tickets.filter(
      (t) => t.category === TicketCategory.ACCOUNT
    ).length;
    const bugReports = tickets.filter(
      (t) => t.category === TicketCategory.BUG_REPORT
    ).length;
    const featureRequests = tickets.filter(
      (t) => t.category === TicketCategory.FEATURE_REQUEST
    ).length;

    return {
      ticketsCreated: tickets.length,
      ticketsResolved: resolvedTickets.length,
      ticketsClosed: closedTickets.length,
      avgResponseTime,
      avgResolutionTime,
      slaBreaches,
      avgSatisfaction,
      totalRatings: satisfactionRatings.length,
      lowPriorityTickets,
      mediumPriorityTickets,
      highPriorityTickets,
      urgentPriorityTickets,
      technicalTickets,
      billingTickets,
      generalTickets,
      productTickets,
      accountTickets,
      bugReports,
      featureRequests,
    };
  }

  private async calculateDailyMetrics(
    businessModel: BusinessModel,
    tenantId: string | null,
    from: Date,
    to: Date
  ) {
    // Aggregate hourly data into daily metrics
    const hourlyData = await this.prisma.supportAnalytics.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        date: {
          gte: from,
          lte: to,
        },
        hour: { not: null },
      },
    });

    if (hourlyData.length === 0) {
      // Fallback to calculating directly from tickets
      return await this.calculateHourlyMetrics(
        businessModel,
        tenantId,
        from,
        to
      );
    }

    // Aggregate hourly data
    const totalTicketsCreated = hourlyData.reduce(
      (sum, h) => sum + h.ticketsCreated,
      0
    );
    const totalTicketsResolved = hourlyData.reduce(
      (sum, h) => sum + h.ticketsResolved,
      0
    );
    const totalTicketsClosed = hourlyData.reduce(
      (sum, h) => sum + h.ticketsClosed,
      0
    );

    const avgResponseTime =
      hourlyData.length > 0
        ? Math.round(
            hourlyData.reduce((sum, h) => sum + h.avgResponseTime, 0) /
              hourlyData.length
          )
        : 0;

    const avgResolutionTime =
      hourlyData.length > 0
        ? Math.round(
            hourlyData.reduce((sum, h) => sum + h.avgResolutionTime, 0) /
              hourlyData.length
          )
        : 0;

    const totalSLABreaches = hourlyData.reduce(
      (sum, h) => sum + h.slaBreaches,
      0
    );

    const avgSatisfaction =
      hourlyData.length > 0
        ? hourlyData.reduce((sum, h) => sum + h.avgSatisfaction, 0) /
          hourlyData.length
        : 0;

    const totalRatings = hourlyData.reduce((sum, h) => sum + h.totalRatings, 0);

    return {
      ticketsCreated: totalTicketsCreated,
      ticketsResolved: totalTicketsResolved,
      ticketsClosed: totalTicketsClosed,
      avgResponseTime,
      avgResolutionTime,
      slaBreaches: totalSLABreaches,
      avgSatisfaction,
      totalRatings,
      lowPriorityTickets: hourlyData.reduce(
        (sum, h) => sum + h.lowPriorityTickets,
        0
      ),
      mediumPriorityTickets: hourlyData.reduce(
        (sum, h) => sum + h.mediumPriorityTickets,
        0
      ),
      highPriorityTickets: hourlyData.reduce(
        (sum, h) => sum + h.highPriorityTickets,
        0
      ),
      urgentPriorityTickets: hourlyData.reduce(
        (sum, h) => sum + h.urgentPriorityTickets,
        0
      ),
      technicalTickets: hourlyData.reduce(
        (sum, h) => sum + h.technicalTickets,
        0
      ),
      billingTickets: hourlyData.reduce((sum, h) => sum + h.billingTickets, 0),
      generalTickets: hourlyData.reduce((sum, h) => sum + h.generalTickets, 0),
      productTickets: hourlyData.reduce((sum, h) => sum + h.productTickets, 0),
      accountTickets: hourlyData.reduce((sum, h) => sum + h.accountTickets, 0),
      bugReports: hourlyData.reduce((sum, h) => sum + h.bugReports, 0),
      featureRequests: hourlyData.reduce(
        (sum, h) => sum + h.featureRequests,
        0
      ),
    };
  }

  async testAnalytics(): Promise<void> {
    try {
      console.log("Testing analytics service...");

      // Test 1: Overview
      const overview = await this.getOverview(BusinessModel.B2B_SALE, null, {
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        to: new Date(),
      });
      console.log("Overview test passed:", overview.totalTickets >= 0);

      // Test 2: Custom report with different groupBy values
      const reportConfigs = [
        { groupBy: "day" as const },
        { groupBy: "week" as const },
        { groupBy: "month" as const },
        { groupBy: "agent" as const }, // Should fallback to "day"
        { groupBy: "category" as const }, // Should fallback to "day"
      ];

      for (const configBase of reportConfigs) {
        const report = await this.generateCustomReport(
          {
            name: "Test Report",
            metrics: ["overview", "trends"],
            filters: { dateRange: { from: new Date(), to: new Date() } },
            groupBy: configBase.groupBy,
            format: "chart",
          },
          BusinessModel.B2B_SALE
        );
        console.log(`Report with groupBy ${configBase.groupBy} test passed`);
      }

      // Test 3: Data aggregation
      await this.aggregateHourlyData(BusinessModel.B2B_SALE, null, new Date());
      console.log("Hourly aggregation test passed");

      await this.aggregateDailyData(BusinessModel.B2B_SALE, null, new Date());
      console.log("Daily aggregation test passed");

      console.log("All analytics tests passed!");
    } catch (error) {
      console.error("Analytics test failed:", error);
      throw error;
    }
  }
}
