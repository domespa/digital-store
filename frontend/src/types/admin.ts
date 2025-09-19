export interface AdminOrderResponse {
  id: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  total: number;
  status: string;
  paymentProvider: "STRIPE" | "PAYPAL" | null;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  orderItems: Array<{
    id: string;
    quantity: number;
    price: number;
    productId: string;
    product: {
      id: string;
      name: string;
      description: string;
      fileName: string;
      filePath?: string;
    } | null;
  }>;
  userId?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface OrderListResponse {
  success: boolean;
  message: string;
  orders: AdminOrderResponse[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface OrderFilters {
  search?: string;
  status?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface UpdateOrderStatusRequest {
  status?: string;
  paymentStatus?: string;
  stripePaymentIntentId?: string;
  paypalOrderId?: string;
}

export interface OnlineUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  location: {
    country: string;
    city: string;
    region: string;
    latitude: number;
    longitude: number;
  };
  currentPage: string;
  connectedAt: string;
  lastActivity: string;
  isAuthenticated: boolean;
}

export interface UserSession {
  id: string;
  userId?: string;
  sessionId: string;
  ipAddress: string;
  location: {
    country: string;
    city: string;
    region: string;
    latitude: number;
    longitude: number;
  };
  userAgent: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  pagesVisited: string[];
  isActive: boolean;
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  onlineUsers: number;
  todayOrders: number;
  pendingOrders: number;
  conversionRate: number;
  averageOrderValue: number;
  topCountries: Array<{
    country: string;
    users: number;
    percentage: number;
  }>;
  recentActivity: Array<{
    type: "order" | "user_join" | "user_leave";
    message: string;
    timestamp: string;
  }>;
}
