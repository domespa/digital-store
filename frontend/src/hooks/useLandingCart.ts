import { useEffect, useCallback } from "react";
import { useCart } from "./useCart";
import type { LandingContextType } from "../types/landing";
import type { ProductToAdd } from "../types/cart";

// ========================
//     COMBINIAMO I TIPI
// ========================
interface UseLandingCart {
  landingContext: LandingContextType;
}

export const useLandingCart = ({ landingContext }: UseLandingCart) => {
  const cart = useCart();
  const { config, user, isLoading: isLoadingUser } = landingContext;

  // ========================
  //     SINCRO VALUTA
  // ========================
  useEffect(() => {
    if (!isLoadingUser && user && user.currency) {
      if (user.currency === cart.getDisplayCurrency()) {
        console.log(
          `UPDATE CART ${cart.getDisplayCurrency()} TO ${user.currency}`
        );
        cart.updateCurrency(user.currency);
      }
    }
  }, [user, isLoadingUser, cart]);

  // ========================
  //      HELPER
  // ========================
  const addMainProductToCart = useCallback(() => {
    if (!config) return;

    const product: ProductToAdd = {
      id: `main-product-${config.productId}`,
      productId: config.productId || "adhd-women-ebook",
      name: config.hero.title,
      price: config.pricing.mainPrice,
      currency: config.pricing.currency,
      image: config.hero.image,
      description: config.hero.subtitle,
    };

    cart.addItem(product);
  }, [config, cart]);

  // BONUS
  const addBonusToCart = useCallback(
    (bonusId: string) => {
      if (!config) return;

      const bonus = config.features.bonuses.find((b) => b.id === bonusId);
      if (!bonus) return;

      const product: ProductToAdd = {
        id: `bonus-${bonusId}-${config.productId}`,
        productId: `${config.productId}-${bonusId}`,
        name: bonus.title,
        price: bonus.value,
        currency: config.pricing.currency,
        image: bonus.icon,
        description: bonus.description,
      };

      cart.addItem(product);
    },
    [config, cart]
  );

  // PASSIAMO VALUTA CORETTA
  const formatPrice = useCallback(
    (amount: number, currency?: string): string => {
      const displayCurrency = currency || user?.currency || "USD";
      const currencySymbol: Record<string, string> = {
        USD: "$",
        EUR: "€",
        GBP: "£",
        AUD: "A$",
        CAD: "C$",
      };

      const symbol = currencySymbol[displayCurrency] || displayCurrency;
      return `${symbol}${amount.toFixed(2)}`;
    },
    [user]
  );

  // CALC SAVING
  const calculateSaving = useCallback((): {
    originalPrice: number;
    mainPrice: number;
    savings: number;
    savingsPercentage: number;
    currency: string;
  } | null => {
    if (!config) return null;

    const currency = user?.currency || config.pricing.currency;
    return {
      originalPrice: config.pricing.originalPrice,
      mainPrice: config.pricing.mainPrice,
      savings: config.pricing.originalPrice - config.pricing.mainPrice,
      savingsPercentage: Math.round(
        ((config.pricing.originalPrice - config.pricing.mainPrice) /
          config.pricing.originalPrice) *
          100
      ),
      currency,
    };
  }, [config, user]);

  // ============================
  //      COMBINIAMO GLI STATI
  // ============================

  const isLoading = isLoadingUser || cart.cart.isConverting;

  return {
    // RITORNIAMO LO STATO DEL CARRELLO
    cart: cart.cart,
    cartActions: {
      addItem: cart.addItem,
      removeItem: cart.removeItem,
      updateQuantity: cart.updateQuantity,
      clearCart: cart.clearCart,
      toggleCart: cart.toggleCart,
    },

    // + LE FUNZIONI
    addMainProductToCart,
    addBonusToCart,
    formatPrice,
    calculateSaving,

    isLoading,
    isLoadingUser,
    userCurrency: user?.currency,

    // + I METODI PER LE CONVERSIONI DELLA VALUTA
    updateCurrency: cart.updateCurrency,
    refreshRates: cart.refreshRates,
  };
};
