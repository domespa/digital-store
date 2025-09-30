import { useEffect, useState } from "react";
import adminApi from "../services/adminApi";
import type { RecentActivity } from "../services/adminApi";

interface UseRecentActivityReturn {
  recentActivity: RecentActivity[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

interface UseRecentActivityProps {
  autoRefresh?: boolean;
  limit?: number;
}

export function useRecentActivity(
  props: UseRecentActivityProps = {}
): UseRecentActivityReturn {
  const { autoRefresh = true, limit = 15 } = props;

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const activityResponse = await adminApi.getRecentActivity(limit);
      setRecentActivity(activityResponse.activities);
    } catch (error: any) {
      console.error("Error fetching recent activity:", error);
      setError(error.message || "Failed to fetch recent activity");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // REFRESH OGNI 3 MINUTI
    if (autoRefresh) {
      const interval = setInterval(fetchData, 300000);
      return () => clearInterval(interval);
    }
  }, []);

  return {
    recentActivity,
    isLoading,
    error,
    refreshData: fetchData,
  };
}
