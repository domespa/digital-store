import { useState, useEffect } from "react";
import { adminApi } from "../services/adminApi";
import type { Socket } from "socket.io-client";

type AdminPage =
  | "dashboard"
  | "orders"
  | "order-detail"
  | "users-online"
  | "user-map"
  | "analytics"
  | "support"
  | "products"
  | "settings";

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: AdminPage;
  onNavigate: (page: AdminPage) => void;
}

interface WebSocketMessage {
  type: "user_count" | "notification" | "unread_count" | "system";
  count?: number;
  data?: unknown;
}

export default function AdminLayout({
  children,
  currentPage,
  onNavigate,
}: AdminLayoutProps) {
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    let socket: Socket | null = null;

    try {
      socket = adminApi.connectWebSocket((data: WebSocketMessage) => {
        switch (data.type) {
          case "user_count":
            if (typeof data.count === "number") {
              setOnlineUsers(data.count);
            }
            break;
          case "notification":
            setNotifications((prev: number) => prev + 1);
            break;
          case "unread_count":
            if (typeof data.count === "number") {
              setNotifications(data.count);
            }
            break;
          case "system":
            console.log("System notification:", data);
            break;
          default:
            console.log("Unknown WebSocket message:", data);
        }
      });
    } catch (error: unknown) {
      console.error("Failed to connect WebSocket:", error);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const navigation: Array<{ name: string; href: AdminPage; icon: string }> = [
    { name: "Dashboard", href: "dashboard", icon: "📊" },
    { name: "Orders", href: "orders", icon: "📦" },
    { name: "Users Online", href: "users-online", icon: "👥" },
    { name: "User Map", href: "user-map", icon: "🗺️" },
    { name: "Analytics", href: "analytics", icon: "📈" },
    { name: "Support", href: "support", icon: "🎫" },
    { name: "Products", href: "products", icon: "🏷️" },
    { name: "Settings", href: "settings", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* SIDEBAR */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        {/* LOGO */}
        <div className="flex h-16 items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        </div>

        {/* NAV */}
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => onNavigate(item.href)}
                className={`
                  group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium
                  ${
                    currentPage === item.href
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }
                `}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
                {item.name === "Users Online" && onlineUsers > 0 && (
                  <span className="ml-auto bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    {onlineUsers}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* UTENTI ONLINE */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            <span className="text-sm text-gray-600">System Online</span>
          </div>
        </div>
      </div>

      <div className="pl-64">
        {/* HEADER */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 capitalize">
                  {currentPage.replace("-", " ")}
                </h2>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span>Live</span>
                </div>
                <button className="relative p-2 text-gray-600 hover:text-gray-900">
                  <span className="text-lg">🔔</span>
                  {notifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {notifications > 99 ? "99+" : notifications}
                    </span>
                  )}
                </button>

                {/* ADMIN PROFILO */}
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">A</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    Admin
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* CHILDREN */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
