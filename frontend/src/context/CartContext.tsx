import { createContext, useEffect, useReducer, type ReactNode } from "react";
import type {
  CartItem,
  CartState,
  CartContextType,
  ProductToAdd,
  CartStorageData,
} from "../types/cart";
import useCurrency from "../hooks/useCurrency";

// AZIONI
type CartAction =
  | { type: "ADD_ITEM"; payload: ProductToAdd }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "TOGGLE_CART" }
  | { type: "LOAD_CART"; payload: CartStorageData }
  | { type: "START_CURRENCY_CONVERSION" }
  | {
      type: "UPDATE_CURRENCY_SUCCESS";
      payload: {
        items: CartItem[];
        displayCurrency: string;
        displayTotal: number;
      };
    }
  | { type: "UPDATE_CURRENCY_ERROR" };

const initCartState: CartState = {
  items: [],
  originalTotal: 0,
  originalCurrency: "USD",
  displayTotal: 0,
  displayCurrency: "USD",
  itemsCount: 0,
  isOpen: false,
  isConverting: false,
  lastConversionUpdate: 0,
};

// REDUCER CARRELLO
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existItem = state.items.find(
        (item) => item.id === action.payload.id
      );

      let newItems: CartItem[];

      if (existItem) {
        newItems = state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        const newItem: CartItem = {
          ...action.payload,
          quantity: 1,

          originalPrice: action.payload.price,
          originalCurrency: action.payload.currency,
          displayPrice: action.payload.price,
          displayCurrency: action.payload.currency,
          conversionRate: 1,
          conversionTime: Date.now(),
        };
        newItems = [...state.items, newItem];
      }

      const { originalTotal, displayTotal } = calculateTotals(newItems);
      const itemsCount = calculateItemsCount(newItems);

      saveCartToStorage({
        items: newItems,
        originalCurrency: state.originalCurrency,
        displayCurrency: state.displayCurrency,
        timestamp: Date.now(),
      });

      return {
        ...state,
        items: newItems,
        originalTotal,
        displayTotal,
        itemsCount,
        isOpen: true,
      };
    }

    case "REMOVE_ITEM": {
      const newItems = state.items.filter((item) => item.id !== action.payload);
      const { originalTotal, displayTotal } = calculateTotals(newItems);
      const itemsCount = calculateItemsCount(newItems);

      saveCartToStorage({
        items: newItems,
        originalCurrency: state.originalCurrency,
        displayCurrency: state.displayCurrency,
        timestamp: Date.now(),
      });

      return {
        ...state,
        items: newItems,
        originalTotal,
        displayTotal,
        itemsCount,
      };
    }

    case "UPDATE_QUANTITY": {
      const newItems = state.items
        .map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(0, action.payload.quantity) }
            : item
        )
        .filter((item) => item.quantity > 0);

      const { originalTotal, displayTotal } = calculateTotals(newItems);
      const itemsCount = calculateItemsCount(newItems);

      saveCartToStorage({
        items: newItems,
        originalCurrency: state.originalCurrency,
        displayCurrency: state.displayCurrency,
        timestamp: Date.now(),
      });

      return {
        ...state,
        items: newItems,
        originalTotal,
        displayTotal,
        itemsCount,
      };
    }

    case "CLEAR_CART": {
      localStorage.removeItem("cart");
      return initCartState;
    }

    case "TOGGLE_CART": {
      return {
        ...state,
        isOpen: !state.isOpen,
      };
    }

    case "LOAD_CART": {
      const { originalTotal, displayTotal } = calculateTotals(
        action.payload.items
      );
      const itemsCount = calculateItemsCount(action.payload.items);
      return {
        ...state,
        items: action.payload.items,
        originalCurrency: action.payload.originalCurrency,
        displayCurrency: action.payload.displayCurrency,
        originalTotal,
        displayTotal,
        itemsCount,
        lastConversionUpdate: action.payload.timestamp,
      };
    }

    case "START_CURRENCY_CONVERSION": {
      return {
        ...state,
        isConverting: true,
      };
    }
    case "UPDATE_CURRENCY_SUCCESS": {
      const { originalTotal } = calculateTotals(action.payload.items);
      const itemsCount = calculateItemsCount(action.payload.items);

      saveCartToStorage({
        items: action.payload.items,
        originalCurrency: state.originalCurrency,
        displayCurrency: action.payload.displayCurrency,
        timestamp: Date.now(),
      });

      return {
        ...state,
        items: action.payload.items,
        displayCurrency: action.payload.displayCurrency,
        displayTotal: action.payload.displayTotal,
        originalTotal,
        itemsCount,
        isConverting: false,
        lastConversionUpdate: Date.now(),
      };
    }

    case "UPDATE_CURRENCY_ERROR": {
      return {
        ...state,
        isConverting: false,
      };
    }
    default:
      return state;
  }
}

