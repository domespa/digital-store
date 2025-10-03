import { useLandingContext } from "../../../context/LandingContext";
import { useLandingCart } from "../../../hooks/useLandingCart";

export default function FinalCtaSect() {
  const landingContext = useLandingContext();
  const landingCart = useLandingCart({ landingContext });
  const { config, user } = landingContext;

  if (!config || !config.finalCta) return null;

  const userCurrency = user?.currency || "USD";

  return (
    <section className="py-20 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {config.finalCta.title}
          </h2>
          <p className="text-xl md:text-2xl mb-8 text-purple-100">
            {config.finalCta.subtitle}
          </p>

          {config.finalCta.stats && (
            <div className="flex flex-wrap justify-center gap-8 mb-8">
              {config.finalCta.stats.map((stat, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-2xl font-bold">{stat}</div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={landingCart.addMainProductToCart}
            disabled={landingCart.isLoading}
            className="bg-white text-purple-600 px-12 py-6 rounded-xl text-2xl font-bold transform hover:scale-105 transition-all duration-200 shadow-2xl mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {config.finalCta.ctaText}
          </button>

          <div className="text-2xl mb-6">
            <span className="font-bold">
              {landingCart.formatPrice(landingCart.mainPrice, userCurrency)}
            </span>
            <span className="line-through opacity-75 ml-3">
              {landingCart.formatPrice(landingCart.originalPrice, userCurrency)}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-lg p-6 mb-4">
            <p className="text-lg">{config.finalCta.guaranteeText}</p>
          </div>

          {config.finalCta.urgencyMessage && (
            <p className="text-yellow-300 font-semibold">
              ⚡ {config.finalCta.urgencyMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
