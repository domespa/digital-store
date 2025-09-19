import axios from "axios";
import type {
  OrderListResponse,
  OrderFilters,
  AdminOrderResponse,
  UpdateOrderStatusRequest,
  OnlineUser,
  UserSession,
  DashboardStats,
} from "../types/admin";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

// ========================
//   SETUP AXIOS ADMIN
// ========================
const adminApiInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// INTERCEPTOR
adminApiInstance.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem("adminToken");
  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  }
  return config;
});

// ========================
//    ADMIN API FUNCTIONS
// ========================

// ORDERS
export const adminOrders = {
  // GET /api/admin/orders
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

  // GET /api/orders/:id
  getById: async (
    orderId: string
  ): Promise<{ success: boolean; order: AdminOrderResponse }> => {
    const response = await adminApiInstance.get(`/orders/${orderId}`);
    return response.data;
  },

  // PUT /api/admin/orders/:id/status
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
  // GET /api/admin/dashboard/stats
  getStats: async (): Promise<DashboardStats> => {
    const response = await adminApiInstance.get("/admin/dashboard/stats");
    return response.data;
  },
};

// REAL-TIME USERS
export const adminUsers = {
  // GET /api/admin/users/online
  getOnline: async (): Promise<OnlineUser[]> => {
    const response = await adminApiInstance.get("/admin/users/online");
    return response.data.users;
  },

  // GET /api/admin/users/sessions
  getSessions: async (
    filters: {
      timeRange?: "24h" | "7d" | "30d";
      country?: string;
      isActive?: boolean;
    } = {}
  ): Promise<UserSession[]> => {
    const params = new URLSearchParams(filters as any);
    const response = await adminApiInstance.get(
      `/admin/users/sessions?${params.toString()}`
    );
    return response.data.sessions;
  },
};

// WEBSOCKET CONNECTION
export const adminWebSocket = {
  connect: (onMessage: (data: any) => void): WebSocket => {
    const wsUrl = API_BASE_URL.replace("http", "ws").replace(
      "/api",
      "/admin/ws"
    );
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    ws.onerror = (error) => {
      console.error("Admin WebSocket error:", error);
    };

    return ws;
  },
};

// ADMIN AUTH
export const adminAuth = {
  login: async (username: string, password: string) => {
    const response = await adminApiInstance.post("/admin/auth/login", {
      username,
      password,
    });
    if (response.data.token) {
      localStorage.setItem("adminToken", response.data.token);
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem("adminToken");
  },

  getProfile: async () => {
    const response = await adminApiInstance.get("/admin/auth/me");
    return response.data;
  },
};

export const adminApi = {
  getOrders: adminOrders.getAll,
  getOrderById: adminOrders.getById,
  updateOrderStatus: adminOrders.updateStatus,
  getDashboardStats: adminDashboard.getStats,
  getOnlineUsers: adminUsers.getOnline,
  getUserSessions: adminUsers.getSessions,
  connectWebSocket: adminWebSocket.connect,
};
