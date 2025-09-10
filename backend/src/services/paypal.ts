import axios, { AxiosResponse } from "axios";

// ===========================================
//               TYPES & INTERFACES
// ===========================================

interface PayPalTokenResponse {
  scope: string;
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
  nonce: string;
}

interface PayPalAmount {
  currency_code: string;
  value: string;
}

interface PayPalItem {
  name: string;
  unit_amount: PayPalAmount;
  quantity: string;
  description?: string;
  category?: "DIGITAL_GOODS" | "PHYSICAL_GOODS";
}

interface PayPalPurchaseUnit {
  reference_id?: string;
  amount: PayPalAmount;
  items?: PayPalItem[];
}

interface PayPalApplicationContext {
  return_url: string;
  cancel_url: string;
  brand_name?: string;
  locale?: string;
  landing_page?: "LOGIN" | "GUEST_CHECKOUT" | "NO_PREFERENCE";
  shipping_preference?:
    | "GET_FROM_FILE"
    | "NO_SHIPPING"
    | "SET_PROVIDED_ADDRESS";
  user_action?: "CONTINUE" | "PAY_NOW";
}

interface PayPalOrderRequest {
  intent: "CAPTURE" | "AUTHORIZE";
  purchase_units: PayPalPurchaseUnit[];
  application_context?: PayPalApplicationContext;
}

interface PayPalOrderResponse {
  id: string;
  status:
    | "CREATED"
    | "SAVED"
    | "APPROVED"
    | "VOIDED"
    | "COMPLETED"
    | "PAYER_ACTION_REQUIRED";
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

interface PayPalCaptureResponse {
  id: string;
  status:
    | "COMPLETED"
    | "DECLINED"
    | "PARTIALLY_REFUNDED"
    | "PENDING"
    | "REFUNDED";
  purchase_units: Array<{
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: PayPalAmount;
        final_capture: boolean;
        create_time: string;
        update_time: string;
      }>;
    };
  }>;
}

// ===========================================
//           PAYPAL SERVICE CLASS
// ===========================================

export class PayPalService {
  private baseURL: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    // ===========================================
    //              INITIALIZATION
    // ===========================================

    // VALIDAZIONE VARIABILI AMBIENTE
    this.clientId = process.env.PAYPAL_CLIENT_ID || "";
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";

    if (!this.clientId || !this.clientSecret) {
      throw new Error("PayPal credentials not configured");
    }

