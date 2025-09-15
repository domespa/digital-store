export interface DashboardMetrics {
  overview: OverviewMetrics;
  sales: SalesMetrics;
  products: ProductMetrics;
  users: UserMetrics;
  reviews: ReviewMetrics;
  timeRange: {
    from: Date;
    to: Date;
    period: "today" | "week" | "month" | "quarter" | "year" | "custom";
  };
}

export interface OverviewMetrics {
  totalRevenue: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  totalOrders: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  totalUsers: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  conversionRate: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
}

export interface SalesMetrics {
  revenue: RevenueMetrics;
  orders: OrderMetrics;
  topProducts: TopProduct[];
  paymentMethods: PaymentMethodStats[];
  currencies: CurrencyStats[];
}

export interface RevenueMetrics {
  total: number;
  byDay: TimeSeriesData[];
  byWeek: TimeSeriesData[];
  byMonth: TimeSeriesData[];
  average: {
    perOrder: number;
    perUser: number;
    perDay: number;
  };
}

export interface OrderMetrics {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  refunded: number;
  statusDistribution: StatusCount[];
  byDay: TimeSeriesData[];
}

export interface ProductMetrics {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  topSelling: TopProduct[];
  lowStock: LowStockProduct[];
  categoryPerformance: CategoryPerformance[];
  averageRating: number;
  totalReviews: number;
}

export interface UserMetrics {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  userGrowth: TimeSeriesData[];
  registrationSources: RegistrationSource[];
  userActivity: UserActivity[];
}

export interface ReviewMetrics {
  totalReviews: number;
  approvedReviews: number;
  pendingReviews: number;
  averageRating: number;
  ratingDistribution: RatingDistribution[];
  recentReviews: RecentReview[];
  reviewsOverTime: TimeSeriesData[];
}

// SUPPORTING INTERFACES

export interface TimeSeriesData {
  date: string;
  value: number;
  label?: string;
}

export interface TopProduct {
  id: string;
  name: string;
  slug: string;
  revenue: number;
  orders: number;
  units: number;
  conversionRate: number;
  averageRating: number;
  image?: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  threshold: number;
  status: "critical" | "low" | "warning";
}

export interface CategoryPerformance {
  id: string;
  name: string;
  slug: string;
  revenue: number;
  orders: number;
  products: number;
  averageRating: number;
}

export interface PaymentMethodStats {
  method: "STRIPE" | "PAYPAL";
  count: number;
  revenue: number;
  percentage: number;
}

export interface CurrencyStats {
  currency: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface StatusCount {
  status: string;
  count: number;
  percentage: number;
}

export interface RegistrationSource {
  source: string;
  count: number;
  percentage: number;
}

export interface UserActivity {
  date: string;
  activeUsers: number;
  newRegistrations: number;
  orders: number;
}

export interface RatingDistribution {
  rating: number;
  count: number;
  percentage: number;
}

export interface RecentReview {
  id: string;
  productName: string;
  customerName: string;
  rating: number;
  title: string;
  isVerified: boolean;
  createdAt: Date;
}

// QUERY INTERFACES

export interface AnalyticsFilters {
  period: "today" | "week" | "month" | "quarter" | "year" | "custom";
  from?: Date;
  to?: Date;
  categoryId?: string;
  productId?: string;
  currency?: string;
  paymentMethod?: "STRIPE" | "PAYPAL";
}

export interface AnalyticsQuery {
  filters: AnalyticsFilters;
  metrics: MetricType[];
  groupBy?: "day" | "week" | "month" | "category" | "product";
}

export type MetricType =
  | "revenue"
  | "orders"
  | "users"
  | "products"
  | "reviews"
  | "inventory"
  | "performance";

// REAL-TIME METRICS

export interface RealTimeMetrics {
  activeUsers: number;
  onlineVisitors: number;
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  lowStockAlerts: number;
  pendingReviews: number;
  lastUpdate: Date;
}

// EXPORT INTERFACES

export interface ExportOptions {
  format: "csv" | "xlsx" | "pdf";
  metrics: MetricType[];
  period: AnalyticsFilters["period"];
  from?: Date;
  to?: Date;
  includeCharts?: boolean;
}

export interface ExportResult {
  filename: string;
  downloadUrl: string;
  size: number;
  expiresAt: Date;
}

// COMPARISON INTERFACES

export interface PeriodComparison {
  current: {
    period: string;
    value: number;
  };
  previous: {
    period: string;
    value: number;
  };
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
}

// PERFORMANCE INSIGHTS

export interface PerformanceInsight {
  type: "warning" | "info" | "success" | "critical";
  title: string;
  description: string;
  metric: string;
  value: number;
  threshold?: number;
  actionRequired: boolean;
  suggestions?: string[];
}

export interface DashboardInsights {
  insights: PerformanceInsight[];
  summary: {
    critical: number;
    warnings: number;
    opportunities: number;
  };
}

export class AnalyticsError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "AnalyticsError";
  }
}
