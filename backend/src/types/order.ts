export interface CartItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderRequest {
  // DATI CLIENTE OBBLIGATORI ANCHE PER OPSITI
  customerEmail: string;
  customerFirstName?: string;
  customerLastName?: string;

  // PRODOTTI NEL CARRELLO
  items: CartItem[];

  // SCONTI
  discountCode?: string;
}

export interface OrderItemResponse {
  id: string;
  quantity: number;
  price: number;
  productId: string;
  product: {
    id: string;
    name: string;
    description: string | null;
    fileName: string;
  };
}

export interface OrderResponse {
  id: string;
  customerEmail: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  total: number;
  status: string;
  paymentProvider: string | null;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  orderItems: OrderItemResponse[];
  userId?: string; // SE REGISTRATO
}

export interface OrderListResponse {
  success: boolean;
  message: string;
  orders: OrderResponse[];
  total: number;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface OrderDetailResponse {
  success: boolean;
  message: string;
  order: OrderResponse;
}

export interface CreateOrderResponse {
  success: boolean;
  message: string;
  order: OrderResponse;
  // PAGAMENTI
  paymentClientSecret?: string; // STRIPE
  paymentUrl?: string; // PAYPAL
}

export interface OrderFilters {
  search?: string;
  status?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "total" | "status";
  sortOrder?: "asc" | "desc";
  page?: string;
  limit?: string;
}

export interface UpdateOrderStatusRequest {
  status?: "PENDING" | "PAID" | "COMPLETED" | "FAILED" | "REFUNDED";
  paymentStatus?: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  paymentProvider?: "STRIPE" | "PAYPAL";
  stripePaymentIntentId?: string;
  paypalOrderId?: string;
}

export interface OrderItemData {
  productId: string;
  quantity: number;
  price: number;
}
