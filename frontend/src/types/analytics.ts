export type TimePeriod = "OGGI" | "SETTIMANA" | "MESE" | "ANNO" | "TOTALE";

export interface ChartDataPoint {
  period: string;
  orders: number;
  revenue: number;
  timestamp: string;
}

export interface AnalyticsInsights {
  peakPeriod?: {
    period: string;
    orders: number;
    revenue: number;
  };
  summary?: {
    totalOrders: number;
    totalRevenue: number;
  };
}

export interface AnalyticsDashboardData {
  stats: any | null;

  chartData: ChartDataPoint[];

  insights: AnalyticsInsights;

  loading: boolean;
  chartsLoading: boolean;
  error: string | null;

  period: TimePeriod;
}

export interface AnalyticsDashboardActions {
  changePeriod: (period: TimePeriod) => void;
  refreshData: () => Promise<void>;
  refreshCharts: () => Promise<void>;
}