    // URL BASATO SU AMBIENTE (SANDBOX/PRODUCTION)
    this.baseURL =
      process.env.PAYPAL_ENVIRONMENT === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
  }

  // ===========================================
  //           AUTHENTICATION
  // ===========================================

  // OTTIENI ACCESS TOKEN CON CACHE
  private async getAccessToken(): Promise<string> {
    // USA TOKEN CACHED SE ANCORA VALIDO
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`
      ).toString("base64");

      const response: AxiosResponse<PayPalTokenResponse> = await axios.post(
        `${this.baseURL}/v1/oauth2/token`,
        "grant_type=client_credentials",
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000; // -1MIN DI BUFFER

      console.log("PayPal access token obtained");
      return this.accessToken;
    } catch (error) {
      console.error("Failed to get PayPal access token:", error);
      throw new Error("PayPal authentication failed");
    }
  }

  // GENERA HEADERS AUTENTICATI
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "PayPal-Request-Id": `${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
    };
  }

  // ===========================================
  //             ORDER MANAGEMENT
  // ===========================================

  // CREA ORDINE PAYPAL
  async createOrder(params: {
    amount: number;
    currency: string;
    orderId?: string;
    items?: Array<{
      name: string;
      quantity: number;
      unitAmount: number;
      description?: string;
    }>;
  }): Promise<PayPalOrderResponse> {
    try {
      const headers = await this.getAuthHeaders();

      // VALIDAZIONI INPUT
      if (params.amount <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      const formattedAmount = params.amount.toFixed(2);

      const purchaseUnit: PayPalPurchaseUnit = {
        reference_id: params.orderId || `ORDER-${Date.now()}`,
        amount: {
          currency_code: params.currency,
          value: formattedAmount,
        },
      };

      // AGGIUNGI ITEMS SE PRESENTI
      if (params.items && params.items.length > 0) {
        purchaseUnit.items = params.items.map((item) => ({
          name: item.name,
          unit_amount: {
            currency_code: params.currency,
            value: item.unitAmount.toFixed(2),
          },
          quantity: item.quantity.toString(),
          description: item.description,
          category: "DIGITAL_GOODS",
        }));
      }

      const orderRequest: PayPalOrderRequest = {
        intent: "CAPTURE",
        purchase_units: [purchaseUnit],
        application_context: {
          return_url: `${process.env.FRONTEND_URL}/payment/success?provider=paypal`,
          cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?provider=paypal`,
          brand_name: process.env.BRAND_NAME || "Digital Store",
          locale: "it_IT",
          landing_page: "NO_PREFERENCE",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
        },
      };

      const response: AxiosResponse<PayPalOrderResponse> = await axios.post(
        `${this.baseURL}/v2/checkout/orders`,
        orderRequest,
        { headers }
      );

      console.log(`PayPal order created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error("PayPal create order error:", error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          `PayPal API Error: ${error.response.status} - ${JSON.stringify(
            error.response.data
          )}`
        );
      }
      throw error;
    }
  }

  // CATTURA PAGAMENTO APPROVATO
  async captureOrder(orderId: string): Promise<PayPalCaptureResponse> {
    try {
      const headers = await this.getAuthHeaders();

      const response: AxiosResponse<PayPalCaptureResponse> = await axios.post(
        `${this.baseURL}/v2/checkout/orders/${orderId}/capture`,
        {},
        { headers }
      );

      console.log(`PayPal order captured: ${orderId}`);
      return response.data;
    } catch (error) {
      console.error("PayPal capture error:", error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          `PayPal Capture Error: ${error.response.status} - ${JSON.stringify(
            error.response.data
          )}`
        );
      }
      throw error;
    }
  }

  // OTTIENI DETTAGLI ORDINE
  async getOrderDetails(orderId: string): Promise<PayPalOrderResponse> {
    try {
      const headers = await this.getAuthHeaders();

      const response: AxiosResponse<PayPalOrderResponse> = await axios.get(
        `${this.baseURL}/v2/checkout/orders/${orderId}`,
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error("PayPal get order error:", error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          `PayPal Get Order Error: ${error.response.status} - ${JSON.stringify(
            error.response.data
          )}`
        );
      }
      throw error;
    }
  }

  // ===========================================
  //             UTILITY METHODS
  // ===========================================

  // INFORMAZIONI AMBIENTE
  getEnvironmentInfo() {
    return {
      environment: process.env.PAYPAL_ENVIRONMENT || "sandbox",
      baseURL: this.baseURL,
      isProduction: process.env.PAYPAL_ENVIRONMENT === "production",
      clientId: this.clientId.substring(0, 10) + "...", // PARZIALE PER SICUREZZA
      hasValidCredentials: Boolean(this.clientId && this.clientSecret),
    };
  }

  // TEST CONNESSIONE PAYPAL
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  // ===========================================
  //           ADDITIONAL FEATURES
  // ===========================================

  // CANCELLA TOKEN CACHE (PER LOGOUT O REFRESH)
  clearTokenCache(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
    console.log("PayPal token cache cleared");
  }

  // VERIFICA SE TOKEN È SCADUTO
  isTokenExpired(): boolean {
    return Date.now() >= this.tokenExpiry;
  }

  // OTTIENI LINK APPROVAZIONE DA RESPONSE
  getApprovalUrl(orderResponse: PayPalOrderResponse): string | null {
    const approvalLink = orderResponse.links.find(
      (link) => link.rel === "approve"
    );
    return approvalLink?.href || null;
  }

  // FORMATTA ERRORE PAYPAL PER LOG
  private formatPayPalError(error: any): string {
    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data;
      return `PayPal Error ${error.response.status}: ${
        data.message || data.error_description || JSON.stringify(data)
      }`;
    }
    return error.message || "Unknown PayPal error";
  }
}

// ===========================================
//              SINGLETON EXPORT
// ===========================================

export const paypalService = new PayPalService();

console.log("PayPal Service initialized:", paypalService.getEnvironmentInfo());
