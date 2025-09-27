import { LandingProvider } from "../../context/LandingContext";
import type { LandingPageProps } from "../../types/landing";

// ============================
//      IMPORT SEZIONI
// ============================
import HeroSect from "./sections/HeroSect";
import ProblemsSect from "./sections/ProblemsSect";
import FeaturesSect from "./sections/FeaturesSect";
import TestimonialSect from "./sections/TestimonialSect";
import FaqSect from "./sections/FaqSect";
import PricingSect from "./sections/PricingSect";
import CartSlideBar from "../cart/CartSlideBar";
import CartIcon from "../cart/CartIcon";
import { useEffect } from "react";
import { useLandingContext } from "../../context/LandingContext";
import { useCart } from "../../hooks/useCart";

const LandingPageContent = () => {
  const { user, isLoading } = useLandingContext();
  const { setInitialCurrency } = useCart();

  useEffect(() => {
    if (user?.currency && !isLoading) {
      console.log("🌍 IMPOSTANDO VALUTA CARRELLO:", user.currency);
      setInitialCurrency(user.currency);
    }
  }, [user?.currency, isLoading, setInitialCurrency]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Rilevamento posizione...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-page">
      <HeroSect />
      <ProblemsSect />
      <FeaturesSect />
      <TestimonialSect />
      <FaqSect />
      <PricingSect />
    </div>
  );
};

export default function LandingPage({
  config,
  className = "",
}: LandingPageProps) {
  return (
    <div className={`min-h-screen ${className}`}>
      <LandingProvider config={config}>
        <LandingPageContent />
        <CartSlideBar />
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
          }}
        >
          <CartIcon />
        </div>
      </LandingProvider>
    </div>
  );
}
