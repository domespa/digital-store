import { Prisma } from "../generated/prisma";

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderRequest {
  // DATI CLIENTE OBBLIGATORI ANCHE PER OSPITI
  customerEmail: string;
  customerFirstName?: string;
  customerLastName?: string;

  // PRODOTTI NEL CARRELLO
  items: CartItem[];

  // SCONTI
  discountCode?: string;

  // TIPI PAGAMENTI
  paymentProvider?: "STRIPE" | "PAYPAL";
  currency?: string;
}

// ============== TIPI PER UTENTI NORMALI (SENZA filePath) ==============

export interface UserOrderItemResponse {
  id: string;
  quantity: number;
  price: number;
  productId: string | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    fileName: string | null;
    // NO filePath per sicurezza - solo admin possono vederlo
  } | null;
}

export interface UserOrderResponse {
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
  orderItems: UserOrderItemResponse[];
  userId?: string;
}

// ============== TIPI PER ADMIN (CON filePath) ==============

export interface AdminOrderItemResponse {
  id: string;
  quantity: number;
  price: number;
  productId: string | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    fileName: string | null;
    filePath: string | null; // Solo admin possono vedere i percorsi dei file
  } | null;
}

export interface AdminOrderResponse {
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
  orderItems: AdminOrderItemResponse[];
  userId?: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

// ============== ALIAS PER COMPATIBILITÀ ==============

// Per mantenere compatibilità con il codice esistente
export type OrderItemResponse = AdminOrderItemResponse;
export type OrderResponse = AdminOrderResponse;

// ============== RESPONSE INTERFACES ==============

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

export interface UserOrderListResponse {
  success: boolean;
  message: string;
  orders: UserOrderResponse[];
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

export interface UserOrderDetailResponse {
  success: boolean;
  message: string;
  order: UserOrderResponse;
}

export interface CreateOrderResponse {
  success: boolean;
  message: string;
  order: OrderResponse;

  // PAGAMENTI
  clientSecret?: string;
  approvalUrl?: string;
  paymentProvider?: string;
  currency?: string;
  displayTotal?: number;
  exchangeRate?: number;
}

// ============== UTILITY INTERFACES ==============

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

// ============== TIPI PRISMA - ADMIN (CON filePath) ==============

export type OrderWithAdminDetails = Prisma.OrderGetPayload<{
  include: {
    orderItems: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            description: true;
            fileName: true;
            filePath: true; // Admin può vedere i percorsi
          };
        };
      };
    };
    user: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
      };
    };
  };
}>;

// ============== TIPI PRISMA - USER (SENZA filePath) ==============

export type OrderWithUserDetails = Prisma.OrderGetPayload<{
  include: {
    orderItems: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            description: true;
            fileName: true;
            // NO filePath - sicurezza per utenti normali
          };
        };
      };
    };
  };
}>;

// ============== TIPI PRISMA - GENERAL (CON filePath per admin) ==============

export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    orderItems: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            description: true;
            fileName: true;
            filePath: true; // Per funzioni admin
          };
        };
      };
    };
    user: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
      };
    };
  };
}>;

// ============== HELPER TYPE GUARDS ==============

export const isAdminOrder = (
  order: UserOrderResponse | AdminOrderResponse
): order is AdminOrderResponse => {
  return "user" in order;
};

export const hasFilePath = (
  item: UserOrderItemResponse | AdminOrderItemResponse
): item is AdminOrderItemResponse => {
  return item.product !== null && "filePath" in item.product;
};
