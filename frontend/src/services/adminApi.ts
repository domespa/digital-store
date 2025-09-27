import axios from "axios";
import type {
  OrderListResponse,
  OrderFilters,
  AdminOrderResponse,
  UpdateOrderStatusRequest,
  OnlineUser,
  UserSession,
  DashboardStats,
  ProductListResponse,
  ProductMutationResponse,
  CreateProductRequest,
  UpdateProductRequest,
  ProductFilters,
} from "../types/admin";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

// ========================
//   WEBSOCKET TYPES
// ========================
interface WebSocketMessage {
  type: "user_count" | "notification" | "unread_count" | "system";
  count?: number;
  data?: unknown;
}

interface NotificationData {
  id: string;
  title: string;
  message: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  timestamp: string;
}

interface SystemMessage {
  message: string;
  level: "info" | "warning" | "error";
  timestamp: string;
}

interface ConnectionEstablished {
  message: string;
  unreadCount: number;
}

interface UnreadCountUpdate {
  count: number;
}

// ========================
//   ANALYTICS TYPES
// ========================
interface PeriodDataPoint {
  period: string;
  orders: number;
  revenue: number;
  timestamp: string;
}

interface PeriodDataResponse {
  success: boolean;
  data: {
    periodData: PeriodDataPoint[];
    summary: {
      totalOrders: number;
      totalRevenue: number;
      peakPeriod: {
        period: string;
        orders: number;
        revenue: number;
      };
    };
  };
}

// ========================
//   SETUP AXIOS ADMIN
// ========================
const adminApiInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// INTERCEPTOR PER TOKEN ADMIN
adminApiInstance.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem("adminToken");
  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  }
  return config;
});

// ========================
//   ADMIN API FUNCTIONS
// ========================

// ORDERS MANAGEMENT
export const adminOrders = {
  getAll: async (filters: OrderFilters = {}): Promise<OrderListResponse> => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value.toString());
      }
    });

    const response = await adminApiInstance.get(
      `/admin/orders?${params.toString()}`
    );
    return response.data;
  },

  getById: async (
    orderId: string
  ): Promise<{ success: boolean; order: AdminOrderResponse }> => {
    const response = await adminApiInstance.get(`/orders/${orderId}`);
    return response.data;
  },

  updateStatus: async (
    orderId: string,
    updateData: UpdateOrderStatusRequest
  ): Promise<{ success: boolean; order: AdminOrderResponse }> => {
    const response = await adminApiInstance.put(
      `/admin/orders/${orderId}/status`,
      updateData
    );
    return response.data;
  },
};

// DASHBOARD & ANALYTICS
export const adminDashboard = {
  getStats: async (): Promise<DashboardStats> => {
    const [dashboardResponse, realtimeResponse] = await Promise.all([
      adminApiInstance.get("/admin/analytics/dashboard"),
      adminApiInstance.get("/admin/analytics/realtime"),
    ]);

    const metrics = dashboardResponse.data.data.metrics;
    const realtime = realtimeResponse.data.data.realTime;

    return {
      totalOrders: metrics.sales.orders.total || 0,
      pendingOrders: realtime.pendingOrders || 0,
      todayOrders: realtime.todayOrders || 0,
      totalRevenue: metrics.sales.revenue.total || 0,
      conversionRate: metrics.overview.conversionRate.current || 0,
      averageOrderValue: metrics.sales.revenue.average?.perOrder || 0,
      topCountries: metrics.users?.countries || [],
      recentActivity: metrics.users?.userActivity || [],
      onlineUsers: realtime?.activeUsers || 0,
    };
  },

  getOverview: async (period: string = "week"): Promise<any> => {
    const response = await adminApiInstance.get(
      `/admin/analytics/overview?period=${period}`
    );
    return response.data.data;
  },

  getRealtime: async (): Promise<any> => {
    const response = await adminApiInstance.get("/admin/analytics/realtime");
    return response.data.data;
  },
};

