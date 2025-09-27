import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card } from "../../components/ui/Card";
import { useCallback, useEffect, useMemo, useState } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartDataPoint {
  period: string;
  orders: number;
  revenue: number;
  timestamp: string;
}

interface ChartsSectionProps {
  period: "today" | "week" | "month" | "year" | "total";
  loading?: boolean;
  data?: ChartDataPoint[];
}

export function ChartsSection({
  period,
  loading = false,
  data = [],
}: ChartsSectionProps) {
  // X
  const getChartLabels = useCallback(() => {
    switch (period) {
      case "today":
        return Array.from({ length: 24 }, (_, i) => {
          const hour = i.toString().padStart(2, "0");
          return `${hour}:00`;
        });

      case "week":
        return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      case "month":
        // Giorni del mese corrente
        const now = new Date();
        const daysInMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate();
        return Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

      case "year":
        return [
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

      case "total":
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => `${currentYear - 4 + i}`);

      default:
        return [];
    }
  }, [period]);

  const labels = getChartLabels();

  // GRAPH
  const ordersData = useMemo(() => {
    const ordersPerPeriod = Array(labels.length).fill(0);

    data.forEach((item) => {
      const index = labels.indexOf(item.period);
      if (index !== -1) {
        ordersPerPeriod[index] = item.orders;
      }
    });

    return {
      labels,
      datasets: [
        {
          label: `Ordini per ${getPeriodLabel(period)}`,
          data: ordersPerPeriod,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "rgb(59, 130, 246)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [data, labels, period]);

  const revenueData = useMemo(() => {
    const revenuePerPeriod = Array(labels.length).fill(0);

    data.forEach((item) => {
      const index = labels.indexOf(item.period);
      if (index !== -1) {
        revenuePerPeriod[index] = item.revenue;
      }
    });

    return {
      labels,
      datasets: [
        {
          label: `Revenue per ${getPeriodLabel(period)} (€)`,
          data: revenuePerPeriod,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "rgb(34, 197, 94)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [data, labels, period]);

  function getPeriodLabel(period: string): string {
    switch (period) {
      case "today":
        return "Hour";
      case "week":
        return "Day";
      case "month":
        return "Day";
      case "year":
        return "Month";
      case "total":
        return "Year";
      default:
        return "Periodo";
    }
  }

  function getPeriodDescription(period: string): string {
    switch (period) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This month";
      case "year":
        return "This Year";
      case "total":
        return "All time";
      default:
        return "Custom";
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          font: {
            size: 12,
            weight: "bold" as const,
          },
          color: "#374151",
          usePointStyle: true,
          pointStyle: "circle",
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (context: any) => {
            return `Ore ${context[0].label}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
          drawOnChartArea: true,
        },
        ticks: {
          color: "#6b7280",
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          color: "#6b7280",
          font: {
            size: 11,
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
  };

  // €
  const revenueOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: function (value: any) {
            return new Intl.NumberFormat("it-IT", {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value);
          },
        },
      },
    },
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          ...chartOptions.plugins.tooltip.callbacks,
          label: function (context: any) {
            return `Revenue: ${new Intl.NumberFormat("it-IT", {
              style: "currency",
              currency: "EUR",
            }).format(context.parsed.y)}`;
          },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="h-80 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
            <div className="text-gray-400">Loading order chart...</div>
          </div>
        </Card>
        <Card>
          <div className="h-80 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
            <div className="text-gray-400">Loading revenue chart...</div>
          </div>
        </Card>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-400 mb-2">📊</div>
              <div className="text-gray-500 text-sm">
                No order data available
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-400 mb-2">💰</div>
              <div className="text-gray-500 text-sm">
                No revenue data available
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* GRAF ORD */}
      <Card>
        <div className="h-80">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            📊 <span className="ml-2">Orders per {getPeriodLabel(period)}</span>
            <span className="ml-auto text-sm font-normal text-gray-500">
              {getPeriodDescription(period)}
            </span>
          </h3>
          <div className="h-64">
            <Line data={ordersData} options={chartOptions} />
          </div>
        </div>
      </Card>

      {/* GRAF REV */}
      <Card>
        <div className="h-80">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            💰{" "}
            <span className="ml-2">Revenue per {getPeriodLabel(period)}</span>
            <span className="ml-auto text-sm font-normal text-gray-500">
              {getPeriodDescription(period)}
            </span>
          </h3>
          <div className="h-64">
            <Line data={revenueData} options={revenueOptions} />
          </div>
        </div>
      </Card>
    </div>
  );
}

// =================================
//              HELPER
// =================================
export function useChartsData(
  period: "today" | "week" | "month" | "year" | "total"
) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChartsData = async () => {
      setLoading(true);
      setError(null);

      try {
        const mockData: ChartDataPoint[] = generateMockDataForPeriod(period);

        await new Promise((resolve) => setTimeout(resolve, 800));

        setData(mockData);
      } catch (err) {
        setError("Errore nel caricamento dei dati grafici");
        console.error("Charts data error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChartsData();
  }, [period]);

  return { data, loading, error };
}

function generateMockDataForPeriod(
  period: "today" | "week" | "month" | "year" | "total"
): ChartDataPoint[] {
  switch (period) {
    case "today":
      return Array.from({ length: 24 }, (_, hour) => {
        const isPeakTime =
          (hour >= 10 && hour <= 14) || (hour >= 18 && hour <= 22);
        const baseOrders = isPeakTime ? 8 : 2;
        const baseRevenue = isPeakTime ? 600 : 120;

        return {
          period: `${hour.toString().padStart(2, "0")}:00`,
          orders: Math.floor(Math.random() * baseOrders) + baseOrders,
          revenue: Math.floor(Math.random() * baseRevenue) + baseRevenue,
          timestamp: new Date().toISOString(),
        };
      });

    case "week":
      // 7 giorni: Lun-Dom
      const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return weekDays.map((day, index) => {
        const isWeekend = index >= 5;
        const baseOrders = isWeekend ? 15 : 25;
        const baseRevenue = isWeekend ? 1200 : 2000;

        return {
          period: day,
          orders: Math.floor(Math.random() * baseOrders) + baseOrders,
          revenue: Math.floor(Math.random() * baseRevenue) + baseRevenue,
          timestamp: new Date().toISOString(),
        };
      });

    case "month":
      // Giorni del mese corrente
      const now = new Date();
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      return Array.from({ length: daysInMonth }, (_, day) => {
        const dayNum = day + 1;
        const baseOrders = 20;
        const baseRevenue = 1500;

        return {
          period: dayNum.toString(),
          orders: Math.floor(Math.random() * baseOrders) + baseOrders,
          revenue: Math.floor(Math.random() * baseRevenue) + baseRevenue,
          timestamp: new Date().toISOString(),
        };
      });

    case "year":
      // 12 mesi
      const months = [
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
      return months.map((month) => {
        const baseOrders = 500;
        const baseRevenue = 40000;

        return {
          period: month,
          orders: Math.floor(Math.random() * baseOrders) + baseOrders,
          revenue: Math.floor(Math.random() * baseRevenue) + baseRevenue,
          timestamp: new Date().toISOString(),
        };
      });

    case "total":
      // Ultimi 5 anni
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 5 }, (_, index) => {
        const year = currentYear - 4 + index;
        const baseOrders = 5000;
        const baseRevenue = 500000;

        return {
          period: year.toString(),
          orders: Math.floor(Math.random() * baseOrders) + baseOrders,
          revenue: Math.floor(Math.random() * baseRevenue) + baseRevenue,
          timestamp: new Date().toISOString(),
        };
      });

    default:
      return [];
  }
}
