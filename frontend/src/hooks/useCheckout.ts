import { useState } from "react";
import { useCart } from "./useCart";
import { createCheckoutOrder } from "../services/checkout";
import { payments } from "../services/api";
import type {
  CheckoutItem,
  CheckoutRequest,
  CheckoutForm,
  CheckoutResult,
} from "../types/checkout";

export const useCheckout = () => {
  const { cart, clearCart, getDisplayCurrency } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processCheckoutData = async (
    formData: CheckoutForm
  ): Promise<CheckoutResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      if (
        !formData.customerEmail ||
        !formData.customerFirstName ||
        !formData.customerLastName
      ) {
        throw new Error("FILL ALL THE FIELDS");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.customerEmail)) {
        throw new Error("INCORRECT EMAIL");
      }

      if (cart.items.length === 0) {
        throw new Error("CART EMPTY");
      }

      const items: CheckoutItem[] = cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      const checkoutData: CheckoutRequest = {
        customerEmail: formData.customerEmail.trim().toLowerCase(),
        customerFirstName: formData.customerFirstName.trim(),
        customerLastName: formData.customerLastName.trim(),
        items,
        paymentProvider: formData.paymentProvider,
        currency: getDisplayCurrency(),
      };

      console.log("🛒 SENDING TO BACKEND:", checkoutData);

      const response = await createCheckoutOrder(checkoutData);

      console.log("📨 BACKEND RESPONSE:", response);

      if (response.paymentProvider === "STRIPE" && response.clientSecret) {
        return {
          success: true,
          type: "stripe",
          clientSecret: response.clientSecret,
          order: response.order,
        };
      }

      if (response.paymentProvider === "PAYPAL" && response.approvalUrl) {
        localStorage.setItem("paypal_pending_order", response.order.id);
        localStorage.setItem("paypal_form_data", JSON.stringify(formData));

        console.log("REDIRECTING TO PAYPAL", response.approvalUrl);
        window.location.href = response.approvalUrl;

        return {
          success: true,
          type: "paypal_redirect",
          order: response.order,
        };
      }

      clearCart();
      return {
        success: true,
        type: "completed",
        order: response.order,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : " ERROR CHECKOUT";
      setError(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const capturePayPalPayment = async (orderId: string) => {
    try {
      const response = await payments.capturePayPal(orderId);
      return response;
    } catch (error) {
      console.error("PayPal capture error:", error);
      throw error;
    }
  };

  const clearError = () => setError(null);
  return {
    processCheckoutData,
    capturePayPalPayment,
    isProcessing,
    error,
    clearError,
  };
};
