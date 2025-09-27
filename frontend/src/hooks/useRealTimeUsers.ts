import { useState, useEffect, useRef } from "react";
import { adminUsers, adminWebSocket } from "../services/adminApi";
import type { OnlineUser, UserSession } from "../types/admin";

interface WebSocketMessage {
  type: "user_count" | "notification" | "unread_count" | "system";
  count?: number;
  data?: any;
}

interface UserTrackingMessage {
  type:
    | "user_connected"
    | "user_disconnected"
    | "user_activity"
    | "session_ended";
  user?: OnlineUser;
  sessionId?: string;
  page?: string;
  timestamp?: string;
  endTime?: string;
}

// Union type per tutti i possibili messaggi
type AnyWebSocketMessage = WebSocketMessage | UserTrackingMessage;

export function useRealTimeUsers() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<any>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [users, sessions] = await Promise.all([
          adminUsers.getOnline(),
          adminUsers.getSessions({ timeRange: "24h" }),
        ]);

        console.log("Initial data loaded:", { users, sessions });
        setOnlineUsers(users || []);
        setUserSessions(sessions || []);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching initial data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    try {
      wsRef.current = adminWebSocket.connect(
        (data: AnyWebSocketMessage | any) => {
          console.log("WebSocket message received:", data);

          switch (data.type) {
            case "user_connected":
              if (data.user) {
                setOnlineUsers((prev) => {
                  const exists = prev.some(
                    (u) => u.sessionId === data.user!.sessionId
                  );
                  if (exists) return prev;
                  console.log("User connected:", data.user);
                  return [...prev, data.user!];
                });
              }
              break;

            case "user_disconnected":
              if (data.sessionId) {
                console.log("User disconnected:", data.sessionId);
                setOnlineUsers((prev) =>
                  prev.filter((u) => u.sessionId !== data.sessionId)
                );
              }
              break;

            case "user_activity":
              if (data.sessionId && data.page && data.timestamp) {
                console.log("User activity:", data);
                setOnlineUsers((prev) =>
                  prev.map((u) =>
                    u.sessionId === data.sessionId
                      ? {
                          ...u,
                          currentPage: data.page!,
                          lastActivity: data.timestamp!,
                        }
                      : u
                  )
                );
              }
              break;

            case "session_ended":
              if (data.sessionId && data.endTime) {
                console.log("Session ended:", data);

                setOnlineUsers((prev) =>
                  prev.filter((u) => u.sessionId !== data.sessionId)
                );

                setUserSessions((prev) =>
                  prev.map((s) =>
                    s.sessionId === data.sessionId
                      ? { ...s, endTime: data.endTime, isActive: false }
                      : s
                  )
                );
              }
              break;

            case "user_count":
              if (typeof data.count === "number") {
                console.log("User count update:", data.count);
              }
              break;

            default:
              console.log("Unhandled WebSocket message:", data.type);
              break;
          }
        }
      );
    } catch (wsError) {
      console.error("WebSocket connection failed:", wsError);
    }

    // Cleanup
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (error) {
          console.error("Error closing WebSocket:", error);
        }
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [users, sessions] = await Promise.all([
          adminUsers.getOnline(),
          adminUsers.getSessions({ timeRange: "24h" }),
        ]);

        setOnlineUsers(users || []);
        setUserSessions(sessions || []);
        console.log("Data refreshed via polling");
      } catch (err) {
        console.error("Error refreshing data:", err);
      }
    }, 300000); // Refresh ogni 3 MINUTI

    return () => clearInterval(interval);
  }, []);

  return {
    onlineUsers,
    userSessions,
    loading,
    error,
    totalOnline: onlineUsers.length,
    totalSessions: userSessions.length,

    getOnlineUsersByCountry: (country: string) =>
      onlineUsers.filter((user) => user.location?.country === country),
    getSessionsByCountry: (country: string) =>
      userSessions.filter((session) => session.location?.country === country),
    isWebSocketConnected: () => wsRef.current && wsRef.current.connected,
    refreshData: async () => {
      try {
        const [users, sessions] = await Promise.all([
          adminUsers.getOnline(),
          adminUsers.getSessions({ timeRange: "24h" }),
        ]);
        setOnlineUsers(users || []);
        setUserSessions(sessions || []);
      } catch (err) {
        console.error("Manual refresh failed:", err);
      }
    },
  };
}
