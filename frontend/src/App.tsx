import { AppProvider, useApp } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import StripeProvider from "./providers/StripeProvider";
import LandingPage from "./components/landing/LandingPage";
import adhdWomenConfig from "./config/landing-config/adhd-women.config";
import AdminApp from "./components/admin/AdminApp";

function CustomerApp() {
  return (
    <AuthProvider>
      <CartProvider>
        <StripeProvider>
          <LandingPage config={adhdWomenConfig} />
        </StripeProvider>
      </CartProvider>
    </AuthProvider>
  );
}

// PER SVILUPPO
function DevModeSwitcher() {
  const { mode, switchToCustomer, switchToAdmin } = useApp();

  return (
    <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500 mb-2 text-center">🚧 DEV MODE</div>
      <div className="flex gap-2">
        <button
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === "customer"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-900 hover:bg-gray-300"
          }`}
          onClick={switchToCustomer}
        >
          🛒 Customer
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === "admin"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-900 hover:bg-gray-300"
          }`}
          onClick={switchToAdmin}
        >
          ⚙️ Admin
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { mode } = useApp();

  return (
    <>
      {mode === "customer" ? <CustomerApp /> : <AdminApp />}
      <DevModeSwitcher />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
