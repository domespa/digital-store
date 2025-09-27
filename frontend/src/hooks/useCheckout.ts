import { useState } from "react";
import { useCart } from "./useCart";
import { createCheckoutOrder } from "../services/checkout";
import type {
  CheckoutItem,
  CheckoutRequest,
  CheckoutForm,
  CheckoutResult,
} from "../types/checkout";

export const useCheckout = () => {
  const { cart, clearCart, getCartTotal, getDisplayCurrency } = useCart();
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
      console.log("🛒 CART TOTAL FRONTEND:", getCartTotal());

      console.log("🛒 SENDING CHECKOUT:", {
        checkoutData,
        cartItems: cart.items.map((item) => ({
          id: item.id,
          name: item.name,
          productId: item.productId,
          displayPrice: item.displayPrice,
          quantity: item.quantity,
        })),
        cartTotal: getCartTotal(),
      });

      const response = await createCheckoutOrder(checkoutData);

      console.log("📨 BACKEND RESPONSE:", {
        fullResponse: response,
        orderTotal: response.order?.total,
        displayTotal: response.displayTotal,
        orderItems: response.order?.orderItems,
      });

      if (response.paymentProvider === "STRIPE" && response.clientSecret) {
        return {
          success: true,
          type: "stripe",
          clientSecret: response.clientSecret,
          order: response.order,
        };
      }

      if (response.paymentProvider === "PAYPAL" && response.approvalUrl) {
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

  const clearError = () => setError(null);
  return {
    processCheckoutData,
    isProcessing,
    error,
    clearError,
  };
};