// HELPER
const calculateTotals = (
  items: CartItem[]
): {
  originalTotal: number;
  displayTotal: number;
} => {
  const originalTotal = items.reduce(
    (sum, item) => sum + item.originalPrice * item.quantity,
    0
  );
  const displayTotal = items.reduce(
    (sum, item) => sum + item.displayPrice * item.quantity,
    0
  );

  return {
    originalTotal: Math.round(originalTotal * 100) / 100,
    displayTotal: Math.round(displayTotal * 100) / 100,
  };
};

const calculateItemsCount = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.quantity, 0);
};

const saveCartToStorage = (data: CartStorageData): void => {
  try {
    localStorage.setItem("cart", JSON.stringify(data));
  } catch (error) {
    console.warn("FAIL SAVE CART", error);
  }
};

const loadCartFromStorage = (): CartStorageData | null => {
  try {
    const savedCart = localStorage.getItem("cart");
    if (!savedCart) return null;

    const parsed = JSON.parse(savedCart);

    // MIGRAZIONE AUTOMATICA DAL VECCHIO FORMATO
    if (Array.isArray(parsed)) {
      console.log("🔄 Migrating cart from old format...");
      return {
        items: parsed,
        originalCurrency: "USD",
        displayCurrency: "USD",
        timestamp: Date.now(),
      };
    }

    // NUOVO FORMATO
    return parsed;
  } catch (error) {
    console.warn("FAIL LOAD CART", error);
    return null;
  }
};

// CONTEXT
export const CartContext = createContext<CartContextType | undefined>(
  undefined
);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initCartState);
  const {
    convertPrice,
    convertPriceList,
    isLoading: isConverting,
  } = useCurrency();

  useEffect(() => {
    const savedCart = loadCartFromStorage();
    if (savedCart && savedCart.items.length > 0) {
      dispatch({ type: "LOAD_CART", payload: savedCart });
    }
  }, []);
  const addItem = (product: ProductToAdd) => {
    dispatch({ type: "ADD_ITEM", payload: product });
  };

  const removeItem = (itemId: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: itemId });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { id: itemId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" });
  };

  const toggleCart = () => {
    dispatch({ type: "TOGGLE_CART" });
  };

  const getCartTotal = () => cart.displayTotal;
  const getItemsCount = () => cart.itemsCount;
  const getDisplayCurrency = () => cart.displayCurrency;
  const updateCurrency = async (newCurrency: string): Promise<void> => {
    if (newCurrency === cart.displayCurrency || cart.items.length === 0) {
      return;
    }

    dispatch({ type: "START_CURRENCY_CONVERSION" });

    try {
      // CONVERTI TUTTI I PREZZI
      const updatedItems: CartItem[] = [];

      for (const item of cart.items) {
        const conversion = await convertPrice(
          item.originalPrice,
          item.originalCurrency,
          newCurrency
        );

        if (conversion) {
          updatedItems.push({
            ...item,
            displayPrice: conversion.convertedAmount,
            displayCurrency: newCurrency,
            conversionRate: conversion.rate,
            conversionTime: conversion.timestamp,
          });
        } else {
          // MANTIENI ITEM ORIGINALE SE CONVERSIONE FALLISCE
          updatedItems.push(item);
        }
      }

      // CALCOLA NUOVO TOTALE
      const newDisplayTotal = updatedItems.reduce(
        (sum, item) => sum + item.displayPrice * item.quantity,
        0
      );

      dispatch({
        type: "UPDATE_CURRENCY_SUCCESS",
        payload: {
          items: updatedItems,
          displayCurrency: newCurrency,
          displayTotal: Math.round(newDisplayTotal * 100) / 100,
        },
      });
    } catch (error) {
      console.error("ERRORE CONVERSIONE VALUTA:", error);
      dispatch({ type: "UPDATE_CURRENCY_ERROR" });
    }
  };

  // AGGIORNA TASSI DI CAMBIO (DA CHIAMARE PERIODICAMENTE)
  const refreshRates = async (): Promise<void> => {
    if (
      cart.items.length === 0 ||
      cart.displayCurrency === cart.originalCurrency
    ) {
      return;
    }

    await updateCurrency(cart.displayCurrency);
  };

  const value: CartContextType = {
    cart: {
      ...cart,
      isConverting: cart.isConverting || isConverting,
    },
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    toggleCart,
    getCartTotal,
    getItemsCount,
    getDisplayCurrency,
    updateCurrency,
    refreshRates,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
