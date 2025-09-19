import { useState, useEffect } from "react";
import { adminDashboard, adminWebSocket } from "../services/adminApi";
import type { DashboardStats } from "../types/admin";

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await adminDashboard.getStats();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // UPDATE 30 SEC
    const interval = setInterval(fetchStats, 30000);

    // WEBSOCKET
    const ws = adminWebSocket.connect((data) => {
      if (data.type === "stats_update") {
        setStats((prev) => (prev ? { ...prev, ...data.stats } : null));
      }
    });

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  return { stats, loading, error };
}
