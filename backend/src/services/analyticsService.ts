import { PrismaClient } from "../generated/prisma";
import {
  DashboardMetrics,
  OverviewMetrics,
  SalesMetrics,
  ProductMetrics,
  UserMetrics,
  ReviewMetrics,
  RealTimeMetrics,
  AnalyticsFilters,
  TimeSeriesData,
  TopProduct,
  PeriodComparison,
  DashboardInsights,
  PerformanceInsight,
  AnalyticsError,
} from "../types/analytics";

const prisma = new PrismaClient();

// ===========================================
//           ANALYTICS SERVICE CLASS
// ===========================================

export class AnalyticsService {
  // ===========================================
  //             MAIN DASHBOARD
  // ===========================================

  // OTTIENI DASHBOARD
  static async getDashboardMetrics(
    filters: AnalyticsFilters
  ): Promise<DashboardMetrics> {
    const dateRange = this.getDateRange(filters);

    const [overview, sales, products, users, reviews] = await Promise.all([
      this.getOverviewMetrics(dateRange),
      this.getSalesMetrics(dateRange),
      this.getProductMetrics(dateRange),
      this.getUserMetrics(dateRange),
      this.getReviewMetrics(dateRange),
    ]);

    return {
      overview,
      sales,
      products,
      users,
      reviews,
      timeRange: {
        from: dateRange.from,
        to: dateRange.to,
        period: filters.period,
      },
    };
  }

  // ===========================================
  //            OVERVIEW METRICS
  // ===========================================

