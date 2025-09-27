import { Card } from "../../components/ui/Card";
import { useRealTimeUsers } from "../../hooks/useRealTimeUsers";
import { TimeFilters } from "./TimeFilters";
import { ChartsSection } from "./ChartSection";
import { useAnalyticsDashboard } from "../../hooks/useAnalyticsDashboard";

export default function DashboardPage() {
  const { totalOnline, loading: usersLoading } = useRealTimeUsers();
  const analyticsData = useAnalyticsDashboard();

  const periodStats = analyticsData.insights.summary || {
    totalOrders: 0,
    totalRevenue: 0,
    completedOrders: 0,
    pendingOrders: 0,
    conversionRate: 0,
    averageOrderValue: 0,
  };

  const isLoading = usersLoading || Boolean(analyticsData.loading);

  const formatPrice = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    color = "blue",
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    color?: "blue" | "green" | "yellow" | "red" | "purple";
  }) => {
    const colors: Record<string, string> = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      red: "bg-red-500",
      purple: "bg-purple-500",
    };

    return (
      <Card>
        <div className="flex items-center">
          <div
            className={`p-3 rounded-lg ${colors[color]} text-white text-xl mr-4`}
          >
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Dashboard Analytics
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Overview of performance and business metrics
            </p>
          </div>
          <div className="animate-pulse h-8 w-64 bg-gray-200 rounded"></div>
        </div>

        {/* GRAF */}
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>

        {/* GRAF */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="h-80 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-80 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER*/}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of performance and business metrics
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={analyticsData.refreshData}
            disabled={analyticsData.loading || analyticsData.chartsLoading}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span
              className={`${
                analyticsData.loading || analyticsData.chartsLoading
                  ? "animate-spin"
                  : ""
              }`}
            >
              🔄
            </span>
            Refresh
          </button>

          <TimeFilters
            selectedPeriod={analyticsData.period}
            onPeriodChange={analyticsData.changePeriod}
            loading={analyticsData.chartsLoading}
          />
        </div>
      </div>
      {/* ERR */}
      {analyticsData.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">⚠️</span>
            <span className="text-red-700 text-sm">{analyticsData.error}</span>
          </div>
        </div>
      )}
      {/* ROW 1: STATS*/}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Orders"
          value={periodStats.totalOrders}
          subtitle={`Orders in ${analyticsData.period}`}
          icon="📦"
          color="blue"
        />
        <StatCard
          title="Completed Orders"
          value={periodStats.completedOrders}
          subtitle={`Completed in ${analyticsData.period}`}
          icon="✅"
          color="green"
        />
        <StatCard
          title="Pending Orders"
          value={periodStats.pendingOrders}
          subtitle={`Pending in ${analyticsData.period}`}
          icon="⏳"
          color="yellow"
        />
        <StatCard
          title="Total Revenue"
          value={formatPrice(periodStats.totalRevenue)}
          subtitle={`Revenue in ${analyticsData.period}`}
          icon="💰"
          color="green"
        />
      </div>
      {/* ROW 2: PERFSTATS*/}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Conversion Rate"
          value={`${periodStats.conversionRate?.toFixed(1) || 0}%`}
          subtitle={`Rate in ${analyticsData.period}`}
          icon="📊"
          color="purple"
        />
        <StatCard
          title="Avg Order Value"
          value={formatPrice(periodStats.averageOrderValue)}
          subtitle={`Average in ${analyticsData.period}`}
          icon="💳"
          color="blue"
        />
        {/* USERONLIE*/}
        <StatCard
          title="Users Online"
          value={totalOnline}
          subtitle="Users Online"
          icon="👥"
          color="green"
        />
      </div>
      {/* CHARTS SECTION */}
      <ChartsSection
        period={analyticsData.period}
        loading={analyticsData.chartsLoading}
        data={analyticsData.chartData}
      />
      {analyticsData.insights.peakPeriod && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <div className="text-center">
              <div className="text-2xl mb-2">🚀</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Peak Period
              </h3>
              <p className="text-3xl font-bold text-blue-600 mb-1">
                {analyticsData.insights.peakPeriod.period}
              </p>
              <p className="text-sm text-gray-600">
                {analyticsData.insights.peakPeriod.orders} ordini,{" "}
                {formatPrice(analyticsData.insights.peakPeriod.revenue)}
              </p>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-2xl mb-2">📈</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Orders by Period
              </h3>
              <p className="text-3xl font-bold text-green-600 mb-1">
                {analyticsData.insights.summary?.totalOrders || 0}
              </p>
              <p className="text-sm text-gray-600">Selected Period</p>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-2xl mb-2">💎</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Revenue Period
              </h3>
              <p className="text-3xl font-bold text-purple-600 mb-1">
                {formatPrice(analyticsData.insights.summary?.totalRevenue || 0)}
              </p>
              <p className="text-sm text-gray-600">Selected Period</p>
            </div>
          </Card>
        </div>
      )}
      {/* ROW 3: MANCA LOGICA TOPCOUNTR E RECENT ACT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            🌍 <span className="ml-2">Top Countries</span>
          </h3>
        </Card>

        {/* RECENT*/}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            🔔 <span className="ml-2">Recent Activity</span>
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto"></div>
        </Card>
      </div>
    </div>
  );
}
