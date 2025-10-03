import { useLandingContext } from "../../../context/LandingContext";
import { useLandingCart } from "../../../hooks/useLandingCart";
import { useState, useEffect } from "react";

export default function StickyCtaBar() {
  const landingContext = useLandingContext();
  const landingCart = useLandingCart({ landingContext });
  const { config, user } = landingContext;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 800);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!config || !config.stickyBar?.enabled) return null;

  const userCurrency = user?.currency || "USD";

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white shadow-2xl border-t-2 border-purple-600 z-50 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-bold text-gray-900">{config.stickyBar.text}</p>
            <p className="text-sm text-gray-600">
              {landingCart.formatPrice(landingCart.mainPrice, userCurrency)}
              <span className="line-through ml-2 opacity-60">
                {landingCart.formatPrice(
                  landingCart.originalPrice,
                  userCurrency
                )}
              </span>
            </p>
          </div>

          <button
            onClick={landingCart.addMainProductToCart}
            disabled={landingCart.isLoading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-lg font-bold transform hover:scale-105 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {config.stickyBar.ctaText}
          </button>
        </div>
      </div>
    </div>
  );
}