// REAL-TIME USERS
export const adminUsers = {
  // GET /api/admin/users/online
  getOnline: async (): Promise<OnlineUser[]> => {
    const response = await adminApiInstance.get("/admin/users/online");
    return response.data.users || [];
  },

  // GET /api/admin/users/sessions
  getSessions: async (filters: any = {}): Promise<UserSession[]> => {
    const params = new URLSearchParams(filters);
    const response = await adminApiInstance.get(
      `/admin/users/sessions?${params.toString()}`
    );
    return response.data.sessions || [];
  },
};

// WEBSOCKET CONNECTION
export const adminWebSocket = {
  connect: (onMessage: (data: WebSocketMessage) => void): Socket => {
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) {
      throw new Error("Admin token required");
    }

    const socket = io("http://localhost:3001", {
      auth: {
        token: adminToken,
      },
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("Admin WebSocket connected");
      socket.emit("subscribe", ["admin", "orders", "system"]);
    });

    socket.on("connection_established", (data: ConnectionEstablished) => {
      console.log("Connection established:", data);
    });

    socket.on("notification", (data: NotificationData) => {
      console.log("Notification received:", data);
      onMessage({ type: "notification", data });
    });

    socket.on("system_notification", (data: SystemMessage) => {
      console.log("System notification:", data);
      onMessage({ type: "system", data });
    });

    socket.on("unread_count_updated", (data: UnreadCountUpdate) => {
      onMessage({ type: "unread_count", count: data.count });
    });

    socket.on("disconnect", (reason: string) => {
      console.log("Admin WebSocket disconnected:", reason);
    });

    socket.on("connect_error", (error: Error) => {
      console.error("WebSocket connection error:", error);
    });

    return socket;
  },
};

// ADMIN AUTH
export const adminAuth = {
  login: async (email: string, password: string) => {
    const response = await adminApiInstance.post("/auth/login", {
      email,
      password,
    });

    if (response.data.user?.role !== "ADMIN") {
      throw new Error("Admin access required");
    }

    if (response.data.token) {
      localStorage.setItem("adminToken", response.data.token);
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem("adminToken");
  },

  getProfile: async () => {
    const response = await adminApiInstance.get("/auth/me");
    return response.data;
  },
};

// PRODUCTS MANAGEMENT
export const adminProducts = {
  getAll: async (
    filters: ProductFilters = {}
  ): Promise<ProductListResponse> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value.toString());
      }
    });
    const response = await adminApiInstance.get(
      `/admin/products?${params.toString()}`
    );
    return response.data;
  },

  create: async (
    productData: CreateProductRequest
  ): Promise<ProductMutationResponse> => {
    const response = await adminApiInstance.post(
      "/admin/products",
      productData
    );
    return response.data;
  },

  update: async (
    productId: string,
    productData: UpdateProductRequest
  ): Promise<ProductMutationResponse> => {
    const response = await adminApiInstance.put(
      `/admin/products/${productId}`,
      productData
    );
    return response.data;
  },

  delete: async (productId: string): Promise<ProductMutationResponse> => {
    const response = await adminApiInstance.delete(
      `/admin/products/${productId}`
    );
    return response.data;
  },
};

