import { useLandingContext } from "../../../context/LandingContext";
import { useLanding } from "../../../hooks/useLanding";
import { useLandingCart } from "../../../hooks/useLandingCart";
import adhdWomenConfig from "../../../config/landing-config/adhd-women.config";

interface PricingSect {
  className?: string;
}

export default function PricingSect({ className }: PricingSect = {}) {
  const landingContext = useLandingContext();
  const landingCart = useLandingCart({ landingContext });

  const { config, user, isLoading: isLoadingUser } = landingContext;
  const {
    cart,
    isLoading: isLoadingCart,
    formatPrice,
    calculateSaving,
  } = landingCart;

  if (isLoadingUser || !config) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // CALCOLI PREZZI
  const savings = calculateSaving();
  const userCurrency = user?.currency || "USD";

  // MOSTRIAMO SOLO I PREZZI IN BASE ALLA SUA PROVENZIENZA
  const displayMainPrice = config.pricing.mainPrice;
  const displayOriginalPrice = config.pricing.originalPrice;
  return (
    <section className="py-20 bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-6">
        {/* HEADER */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {config.pricing.title}
          </h2>
          <p className="text-xl text-gray-600">{config.pricing.subtitle}</p>
        </div>

        {/* PRICING CARD */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-purple-200">
          {/* CURRENCY INDICATOR */}
          {isLoadingCart && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-center">
              <div className="text-sm text-blue-600">
                Aggiornamento prezzi per {userCurrency}...
              </div>
            </div>
          )}

          {/* PREZZO PRINCIPALE */}
          <div className="text-center mb-8">
            <div className="flex justify-center items-end gap-3 mb-2">
              {/* PREZZO SCONTATO */}
              <span className="text-6xl font-bold text-purple-600">
                {formatPrice(displayMainPrice, userCurrency)}
              </span>

              {/* PREZZO ORIGINALE BARRATO */}
              <span className="text-2xl text-gray-400 line-through mb-3">
                {formatPrice(displayOriginalPrice, userCurrency)}
              </span>
            </div>

            {/* RISPARMIO */}
            {savings && (
              <div className="text-lg text-green-600 font-semibold">
                Risparmi {formatPrice(savings.savings, userCurrency)} (
                {savings.savingsPercentage}%)
              </div>
            )}
          </div>

          {/* COSA È INCLUSO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {config.pricing.included.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>

          {/* HIGHLIGHTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {config.pricing.highlights.map((highlight, index) => (
              <div key={index} className="flex gap-4">
                <div className="text-2xl">{highlight.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {highlight.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {highlight.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* PULSANTE ACQUISTO */}
          <div className="text-center">
            <button
              onClick={landingCart.addMainProductToCart}
              disabled={isLoadingCart}
              className={`
                w-full py-4 px-8 rounded-xl text-xl font-bold text-white 
                transition-all duration-300 transform hover:scale-105
                ${
                  isLoadingCart
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                }
              `}
            >
              {isLoadingCart ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Caricamento...
                </div>
              ) : (
                <>
                  {config.hero.ctaText} -{" "}
                  {formatPrice(displayMainPrice, userCurrency)}
                </>
              )}
            </button>

            {/* GARANZIE */}
            <div className="mt-6 space-y-2">
              {config.pricing.guarantees.map((guarantee, index) => (
                <div key={index} className="text-sm text-gray-600">
                  ✓ {guarantee}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
