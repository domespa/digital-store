import { Card } from "../../components/ui/Card";
import { useRealTimeUsers } from "../../hooks/useRealTimeUsers";
import { TimeFilters } from "./TimeFilters";
import { ChartsSection } from "./ChartSection";
import { useAnalyticsDashboard } from "../../hooks/useAnalyticsDashboard";
import { useRecentActivity } from "../../hooks/useDashboardActivity";

export default function DashboardPage() {
  const { totalOnline, loading: usersLoading } = useRealTimeUsers();
  const analyticsData = useAnalyticsDashboard();
  const { recentActivity, isLoading: activityLoading } = useRecentActivity({
    limit: 20,
  });

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

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    color,
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
          <div className={`p-3 rounded-lg ${colors} text-white text-xl mr-4`}>
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

        <div className="flex flex-col gap-2">
          <TimeFilters
            loading={analyticsData.chartsLoading}
            selectedPeriod={analyticsData.period}
            onPeriodChange={analyticsData.changePeriod}
          />
          <button
            onClick={analyticsData.refreshData}
            disabled={analyticsData.loading || analyticsData.chartsLoading}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 
                 disabled:opacity-50 disabled:cursor-not-allowed flex items-center self-end border border-gray-300"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Revenue"
          value={formatPrice(periodStats.totalRevenue)}
          icon="💰"
        />
        <StatCard
          title="Completed Orders"
          value={periodStats.completedOrders}
          icon="✅"
        />
        <StatCard
          title="Pending Orders"
          value={periodStats.pendingOrders}
          icon="⏳"
        />
      </div>
      {/* ROW 2: PERFSTATS*/}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Conversion Rate"
          value={`${periodStats.conversionRate?.toFixed(1) || 0}%`}
          icon="📊"
        />
        <StatCard
          title="Avg Order Value"
          value={formatPrice(periodStats.averageOrderValue)}
          icon="💳"
        />
        {/* USERONLIE*/}
        <StatCard title="Users Online" value={totalOnline} icon="👥" />
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
      {/* ROW 3: RECENT ACT */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* RECENT*/}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              🔔 <span className="ml-2">Recent Orders</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Live Updates
              </span>
              {!activityLoading && recentActivity.length > 0 && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded font-medium">
                  {recentActivity.length} recent
                </span>
              )}
            </div>
          </div>

          {activityLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-200 rounded-lg animate-pulse"
                ></div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-3">📦</div>
              <p className="text-base font-medium">No recent orders</p>
              <p className="text-sm mt-1">
                New orders will appear here in real-time
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 leading-relaxed">
                      {activity.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs text-gray-500">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-600 font-medium">
                        Order #{activity.metadata.orderId.slice(-8)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-xs px-2 py-1 rounded-full flex-shrink-0 font-medium ${
                        activity.metadata.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : activity.metadata.status === "PAID"
                          ? "bg-blue-100 text-blue-700"
                          : activity.metadata.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-700"
                          : activity.metadata.status === "FAILED"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {activity.metadata.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {activity.metadata.items} item
                      {activity.metadata.items !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