// ========================
//   ANALYTICS API (REAL)
// ========================
export const adminAnalytics = {
  getPeriodData: async (filters: {
    period: "today" | "week" | "month" | "year" | "total";
    from?: string;
    to?: string;
  }): Promise<PeriodDataResponse> => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      console.log(
        "🔄 Calling API:",
        `/admin/analytics/period-data?${params.toString()}`
      );

      const response = await adminApiInstance.get(
        `/admin/analytics/period-data?${params.toString()}`
      );

      console.log("✅ API Response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Error calling period-data API:", error);
      throw error;
    }
  },

  // DASHBOARD METRICS
  getDashboard: async (period: string = "week") => {
    const response = await adminApiInstance.get(
      `/admin/analytics/dashboard?period=${period}`
    );
    return response.data;
  },

  // SALES METRICS
  getSales: async (period: string = "week") => {
    const response = await adminApiInstance.get(
      `/admin/analytics/sales?period=${period}`
    );
    return response.data;
  },

  // OVERVIEW METRICS
  getOverview: async (period: string = "week") => {
    const response = await adminApiInstance.get(
      `/admin/analytics/overview?period=${period}`
    );
    return response.data;
  },

  // REAL-TIME METRICS
  getRealtime: async () => {
    const response = await adminApiInstance.get("/admin/analytics/realtime");
    return response.data;
  },

  // INSIGHTS E SUGGERIMENTI
  getInsights: async (period: string = "week") => {
    const response = await adminApiInstance.get(
      `/admin/analytics/insights?period=${period}`
    );
    return response.data;
  },

  // TOP PRODUCTS
  getTopProducts: async (period: string = "week", limit: number = 10) => {
    const response = await adminApiInstance.get(
      `/admin/analytics/top-products?period=${period}&limit=${limit}`
    );
    return response.data;
  },

  // COMPARAZIONE PERIODI
  comparePeriods: async (
    currentPeriod: string,
    previousPeriod: string,
    metric: string
  ) => {
    const response = await adminApiInstance.get(
      `/admin/analytics/compare?currentPeriod=${currentPeriod}&previousPeriod=${previousPeriod}&metric=${metric}`
    );
    return response.data;
  },

  // REFRESH COMPLETO DASHBOARD
  refreshDashboard: async (
    period: string = "week"
  ): Promise<{
    stats: DashboardStats;
    periodData: PeriodDataPoint[];
    insights: any;
  }> => {
    try {
      const [statsResponse, periodResponse, insightsResponse] =
        await Promise.all([
          adminDashboard.getStats(),
          adminAnalytics.getPeriodData({ period: period as any }),
          adminAnalytics.getInsights(period).catch(() => null),
        ]);

      return {
        stats: statsResponse,
        periodData: periodResponse.data.periodData,
        insights: insightsResponse?.data || null,
      };
    } catch (error) {
      console.error("Error refreshing dashboard:", error);
      throw error;
    }
  },
};

// ========================
//   UTILITY FUNCTIONS
// ========================
export function convertTimePeriodToApiPeriod(
  timePeriod: string
): "today" | "week" | "month" | "year" | "total" {
  switch (timePeriod.toLowerCase()) {
    case "oggi":
    case "today":
      return "today";
    case "settimana":
    case "week":
      return "week";
    case "mese":
    case "month":
      return "month";
    case "anno":
    case "year":
      return "year";
    case "totale":
    case "total":
      return "total";
    default:
      return "week";
  }
}

// ========================
//   MAIN ADMIN API OBJECT
// ========================
export const adminApi = {
  getOrders: adminOrders.getAll,
  getOrderById: adminOrders.getById,
  updateOrderStatus: adminOrders.updateStatus,
  getDashboardStats: adminDashboard.getStats,
  getOverview: adminDashboard.getOverview,
  getRealtime: adminDashboard.getRealtime,
  getOnlineUsers: adminUsers.getOnline,
  getUserSessions: adminUsers.getSessions,
  connectWebSocket: adminWebSocket.connect,
  getProducts: adminProducts.getAll,
  createProduct: adminProducts.create,
  updateProduct: adminProducts.update,
  deleteProduct: adminProducts.delete,
  analytics: adminAnalytics,
  getPeriodData: adminAnalytics.getPeriodData,
  refreshDashboard: adminAnalytics.refreshDashboard,
  login: adminAuth.login,
  logout: adminAuth.logout,
  getProfile: adminAuth.getProfile,
  convertTimePeriod: convertTimePeriodToApiPeriod,
};

export default adminApi;
