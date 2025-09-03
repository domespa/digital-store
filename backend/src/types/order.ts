import { Prisma } from "../generated/prisma";
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

  // TIPI PAGAMENTI
  paymentProvider?: "STRIPE" | "PAYPAL";
  currency?: string;
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
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
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
  clientSecret?: string;
  approvalUrl?: string;
  paymentProvider?: string;
  currency?: string;
  displayTotal?: number;
  exchangeRate?: number;
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

// TIPI PRISMA SPECIFICI PER I CONTROLLER
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
            filePath?: true;
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

// TIPO PER ADMIN CON PIÙ DETTAGLI
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
            filePath: true;
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

// TIPO PER USER ORDERS (SENZA FILEPATH)
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
            // NO filePath per utenti normali
          };
        };
      };
    };
  };
}>;