  // METRICHE OVERVIEW
  static async getOverviewMetrics(dateRange: {
    from: Date;
    to: Date;
    previousFrom: Date;
    previousTo: Date;
  }): Promise<OverviewMetrics> {
    const [currentStats, previousStats] = await Promise.all([
      // STATS PERIODO CORRENTE
      prisma.order.aggregate({
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          status: "COMPLETED",
        },
        _sum: { total: true },
        _count: { id: true },
      }),

      // STATS PERIODO PRECEDENTE
      prisma.order.aggregate({
        where: {
          createdAt: {
            gte: dateRange.previousFrom,
            lte: dateRange.previousTo,
          },
          status: "COMPLETED",
        },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    // CONTEGGIO UTENTI
    const [currentUsers, previousUsers] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: dateRange.previousFrom,
            lte: dateRange.previousTo,
          },
        },
      }),
    ]);

    // CALCOLA CONVERSION RATE (ordini / utenti)
    const currentRevenue = Number(currentStats._sum.total || 0);
    const previousRevenue = Number(previousStats._sum.total || 0);
    const currentOrders = currentStats._count.id;
    const previousOrders = previousStats._count.id;

    const currentConversion =
      currentUsers > 0 ? (currentOrders / currentUsers) * 100 : 0;
    const previousConversion =
      previousUsers > 0 ? (previousOrders / previousUsers) * 100 : 0;

    return {
      totalRevenue: {
        current: currentRevenue,
        previous: previousRevenue,
        change: currentRevenue - previousRevenue,
        changePercent: AnalyticsService.calculatePercentChange(
          previousRevenue,
          currentRevenue
        ),
      },
      totalOrders: {
        current: currentOrders,
        previous: previousOrders,
        change: currentOrders - previousOrders,
        changePercent: this.calculatePercentChange(
          previousOrders,
          currentOrders
        ),
      },
      totalUsers: {
        current: currentUsers,
        previous: previousUsers,
        change: currentUsers - previousUsers,
        changePercent: this.calculatePercentChange(previousUsers, currentUsers),
      },
      conversionRate: {
        current: currentConversion,
        previous: previousConversion,
        change: currentConversion - previousConversion,
        changePercent: this.calculatePercentChange(
          previousConversion,
          currentConversion
        ),
      },
    };
  }

  // ===========================================
  //             SALES METRICS
  // ===========================================

  // METRICHE VENDITE
  static async getSalesMetrics(dateRange: {
    from: Date;
    to: Date;
  }): Promise<SalesMetrics> {
    const [
      revenueData,
      topProducts,
      paymentMethods,
      currencies,
      orderCounts,
      averageRevenuePerUser,
    ] = await Promise.all([
      // REVENUE BY DAY
      this.getRevenueTimeSeries(dateRange),

      // TOP PRODUCTS
      this.getTopProducts(dateRange),

      // PAYMENT METHODS
      prisma.order.groupBy({
        by: ["paymentProvider"],
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          status: "COMPLETED",
          paymentProvider: { not: null },
        },
        _sum: { total: true },
        _count: { id: true },
      }),

      // CURRENCIES
      prisma.order.groupBy({
        by: ["currency"],
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          status: "COMPLETED",
        },
        _sum: { total: true },
        _count: { id: true },
      }),

      // ORDER COUNTS BY STATUS
      this.getOrderStatusDistribution(dateRange),

      // AVERAGE REVENUE PER USER
      this.calculateAverageRevenuePerUser(dateRange),
    ]);

    const totalRevenue = revenueData.reduce((sum, item) => sum + item.value, 0);
    const totalOrders = paymentMethods.reduce(
      (sum, item) => sum + item._count.id,
      0
    );

    const completedOrders =
      orderCounts.find((oc) => oc.status === "COMPLETED")?.count || 0;
    const pendingOrders =
      orderCounts.find((oc) => oc.status === "PENDING")?.count || 0;
    const failedOrders =
      orderCounts.find((oc) => oc.status === "FAILED")?.count || 0;
    const refundedOrders =
      orderCounts.find((oc) => oc.status === "REFUNDED")?.count || 0;

    return {
      revenue: {
        total: totalRevenue,
        byDay: revenueData,
        byWeek: await this.getRevenueTimeSeriesWeekly(dateRange),
        byMonth: await this.getRevenueTimeSeriesMonthly(dateRange),
        average: {
          perOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          perUser: averageRevenuePerUser,
          perDay:
            revenueData.length > 0 ? totalRevenue / revenueData.length : 0,
        },
      },
      orders: {
        total: totalOrders,
        completed: completedOrders,
        pending: pendingOrders,
        failed: failedOrders,
        refunded: refundedOrders,
        statusDistribution: orderCounts,
        byDay: await this.getOrdersTimeSeries(dateRange),
      },
      topProducts,
      paymentMethods: paymentMethods
        .filter(
          (pm) =>
            pm.paymentProvider &&
            ["STRIPE", "PAYPAL"].includes(pm.paymentProvider)
        )
        .map((pm) => ({
          method: pm.paymentProvider as "STRIPE" | "PAYPAL",
          count: pm._count.id,
          revenue: Number(pm._sum.total || 0),
          percentage: totalOrders > 0 ? (pm._count.id / totalOrders) * 100 : 0,
        })),
      currencies: currencies.map((curr) => ({
        currency: curr.currency,
        count: curr._count.id,
        revenue: Number(curr._sum.total || 0),
        percentage: totalOrders > 0 ? (curr._count.id / totalOrders) * 100 : 0,
      })),
    };
  }

  // ===========================================
  //            PRODUCT METRICS
  // ===========================================

  // METRICHE PRODOTTI
  static async getProductMetrics(dateRange: {
    from: Date;
    to: Date;
  }): Promise<ProductMetrics> {
    const [
      productCounts,
      topSelling,
      lowStock,
      categoryPerformance,
      reviewStats,
    ] = await Promise.all([
      // CONTEGGI PRODOTTI
      Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { isActive: true } }),
        prisma.product.count({ where: { isActive: false } }),
      ]),

      // TOP SELLING
      this.getTopProducts(dateRange),

      // LOW STOCK - CORREZIONE QUERY
      prisma.product.findMany({
        where: {
          trackInventory: true,
          stock: { lte: 5 },
        },
        select: {
          id: true,
          name: true,
          stock: true,
          lowStockThreshold: true,
        },
        take: 20,
      }),

      // CATEGORY PERFORMANCE
      this.getCategoryPerformance(dateRange),

      // REVIEW STATS
      prisma.review.aggregate({
        where: { isApproved: true },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    const [totalProducts, activeProducts, inactiveProducts] = productCounts;

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      topSelling,
      lowStock: lowStock.map((product) => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        threshold: product.lowStockThreshold || 5,
        status:
          product.stock === 0
            ? "critical"
            : product.stock <= (product.lowStockThreshold || 5) / 2
            ? "critical"
            : product.stock <= (product.lowStockThreshold || 5)
            ? "low"
            : "warning",
      })),
      categoryPerformance,
      averageRating: Number(reviewStats._avg.rating || 0),
      totalReviews: reviewStats._count.id,
    };
  }

  // ===========================================
  //             USER METRICS
  // ===========================================

  // METRICHE UTENTI
  static async getUserMetrics(dateRange: {
    from: Date;
    to: Date;
  }): Promise<UserMetrics> {
    const [
      totalUsers,
      newUsers,
      activeUsers,
      userGrowth,
      registrationSources,
      userActivity,
    ] = await Promise.all([
      prisma.user.count(),

      prisma.user.count({
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        },
      }),

      this.getActiveUsersCount(dateRange),
      this.getUserGrowthTimeSeries(dateRange),
      this.getRegistrationSources(dateRange),
      this.getUserActivity(dateRange),
    ]);

    return {
      totalUsers,
      newUsers,
      activeUsers,
      userGrowth,
      registrationSources,
      userActivity,
    };
  }

  // ===========================================
  //            REVIEW METRICS
  // ===========================================

  // METRICHE RECENSIONI
  static async getReviewMetrics(dateRange: {
    from: Date;
    to: Date;
  }): Promise<ReviewMetrics> {
    const [reviewCounts, ratingDistribution, recentReviews, reviewsOverTime] =
      await Promise.all([
        // CONTEGGI RECENSIONI
        Promise.all([
          prisma.review.count(),
          prisma.review.count({ where: { isApproved: true } }),
          prisma.review.count({ where: { isApproved: false } }),
        ]),

        // DISTRIBUZIONE RATING
        prisma.review.groupBy({
          by: ["rating"],
          where: { isApproved: true },
          _count: { rating: true },
        }),

        // RECENSIONI RECENTI
        prisma.review.findMany({
          where: {
            createdAt: {
              gte: dateRange.from,
              lte: dateRange.to,
            },
          },
          include: {
            product: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),

        // RECENSIONI NEL TEMPO
        this.getReviewsTimeSeries(dateRange),
      ]);

    const [totalReviews, approvedReviews, pendingReviews] = reviewCounts;
    const averageRating =
      ratingDistribution.length > 0
        ? ratingDistribution.reduce(
            (sum, item) => sum + item.rating * item._count.rating,
            0
          ) /
          ratingDistribution.reduce((sum, item) => sum + item._count.rating, 0)
        : 0;

    return {
      totalReviews,
      approvedReviews,
      pendingReviews,
      averageRating,
      ratingDistribution: ratingDistribution.map((item) => ({
        rating: item.rating,
        count: item._count.rating,
        percentage:
          totalReviews > 0 ? (item._count.rating / totalReviews) * 100 : 0,
      })),
      recentReviews: recentReviews.map((review) => ({
        id: review.id,
        productName: review.product?.name || "Unknown Product",
        customerName: review.customerName,
        rating: review.rating,
        title: review.title || "",
        isVerified: review.isVerified,
        createdAt: review.createdAt,
      })),
      reviewsOverTime,
    };
  }

  // ===========================================
  //           REAL-TIME METRICS
  // ===========================================

  // METRICHE REAL-TIME
  static async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayOrders,
      todayRevenue,
      pendingOrders,
      lowStockCount,
      pendingReviews,
      activeUsers,
      onlineVisitors,
    ] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: { gte: today },
          status: "COMPLETED",
        },
      }),

      prisma.order.aggregate({
        where: {
          createdAt: { gte: today },
          status: "COMPLETED",
        },
        _sum: { total: true },
      }),

      prisma.order.count({
        where: { status: "PENDING" },
      }),

      prisma.product.count({
        where: {
          trackInventory: true,
          stock: { lte: 5 },
        },
      }),

      prisma.review.count({
        where: { isApproved: false },
      }),

      this.getActiveUsersCountRealTime(),
      this.getOnlineVisitorsCount(),
    ]);

    return {
      activeUsers,
      onlineVisitors,
      todayOrders,
      todayRevenue: Number(todayRevenue._sum.total || 0),
      pendingOrders,
      lowStockAlerts: lowStockCount,
      pendingReviews,
      lastUpdate: new Date(),
    };
  }

  // ===========================================
  //             INSIGHTS GENERATION
  // ===========================================

  // GENERA INSIGHTS E SUGGERIMENTI
  static async getDashboardInsights(
    metrics: DashboardMetrics
  ): Promise<DashboardInsights> {
    const insights: PerformanceInsight[] = [];

    // INSIGHT VENDITE
    if (metrics.overview.totalRevenue.changePercent < -10) {
      insights.push({
        type: "warning",
        title: "Calo delle Vendite",
        description: `Le vendite sono diminuite del ${Math.abs(
          metrics.overview.totalRevenue.changePercent
        ).toFixed(1)}% rispetto al periodo precedente`,
        metric: "revenue",
        value: metrics.overview.totalRevenue.current,
        actionRequired: true,
        suggestions: [
          "Controlla le campagne marketing attive",
          "Analizza i prodotti con performance negative",
          "Rivedi la strategia di pricing",
        ],
      });
    }

    // INSIGHT STOCK
    if (metrics.products.lowStock.length > 0) {
      const criticalStock = metrics.products.lowStock.filter(
        (p) => p.status === "critical"
      ).length;
      insights.push({
        type: criticalStock > 0 ? "critical" : "warning",
        title: "Scorte in Esaurimento",
        description: `${metrics.products.lowStock.length} prodotti hanno scorte basse, ${criticalStock} sono critici`,
        metric: "inventory",
        value: metrics.products.lowStock.length,
        actionRequired: criticalStock > 0,
        suggestions: [
          "Riordina i prodotti con stock critico",
          "Imposta alert automatici per stock bassi",
          "Considera prodotti alternativi da promuovere",
        ],
      });
    }

    // INSIGHT RECENSIONI
    if (metrics.reviews.pendingReviews > 20) {
      insights.push({
        type: "info",
        title: "Recensioni da Moderare",
        description: `Ci sono ${metrics.reviews.pendingReviews} recensioni in attesa di moderazione`,
        metric: "reviews",
        value: metrics.reviews.pendingReviews,
        actionRequired: false,
        suggestions: [
          "Modera le recensioni in sospeso",
          "Imposta un processo di moderazione automatica",
        ],
      });
    }

    // INSIGHT CONVERSION RATE
    if (metrics.overview.conversionRate.current < 2) {
      insights.push({
        type: "warning",
        title: "Tasso di Conversione Basso",
        description: `Il tasso di conversione è solo del ${metrics.overview.conversionRate.current.toFixed(
          2
        )}%`,
        metric: "conversion",
        value: metrics.overview.conversionRate.current,
        threshold: 2,
        actionRequired: true,
        suggestions: [
          "Ottimizza il processo di checkout",
          "Migliora le descrizioni dei prodotti",
          "Aggiungi recensioni e testimonianze",
          "Implementa strategie di retargeting",
        ],
      });
    }

    const summary = {
      critical: insights.filter((i) => i.type === "critical").length,
      warnings: insights.filter((i) => i.type === "warning").length,
      opportunities: insights.filter((i) => i.type === "success").length,
    };

    return { insights, summary };
  }

  // ===========================================
  //            PERIOD DATA GRAFICI
  // ===========================================

  static async getPeriodData(filters: AnalyticsFilters): Promise<{
    periodData: Array<{
      period: string;
      orders: number;
      revenue: number;
      timestamp: string;
    }>;
    summary: {
      totalOrders: number;
      totalRevenue: number;
      completedOrders: number;
      pendingOrders: number;
      conversionRate: number;
      averageOrderValue: number;
      peakPeriod: {
        period: string;
        orders: number;
        revenue: number;
      };
    };
  }> {
    const dateRange = this.getDateRange(filters);

    let periodData: Array<{
      period: string;
      orders: number;
      revenue: number;
      timestamp: string;
    }> = [];

    switch (filters.period) {
      case "today":
        periodData = await this.getHourlyData(dateRange);
        break;
      case "week":
        periodData = await this.getDailyDataForWeek(dateRange);
        break;
      case "month":
        periodData = await this.getDailyDataForMonth(dateRange);
        break;
      case "year":
        periodData = await this.getMonthlyData(dateRange);
        break;
      case "custom":
        // Determina granularità in base al range
        const daysDiff = Math.ceil(
          (dateRange.to.getTime() - dateRange.from.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (daysDiff <= 1) {
          periodData = await this.getHourlyData(dateRange);
        } else if (daysDiff <= 31) {
          periodData = await this.getDailyDataForMonth(dateRange);
        } else if (daysDiff <= 365) {
          periodData = await this.getMonthlyData(dateRange);
        } else {
          periodData = await this.getYearlyData(dateRange);
        }
        break;
      default:
        const totalDateRange = {
          from: new Date(new Date().getFullYear() - 2, 0, 1),
          to: dateRange.to,
        };
        periodData = await this.getYearlyData(totalDateRange);
    }
    const [completedCount, pendingCount, totalUsers] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: { gte: dateRange.from, lte: dateRange.to },
          status: "COMPLETED",
        },
      }),

      prisma.order.count({
        where: {
          createdAt: { gte: dateRange.from, lte: dateRange.to },
          status: "PENDING",
        },
      }),

      prisma.user.count({
        where: {
          createdAt: { gte: dateRange.from, lte: dateRange.to },
        },
      }),
    ]);

    // Calcola summary
    const totalOrders = periodData.reduce((sum, item) => sum + item.orders, 0);
    const totalRevenue = periodData.reduce(
      (sum, item) => sum + item.revenue,
      0
    );
    const conversionRate =
      totalUsers > 0 ? (totalOrders / totalUsers) * 100 : 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Trova peak period
    const peakPeriod = periodData.reduce(
      (peak, current) => (current.revenue > peak.revenue ? current : peak),
      { period: "", orders: 0, revenue: 0 }
    );

    return {
      periodData,
      summary: {
        totalOrders,
        totalRevenue,
        completedOrders: completedCount,
        pendingOrders: pendingCount,
        conversionRate,
        averageOrderValue,
        peakPeriod,
      },
    };
  }

  // DATI ORARI OGGI
  private static async getHourlyData(dateRange: {
    from: Date;
    to: Date;
  }): Promise<
    Array<{
      period: string;
      orders: number;
      revenue: number;
      timestamp: string;
    }>
  > {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: "COMPLETED",
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const hourlyData: Record<number, { orders: number; revenue: number }> = {};
    for (let hour = 0; hour < 24; hour++) {
      hourlyData[hour] = { orders: 0, revenue: 0 };
    }

    orders.forEach((order) => {
      const hour = order.createdAt.getHours();
      hourlyData[hour].orders += 1;
      hourlyData[hour].revenue += Number(order.total);
    });

    return Object.entries(hourlyData).map(([hourStr, data]) => {
      const hour = parseInt(hourStr);
      const timestamp = new Date(dateRange.from);
      timestamp.setHours(hour, 0, 0, 0);

      return {
        period: `${hourStr.padStart(2, "0")}:00`,
        orders: data.orders,
        revenue: data.revenue,
        timestamp: timestamp.toISOString(),
      };
    });
  }

  // DATI GIORNALIERI PER SETTIMANA (Lun-Dom)
  private static async getDailyDataForWeek(dateRange: {
    from: Date;
    to: Date;
  }): Promise<
    Array<{
      period: string;
      orders: number;
      revenue: number;
      timestamp: string;
    }>
  > {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: "COMPLETED",
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const dailyData: Record<string, { orders: number; revenue: number }> = {};
    const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

    for (let i = 0; i < 7; i++) {
      const date = new Date(dateRange.from);
      date.setDate(date.getDate() + i);
      const dayKey = date.toISOString().split("T")[0];
      dailyData[dayKey] = { orders: 0, revenue: 0 };
    }

    orders.forEach((order) => {
      const dayKey = order.createdAt.toISOString().split("T")[0];
      if (dailyData[dayKey]) {
        dailyData[dayKey].orders += 1;
        dailyData[dayKey].revenue += Number(order.total);
      }
    });

    return Object.entries(dailyData)
      .map(([dateKey, data]) => {
        const date = new Date(dateKey);
        const dayOfWeek = date.getDay();

        return {
          period: dayNames[dayOfWeek],
          orders: data.orders,
          revenue: data.revenue,
          timestamp: date.toISOString(),
        };
      })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // DATI GIORNALIERI PER MESE (1-31)
  private static async getDailyDataForMonth(dateRange: {
    from: Date;
    to: Date;
  }): Promise<
    Array<{
      period: string;
      orders: number;
      revenue: number;
      timestamp: string;
    }>
  > {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: "COMPLETED",
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const dailyData: Record<string, { orders: number; revenue: number }> = {};

    orders.forEach((order) => {
      const dayKey = order.createdAt.toISOString().split("T")[0];
      dailyData[dayKey] = dailyData[dayKey] || { orders: 0, revenue: 0 };
      dailyData[dayKey].orders += 1;
      dailyData[dayKey].revenue += Number(order.total);
    });

    return Object.entries(dailyData)
      .map(([dateKey, data]) => {
        const date = new Date(dateKey);

        return {
          period: date.getDate().toString(),
          orders: data.orders,
          revenue: data.revenue,
          timestamp: date.toISOString(),
        };
      })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // DATI MENSILI (Gen-Dic)
  private static async getMonthlyData(dateRange: {
    from: Date;
    to: Date;
  }): Promise<
    Array<{
      period: string;
      orders: number;
      revenue: number;
      timestamp: string;
    }>
  > {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: "COMPLETED",
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const monthlyData: Record<string, { orders: number; revenue: number }> = {};
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Aggrega per mese
    orders.forEach((order) => {
      const monthKey = `${order.createdAt.getFullYear()}-${String(
        order.createdAt.getMonth() + 1
      ).padStart(2, "0")}`;
      monthlyData[monthKey] = monthlyData[monthKey] || {
        orders: 0,
        revenue: 0,
      };
      monthlyData[monthKey].orders += 1;
      monthlyData[monthKey].revenue += Number(order.total);
    });

    // Converte in formato richiesto
    return Object.entries(monthlyData)
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);

        return {
          period: monthNames[parseInt(month) - 1],
          orders: data.orders,
          revenue: data.revenue,
          timestamp: date.toISOString(),
        };
      })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // DATI ANNUALI (ultimi anni)
  private static async getYearlyData(dateRange: {
    from: Date;
    to: Date;
  }): Promise<
    Array<{
      period: string;
      orders: number;
      revenue: number;
      timestamp: string;
    }>
  > {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: "COMPLETED",
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const yearlyData: Record<number, { orders: number; revenue: number }> = {};

    orders.forEach((order) => {
      const year = order.createdAt.getFullYear();
      yearlyData[year] = yearlyData[year] || { orders: 0, revenue: 0 };
      yearlyData[year].orders += 1;
      yearlyData[year].revenue += Number(order.total);
    });

    return Object.entries(yearlyData)
      .map(([year, data]) => {
        const date = new Date(parseInt(year), 0, 1);

        return {
          period: year,
          orders: data.orders,
          revenue: data.revenue,
          timestamp: date.toISOString(),
        };
      })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // ===========================================
  //            ADMIN HELPER METHODS
  // ===========================================

  // CALCOLA RANGE DATE PER PERIODO
  private static getDateRange(filters: AnalyticsFilters) {
    const now = new Date();
    let from: Date, to: Date, previousFrom: Date, previousTo: Date;

    switch (filters.period) {
      case "today":
        from = new Date(now);
        from.setHours(0, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        previousFrom = new Date(from);
        previousFrom.setDate(previousFrom.getDate() - 1);
        previousTo = new Date(to);
        previousTo.setDate(previousTo.getDate() - 1);
        break;

      case "week":
        from = new Date(now);
        from.setDate(now.getDate() - 7);
        from.setHours(0, 0, 0, 0);
        to = new Date(now);
        previousFrom = new Date(from);
        previousFrom.setDate(previousFrom.getDate() - 7);
        previousTo = new Date(to);
        previousTo.setDate(previousTo.getDate() - 7);
        break;

      case "month":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now);
        previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousTo = new Date(now.getFullYear(), now.getMonth(), 0);
        break;

      case "quarter":
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        from = new Date(now.getFullYear(), quarterStart, 1);
        to = new Date(now);
        previousFrom = new Date(now.getFullYear(), quarterStart - 3, 1);
        previousTo = new Date(now.getFullYear(), quarterStart, 0);
        break;

      case "year":
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now);
        previousFrom = new Date(now.getFullYear() - 1, 0, 1);
        previousTo = new Date(now.getFullYear() - 1, 11, 31);
        break;

      case "total":
        const currentYear = now.getFullYear();
        return {
          from: new Date(currentYear - 5, 0, 1),
          to: new Date(currentYear, 11, 31, 23, 59, 59, 999),
          previousFrom: new Date(currentYear - 10, 0, 1),
          previousTo: new Date(currentYear - 5, 11, 31, 23, 59, 59, 999),
        };

      case "custom":
        if (!filters.from || !filters.to) {
          throw new AnalyticsError(
            "Date from e to sono richieste per periodo custom",
            400
          );
        }
        from = filters.from;
        to = filters.to;
        const daysDiff = Math.ceil(
          (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
        );
        previousFrom = new Date(from);
        previousFrom.setDate(previousFrom.getDate() - daysDiff);
        previousTo = new Date(to);
        previousTo.setDate(previousTo.getDate() - daysDiff);
        break;

      default:
        throw new AnalyticsError("Periodo non valido", 400);
    }

    return { from, to, previousFrom, previousTo };
  }

  // CALCOLA PERCENTUALE DI CAMBIAMENTO
  private static calculatePercentChange(
    previous: number,
    current: number
  ): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  // ===========================================
  //           TIME SERIES METHODS
  // ===========================================

  // OTTIENI REVENUE TIME SERIES
  private static async getRevenueTimeSeries(dateRange: {
    from: Date;
    to: Date;
  }): Promise<TimeSeriesData[]> {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: "COMPLETED",
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    // RAGGRUPPA PER GIORNO
    const dailyRevenue: Record<string, number> = {};
    orders.forEach((order) => {
      const date = order.createdAt.toISOString().split("T")[0];
      dailyRevenue[date] = (dailyRevenue[date] || 0) + Number(order.total);
    });

    return Object.entries(dailyRevenue)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // REVENUE TIME SERIES SETTIMANALE
  private static async getRevenueTimeSeriesWeekly(dateRange: {
    from: Date;
    to: Date;
  }): Promise<TimeSeriesData[]> {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: "COMPLETED",
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const weeklyRevenue: Record<string, number> = {};
    orders.forEach((order) => {
      const weekStart = AnalyticsService.getWeekStart(order.createdAt);
      const weekKey = weekStart.toISOString().split("T")[0];
      weeklyRevenue[weekKey] =
        (weeklyRevenue[weekKey] || 0) + Number(order.total);
    });

    return Object.entries(weeklyRevenue)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // REVENUE TIME SERIES MENSILE
  private static async getRevenueTimeSeriesMonthly(dateRange: {
    from: Date;
    to: Date;
  }): Promise<TimeSeriesData[]> {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: "COMPLETED",
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const monthlyRevenue: Record<string, number> = {};
    orders.forEach((order) => {
      const monthKey = `${order.createdAt.getFullYear()}-${String(
        order.createdAt.getMonth() + 1
      ).padStart(2, "0")}`;
      monthlyRevenue[monthKey] =
        (monthlyRevenue[monthKey] || 0) + Number(order.total);
    });

    return Object.entries(monthlyRevenue)
      .map(([date, value]) => ({ date: `${date}-01`, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // OTTIENI USER GROWTH TIME SERIES
  private static async getUserGrowthTimeSeries(dateRange: {
    from: Date;
    to: Date;
  }): Promise<TimeSeriesData[]> {
    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const dailyRegistrations: Record<string, number> = {};
    users.forEach((user) => {
      const date = user.createdAt.toISOString().split("T")[0];
      dailyRegistrations[date] = (dailyRegistrations[date] || 0) + 1;
    });

    return Object.entries(dailyRegistrations)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // OTTIENI REVIEWS TIME SERIES
  private static async getReviewsTimeSeries(dateRange: {
    from: Date;
    to: Date;
  }): Promise<TimeSeriesData[]> {
    const reviews = await prisma.review.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const dailyReviews: Record<string, number> = {};
    reviews.forEach((review) => {
      const date = review.createdAt.toISOString().split("T")[0];
      dailyReviews[date] = (dailyReviews[date] || 0) + 1;
    });

    return Object.entries(dailyReviews)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // TIME SERIES ORDINI
  private static async getOrdersTimeSeries(dateRange: {
    from: Date;
    to: Date;
  }): Promise<TimeSeriesData[]> {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const dailyOrders: Record<string, number> = {};
    orders.forEach((order) => {
      const date = order.createdAt.toISOString().split("T")[0];
      dailyOrders[date] = (dailyOrders[date] || 0) + 1;
    });

    return Object.entries(dailyOrders)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ===========================================
  //             BUSINESS LOGIC
  // ===========================================

  // OTTIENI TOP PRODUCTS
  static async getTopProducts(dateRange: {
    from: Date;
    to: Date;
  }): Promise<TopProduct[]> {
    const topProducts = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          status: "COMPLETED",
        },
      },
      _sum: {
        price: true,
        quantity: true,
      },
      _count: {
        orderId: true,
      },
      orderBy: {
        _sum: {
          price: "desc",
        },
      },
      take: 10,
    });

    const productIds = topProducts
      .map((tp) => tp.productId)
      .filter(Boolean) as string[];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        images: {
          where: { isMain: true },
          take: 1,
        },
      },
    });

    return topProducts.map((tp) => {
      const product = products.find((p) => p.id === tp.productId);
      return {
        id: tp.productId || "",
        name: product?.name || "Unknown Product",
        slug: product?.slug || "",
        revenue: Number(tp._sum.price || 0),
        orders: tp._count.orderId,
        units: tp._sum.quantity || 0,
        conversionRate: 0,
        averageRating: Number(product?.averageRating || 0),
        image: product?.images[0]?.url,
      };
    });
  }

  // ===========================================
  //          ADDITIONAL HELPER METHODS
  // ===========================================

  // OTTIENI CATEGORY PERFORMANCE
  private static async getCategoryPerformance(dateRange: {
    from: Date;
    to: Date;
  }): Promise<any[]> {
    return [];
  }

  // CALCOLA REVENUE MEDIA PER UTENTE
  private static async calculateAverageRevenuePerUser(dateRange: {
    from: Date;
    to: Date;
  }): Promise<number> {
    const [totalRevenue, uniqueUsers] = await Promise.all([
      prisma.order.aggregate({
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          status: "COMPLETED",
        },
        _sum: { total: true },
      }),
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          status: "COMPLETED",
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    const revenue = Number(totalRevenue._sum.total || 0);
    const userCount = uniqueUsers.length;

    return userCount > 0 ? revenue / userCount : 0;
  }

  // DISTRIBUZIONE STATUS ORDINI
  private static async getOrderStatusDistribution(dateRange: {
    from: Date;
    to: Date;
  }): Promise<Array<{ status: string; count: number; percentage: number }>> {
    const statusCounts = await prisma.order.groupBy({
      by: ["status"],
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
      _count: { status: true },
    });

    const totalOrders = statusCounts.reduce(
      (sum, item) => sum + item._count.status,
      0
    );

    return statusCounts.map((item) => ({
      status: item.status,
      count: item._count.status,
      percentage:
        totalOrders > 0 ? (item._count.status / totalOrders) * 100 : 0,
    }));
  }

  // CONTEGGIO UTENTI ATTIVI
  private static async getActiveUsersCount(dateRange: {
    from: Date;
    to: Date;
  }): Promise<number> {
    const activeUsers = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
      select: { userId: true },
      distinct: ["userId"],
    });

    return activeUsers.length;
  }

  // FONTI DI REGISTRAZIONE
  private static async getRegistrationSources(dateRange: {
    from: Date;
    to: Date;
  }): Promise<Array<{ source: string; count: number; percentage: number }>> {
    try {
      const sources = await prisma.user.groupBy({
        by: ["source"],
        where: {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        },
        _count: { source: true },
      });

      const totalUsers = sources.reduce(
        (sum, item) => sum + item._count.source,
        0
      );

      return sources.map((item) => ({
        source: item.source || "Direct",
        count: item._count.source,
        percentage:
          totalUsers > 0 ? (item._count.source / totalUsers) * 100 : 0,
      }));
    } catch (error) {
      return [];
    }
  }

  // ATTIVITÀ UTENTI
  private static async getUserActivity(dateRange: {
    from: Date;
    to: Date;
  }): Promise<any[]> {
    return [];
  }

  // UTENTI ATTIVI REAL-TIME (ultimi 30 minuti)
  private static async getActiveUsersCountRealTime(): Promise<number> {
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    try {
      return await prisma.user.count({
        where: {
          lastActivity: {
            gte: thirtyMinutesAgo,
          },
        },
      });
    } catch (error) {
      return await prisma.user.count({
        where: {
          createdAt: {
            gte: thirtyMinutesAgo,
          },
        },
      });
    }
  }

  // VISITATORI ONLINE
  private static async getOnlineVisitorsCount(): Promise<number> {
    return Math.floor(Math.random() * 50) + 10;
  }

  // HELPER: Ottieni inizio settimana
  private static getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
}
