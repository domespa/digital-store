import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../services/adminApi";
import type { DashboardStats } from "../types/admin";

export interface ChartDataPoint {
  period: string;
  orders: number;
  revenue: number;
  timestamp: string;
}

export type TimePeriod = "today" | "week" | "month" | "year" | "total";

export interface AnalyticsDashboardData {
  stats: DashboardStats | null;

  // GRAF
  chartData: ChartDataPoint[];

  insights: {
    peakPeriod?: {
      period: string;
      orders: number;
      revenue: number;
    };
    summary?: {
      totalOrders: number;
      totalRevenue: number;
      completedOrders: number;
      pendingOrders: number;
      conversionRate: number;
      averageOrderValue: number;
    };
  };

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

export function useAnalyticsDashboard(): AnalyticsDashboardData &
  AnalyticsDashboardActions {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [insights, setInsights] = useState<AnalyticsDashboardData["insights"]>(
    {}
  );
  const [period, setPeriod] = useState<TimePeriod>("today");

  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Converti TimePeriod frontend a periodo API backend
  const getApiFilters = useCallback((selectedPeriod: TimePeriod) => {
    const filters: {
      period: "today" | "week" | "month" | "year" | "total";
      from?: string;
      to?: string;
    } = {
      period: "week", // DEF
    };

    switch (selectedPeriod) {
      case "today":
        filters.period = "today";
        break;
      case "week":
        filters.period = "week";
        break;
      case "month":
        filters.period = "month";
        break;
      case "year":
        filters.period = "year";
        break;
      case "total":
        filters.period = "total";
        break;
      default:
        filters.period = "week";
    }

    return filters;
  }, []);

  // LOAD DATA
  const loadDashboardStats = useCallback(async () => {
    try {
      const statsData = await adminApi.getDashboardStats();
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error("Error loading dashboard stats:", err);
      setError("Errore nel caricamento delle statistiche dashboard");
    }
  }, []);

  const loadChartData = useCallback(
    async (selectedPeriod: TimePeriod) => {
      console.log("🚀 Loading chart data for period:", selectedPeriod);
      setChartsLoading(true);

      try {
        const filters = getApiFilters(selectedPeriod);
        console.log("📋 API filters:", filters);

        const response = await adminApi.getPeriodData(filters);
        console.log("✅ API Response received:", response);

        if (response && response.success && response.data) {
          const chartDataPoints: ChartDataPoint[] = Array.isArray(response.data)
            ? response.data.map((item: any) => ({
                period: item.period,
                orders: item.orders,
                revenue: item.revenue,
                timestamp: item.timestamp,
              }))
            : [];

          console.log("📊 Chart data points created:", chartDataPoints);
          setChartData(chartDataPoints);

          setInsights({
            peakPeriod: response.summary?.peakPeriod,
            summary: response.summary
              ? {
                  totalOrders: response.summary.totalOrders,
                  totalRevenue: response.summary.totalRevenue,
                  completedOrders: response.summary.completedOrders,
                  pendingOrders: response.summary.pendingOrders,
                  conversionRate: response.summary.conversionRate,
                  averageOrderValue: response.summary.averageOrderValue,
                }
              : undefined,
          });

          console.log("✅ Real data loaded successfully!");
        } else {
          console.warn("⚠️ Invalid API response structure:", response);
          setChartData([]);
          setInsights({});
        }

        setError(null);
      } catch (err: any) {
        console.error("❌ Error loading chart data:", err);
        setError("Errore nel caricamento dei dati grafici. Riprova più tardi.");
        // ✅ Set empty data on error
        setChartData([]);
        setInsights({});
      } finally {
        setChartsLoading(false);
      }
    },
    [getApiFilters]
  );

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);

      try {
        await Promise.all([loadDashboardStats(), loadChartData(period)]);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadChartData(period);
    }
  }, [period, loadChartData, loading]);

  const changePeriod = useCallback(
    (newPeriod: TimePeriod) => {
      if (newPeriod !== period) {
        setPeriod(newPeriod);
      }
    },
    [period]
  );

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadDashboardStats(), loadChartData(period)]);
    } finally {
      setLoading(false);
    }
  }, [loadDashboardStats, loadChartData, period]);

  const refreshCharts = useCallback(async () => {
    await loadChartData(period);
  }, [loadChartData, period]);

  return {
    // DATA
    stats,
    chartData,
    insights,
    period,

    // STATE
    loading,
    chartsLoading,
    error,

    // ACT
    changePeriod,
    refreshData,
    refreshCharts,
  };
}
