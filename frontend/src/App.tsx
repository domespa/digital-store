import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import StripeProvider from "./providers/StripeProvider";
import LandingPage from "./components/landing/LandingPage";
import adhdWomenConfig from "./config/landing-config/adhd-women.config";

export default function App() {
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
