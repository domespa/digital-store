import { Request, Response } from "express";
import { AnalyticsService } from "../services/analyticsService";
import { AnalyticsFilters, AnalyticsError } from "../types/analytics";
import { UserProfile } from "../types/auth";
import { catchAsync } from "../utils/catchAsync";

// INTERFACCIA PER REQUEST ADMIN
interface AdminRequest extends Request {
  user: UserProfile & { role: "ADMIN"; emailVerified: boolean };
}

// QUERY PARAMETERS
interface AnalyticsQueryParams {
  period?: "today" | "week" | "month" | "quarter" | "year" | "total" | "custom";
  from?: string;
  to?: string;
  categoryId?: string;
  productId?: string;
  currency?: string;
  paymentMethod?: "STRIPE" | "PAYPAL";
}

export class AnalyticsController {
  // DASHBOARD METRICS COMPLETE
  // GET /api/admin/analytics/dashboard
  static getDashboardMetrics = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const filters = this.parseAnalyticsFilters(
        req.query as AnalyticsQueryParams
      );
      const metrics = await AnalyticsService.getDashboardMetrics(filters);
      const insights = await AnalyticsService.getDashboardInsights(metrics);

      res.json({
        success: true,
        data: {
          metrics,
          insights,
        },
      });
    }
  );

  // METRICHE OVERVIEW (KPI PRINCIPALI)
  // GET /api/admin/analytics/overview
  static getOverviewMetrics = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const filters = this.parseAnalyticsFilters(
        req.query as AnalyticsQueryParams
      );
      const dateRange = this.getDateRangeFromFilters(filters);
      const overview = await AnalyticsService.getOverviewMetrics(dateRange);

      res.json({
        success: true,
        data: {
          overview,
          period: filters.period,
          dateRange: {
            from: dateRange.from,
            to: dateRange.to,
          },
        },
      });
    }
  );

  // METRICHE VENDITE
  // GET /api/admin/analytics/sales
  static getSalesMetrics = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const filters = this.parseAnalyticsFilters(
        req.query as AnalyticsQueryParams
      );
      const dateRange = this.getDateRangeFromFilters(filters);
      const sales = await AnalyticsService.getSalesMetrics(dateRange);

      res.json({
        success: true,
        data: {
          sales,
          period: filters.period,
        },
      });
    }
  );

  // METRICHE PRODOTTI
  // GET /api/admin/analytics/products
  static getProductMetrics = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const filters = this.parseAnalyticsFilters(
        req.query as AnalyticsQueryParams
      );
      const dateRange = this.getDateRangeFromFilters(filters);
      const products = await AnalyticsService.getProductMetrics(dateRange);

      res.json({
        success: true,
        data: {
          products,
          period: filters.period,
        },
      });
    }
  );

  // METRICHE UTENTI
  // GET /api/admin/analytics/users
  static getUserMetrics = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const filters = this.parseAnalyticsFilters(
        req.query as AnalyticsQueryParams
      );
      const dateRange = this.getDateRangeFromFilters(filters);
      const users = await AnalyticsService.getUserMetrics(dateRange);

      res.json({
        success: true,
        data: {
          users,
          period: filters.period,
        },
      });
    }
  );

  // METRICHE RECENSIONI
  // GET /api/admin/analytics/reviews
  static getReviewMetrics = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const filters = this.parseAnalyticsFilters(
        req.query as AnalyticsQueryParams
      );
      const dateRange = this.getDateRangeFromFilters(filters);
      const reviews = await AnalyticsService.getReviewMetrics(dateRange);

      res.json({
        success: true,
        data: {
          reviews,
          period: filters.period,
        },
      });
    }
  );

  // METRICHE REAL-TIME
  // GET /api/admin/analytics/realtime
  static getRealTimeMetrics = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const realTime = await AnalyticsService.getRealTimeMetrics();

      res.json({
        success: true,
        data: {
          realTime,
        },
      });
    }
  );

  // INSIGHTS E SUGGERIMENTI
  // GET /api/admin/analytics/insights
  static getDashboardInsights = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const filters = this.parseAnalyticsFilters(
        req.query as AnalyticsQueryParams
      );
      const metrics = await AnalyticsService.getDashboardMetrics(filters);
      const insights = await AnalyticsService.getDashboardInsights(metrics);

      res.json({
        success: true,
        data: insights,
      });
    }
  );

  // TOP PRODUCTS PER PERIODO
  // GET /api/admin/analytics/top-products
  static getTopProducts = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const filters = this.parseAnalyticsFilters(
        req.query as AnalyticsQueryParams
      );
      const { limit } = req.query;

      const dateRange = this.getDateRangeFromFilters(filters);
      const topProducts = await AnalyticsService.getTopProducts(dateRange);

      const limitNum = limit ? parseInt(limit as string) : 10;

      res.json({
        success: true,
        data: {
          topProducts: topProducts.slice(0, limitNum),
          period: filters.period,
          total: topProducts.length,
        },
      });
    }
  );

  // GET /api/admin/analytics/period-data
  static getPeriodData = catchAsync(
    async (req: AdminRequest, res: Response) => {
      const { period, from, to } = req.query;

      // Validazione parametri
      if (
        !period ||
        !["today", "week", "month", "year", "total"].includes(period as string)
      ) {
        throw new AnalyticsError(
          "Parametro period richiesto: today|week|month|year|total",
          400
        );
      }

      const filters: AnalyticsFilters = {
        period: period as
          | "today"
          | "week"
          | "month"
          | "year"
          | "total"
          | "custom",
        ...(from ? { from: new Date(from as string) } : {}),
        ...(to ? { to: new Date(to as string) } : {}),
      };

      const data = await AnalyticsService.getPeriodData(filters);

      res.json({
        success: true,
        data,
      });
    }
  );

  // ==================== METODI HELPER PRIVATI ====================

  // PARSE ANALYTICS FILTERS DA QUERY
  private static parseAnalyticsFilters(
    query: AnalyticsQueryParams
  ): AnalyticsFilters {
    const filters: AnalyticsFilters = {
      period: query.period || "week",
    };

    // DATE CUSTOM
    if (filters.period === "custom") {
      if (query.from) {
        filters.from = new Date(query.from);
        if (isNaN(filters.from.getTime())) {
          throw new AnalyticsError("Data 'from' non valida", 400);
        }
      }
      if (query.to) {
        filters.to = new Date(query.to);
        if (isNaN(filters.to.getTime())) {
          throw new AnalyticsError("Data 'to' non valida", 400);
        }
      }
    }

    // ALTRI FILTRI
    if (query.categoryId) {
      filters.categoryId = query.categoryId;
    }
    if (query.productId) {
      filters.productId = query.productId;
    }
    if (query.currency) {
      filters.currency = query.currency;
    }
    if (query.paymentMethod) {
      filters.paymentMethod = query.paymentMethod;
    }

    return filters;
  }

  // CONVERTE FILTERS A DATE RANGE
  private static getDateRangeFromFilters(filters: AnalyticsFilters) {
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
}
