import { useEffect, useCallback, useState } from "react";
import { useCart } from "./useCart";
import type { LandingContextType } from "../types/landing";
import type { ProductToAdd } from "../types/cart";

interface BackendProduct {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  description?: string;
  images?: string[];
  currency: string;
}

// ========================
//     COMBINIAMO I TIPI
// ========================
interface UseLandingCart {
  landingContext: LandingContextType;
}

export const useLandingCart = ({ landingContext }: UseLandingCart) => {
  const cart = useCart();
  const { config, user, isLoading: isLoadingUser } = landingContext;
  const [backendProduct, setBackendProduct] = useState<BackendProduct | null>(
    null
  );
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);

  // ========================
  //     PRODOTTO PRESO DA.CONFIG
  // ========================
  useEffect(() => {
    const fetchProduct = async () => {
      if (!config?.productId) {
        console.warn("⚠️ productId mancante nel config");
        return;
      }

      setIsLoadingProduct(true);
      try {
        const response = await fetch(`/api/products/${config.productId}`);
        if (!response.ok) throw new Error("Prodotto non trovato");

        const data = await response.json();
        console.log("✅ Prodotto fetchato dal backend:", data);
        setBackendProduct(data.product);
      } catch (error) {
        console.error("❌ Errore fetch prodotto:", error);
        console.log("📌 Fallback su prezzi config");
      } finally {
        setIsLoadingProduct(false);
      }
    };

    fetchProduct();
  }, [config?.productId]);

  const getMainPrice = useCallback((): number => {
    return backendProduct?.price ?? config?.pricing.mainPrice ?? 47;
  }, [backendProduct, config]);

  const getOriginalPrice = useCallback((): number => {
    return (
      backendProduct?.compareAtPrice ?? config?.pricing.originalPrice ?? 197
    );
  }, [backendProduct, config]);

  // ========================
  //     SINCRO VALUTA
  // ========================
  useEffect(() => {
    if (!isLoadingUser && user && user.currency) {
      if (user.currency !== cart.getDisplayCurrency()) {
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
      productId: config.productId || "cmgagj3jr00044emfdvtzucfb",
      name: backendProduct?.name || config.hero.title,
      price: backendProduct?.price ?? config.pricing.mainPrice,
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
        JPY: "¥",
        CHF: "Fr",
        SEK: "kr",
        NOK: "kr",
        DKK: "kr",
      };

      const symbol = currencySymbol[displayCurrency] || displayCurrency;

      if (displayCurrency === "JPY") {
        return `${symbol}${Math.round(amount)}`;
      }

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
    const originalPrice = getOriginalPrice();
    const mainPrice = getMainPrice();

    const savings = originalPrice - mainPrice;
    const savingsPercentage = Math.round((savings / originalPrice) * 100);

    return {
      originalPrice,
      mainPrice,
      savings,
      savingsPercentage,
      currency,
    };
  }, [config, user, getMainPrice, getOriginalPrice]);

  // ============================
  //      COMBINIAMO GLI STATI
  // ============================

  const isLoading = isLoadingUser || cart.cart.isConverting || isLoadingProduct;

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

    // LE FUNZIONI
    addMainProductToCart,
    addBonusToCart,
    formatPrice,
    calculateSaving,

    isLoading,
    isLoadingUser,
    isLoadingProduct,
    userCurrency: user?.currency,

    mainPrice: backendProduct?.price ?? config?.pricing.mainPrice ?? 47,
    originalPrice: config?.pricing.originalPrice ?? 197,
    backendProduct,

    // I METODI PER LE CONVERSIONI DELLA VALUTA
    updateCurrency: cart.updateCurrency,
    refreshRates: cart.refreshRates,
  };
};
