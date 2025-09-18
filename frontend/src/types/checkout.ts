export interface CheckoutItem {
  productId: string;
  quantity: number;
}

export interface CheckoutRequest {
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  items: CheckoutItem[];
  paymentProvider: PaymentProvider;
  currency: string;
  discountCode?: string;
}

export interface CheckoutResponse {
  success: boolean;
  message: string;
  order: OrderData;
  clientSecret?: string;
  approvalUrl?: string;
  paymentProvider: PaymentProvider;
  currency: string;
  displayTotal: number;
  exchangeRate: number;
}

export interface CheckoutForm {
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  paymentProvider: PaymentProvider;
}

export interface OrderData {
  id: string;
  customerEmail: string;
  total: number;
  status: string;
  paymentStatus: string;
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
    } | null;
  }>;
}

export interface CheckoutResult {
  success: boolean;
  type?: "stripe" | "paypal_redirect" | "completed";
  clientSecret?: string;
  order?: OrderData;
  error?: string;
}

export interface CheckoutData {
  items: Array<{
    productId: string;
    name: string;
    price: number;
    currency: string;
    quantity: number;
  }>;
  totalAmount: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
}

export interface OrderResponse {
  success: boolean;
  orderId: string;
  paymentUrl?: string;
  message?: string;
}

export type PaymentProvider = "STRIPE" | "PAYPAL";
