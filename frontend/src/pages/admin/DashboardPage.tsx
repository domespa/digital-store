import { Card } from "../../components/ui/Card";
import { useDashboardStats } from "../../hooks/useDashboardStats";
import { useRealTimeUsers } from "../../hooks/useRealTimeUsers";

export default function DashboardPage() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { totalOnline, loading: usersLoading } = useRealTimeUsers();

  const formatPrice = (amount: number) => {
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
    const colors = {
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

  if (statsLoading || usersLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Orders"
          value={stats?.totalOrders || 0}
          icon="📦"
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={formatPrice(stats?.totalRevenue || 0)}
          icon="💰"
          color="green"
        />
        <StatCard
          title="Users Online"
          value={totalOnline}
          subtitle="Currently browsing"
          icon="👥"
          color="purple"
        />
        <StatCard
          title="Today's Orders"
          value={stats?.todayOrders || 0}
          icon="📈"
          color="yellow"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Pending Orders"
          value={stats?.pendingOrders || 0}
          subtitle="Need attention"
          icon="⏳"
          color="red"
        />
        <StatCard
          title="Conversion Rate"
          value={`${stats?.conversionRate?.toFixed(1) || 0}%`}
          subtitle="Visitor to customer"
          icon="📊"
          color="green"
        />
        <StatCard
          title="Avg Order Value"
          value={formatPrice(stats?.averageOrderValue || 0)}
          icon="💳"
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Countries */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🌍 Top Countries
          </h3>
          <div className="space-y-3">
            {stats?.topCountries?.map((country, index) => (
              <div
                key={country.country}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-600 w-6">
                    #{index + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-900 ml-2">
                    {country.country}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${country.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {country.users}
                  </span>
                </div>
              </div>
            )) || <p className="text-gray-500 text-sm">No data available</p>}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🔔 Recent Activity
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stats?.recentActivity?.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {activity.type === "order" && (
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  )}
                  {activity.type === "user_join" && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  )}
                  {activity.type === "user_leave" && (
                    <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )) || <p className="text-gray-500 text-sm">No recent activity</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
