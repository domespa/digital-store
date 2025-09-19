import { useState, useEffect } from "react";
import { adminUsers, adminWebSocket } from "../services/adminApi";
import type { OnlineUser, UserSession } from "../types/admin";

export function useRealTimeUsers() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [users, sessions] = await Promise.all([
          adminUsers.getOnline(),
          adminUsers.getSessions({ timeRange: "24h" }),
        ]);
        setOnlineUsers(users);
        setUserSessions(sessions);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // WEBSOCKET
    const ws = adminWebSocket.connect((data) => {
      switch (data.type) {
        case "user_connected":
          setOnlineUsers((prev) => [...prev, data.user]);
          break;
        case "user_disconnected":
          setOnlineUsers((prev) =>
            prev.filter((u) => u.sessionId !== data.sessionId)
          );
          break;
        case "user_activity":
          setOnlineUsers((prev) =>
            prev.map((u) =>
              u.sessionId === data.sessionId
                ? { ...u, currentPage: data.page, lastActivity: data.timestamp }
                : u
            )
          );
          break;
        case "session_ended":
          setUserSessions((prev) =>
            prev.map((s) =>
              s.sessionId === data.sessionId
                ? { ...s, endTime: data.endTime, isActive: false }
                : s
            )
          );
          break;
      }
    });

    return () => ws.close();
  }, []);

  return {
    onlineUsers,
    userSessions,
    loading,
    error,
    totalOnline: onlineUsers.length,
    totalSessions: userSessions.length,
  };
}
