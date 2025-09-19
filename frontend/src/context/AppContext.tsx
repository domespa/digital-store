import { createContext, useContext, useState, type ReactNode } from "react";

type AppMode = "customer" | "admin";
type AdminPage =
  | "dashboard"
  | "orders"
  | "order-detail"
  | "users-online"
  | "user-map"
  | "analytics"
  | "support"
  | "products"
  | "settings";

interface AppContextType {
  mode: AppMode;
  adminPage: AdminPage;
  selectedOrderId: string | null;

  switchToCustomer: () => void;
  switchToAdmin: () => void;

  navigateToAdminPage: (page: AdminPage) => void;
  navigateToOrderDetail: (orderId: string) => void;
  navigateBackToOrders: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("METTI DENTRO PROVIDER");
  }
  return context;
}

interface AppProvider {
  children: ReactNode;
}

export function AppProvider({ children }: AppProvider) {
  const [mode, setMode] = useState<AppMode>("customer");
  const [adminPage, setAdminPage] = useState<AdminPage>("dashboard");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const switchToCustomer = () => {
    setMode("customer");
  };

  const switchToAdmin = () => {
    setMode("admin");
    if (adminPage === "order-detail") {
      setAdminPage("dashboard");
    }
  };

  const navigateToAdminPage = (page: AdminPage) => {
    setAdminPage(page);
    if (page !== "order-detail") {
      setSelectedOrderId(null);
    }
  };

  const navigateToOrderDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setAdminPage("order-detail");
  };

  const navigateBackToOrders = () => {
    setSelectedOrderId(null);
    setAdminPage("orders");
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        adminPage,
        selectedOrderId,
        switchToCustomer,
        switchToAdmin,
        navigateToAdminPage,
        navigateToOrderDetail,
        navigateBackToOrders,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
