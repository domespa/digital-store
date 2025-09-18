export interface CartItem {
  id: string;
  productId: string;
  name: string;
  originalPrice: number;
  originalCurrency: string;

  // VALUTA CONVERTITA
  displayPrice: number;
  displayCurrency: string;
  conversionRate?: number;
  conversionTime?: number;

  quantity: number;
  image?: string;
  description?: string;
}

export interface CartState {
  items: CartItem[];
  originalTotal: number;
  originalCurrency: string;
  displayTotal: number;
  displayCurrency: string;
  itemsCount: number;
  isOpen: boolean;

  isConverting?: boolean;
  lastConversionUpdate?: number;
}

export interface CartContextType {
  cart: CartState;

  // AZIONI
  addItem: (product: ProductToAdd) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  getCartTotal: () => number;
  getItemsCount: () => number;
  getDisplayCurrency: () => string;

  // CONVERTO VALUTA
  updateCurrency: (newCurrency: string) => Promise<void>;
  refreshRates: () => Promise<void>;
}

export interface ProductToAdd {
  id: string;
  productId: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  description?: string;
}

export interface CartStorageData {
  items: CartItem[];
  originalCurrency: string;
  displayCurrency: string;
  timestamp: number;
}

export interface ConversionResponse {
  convertedAmount: number;
  rate: number;
  source: "api" | "fallback" | "same";
  timestamp: number;
}
