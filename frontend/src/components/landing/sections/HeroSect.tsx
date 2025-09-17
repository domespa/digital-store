import { useLandingContext } from "../../../context/LandingContext";

export default function HeroSect() {
  const { config, user, isLoading } = useLandingContext();

  if (isLoading) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </section>
    );
  }

  if (!config) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center text-red-600">
          <h1 className="text-xl font-bold">ERRORE: Config mancante!</h1>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-72 bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-100 flex items-center p-2">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-[80vh]">
          {/* ============== COLONNA DI SINISTRA - CONTENT ============== */}
          <div className="text-center lg:text-left space-y-6 lg:space-y-8">
            {/* TITLE */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {config.hero.title}
              </span>
            </h1>

            {/* SUBTITLE */}
            <p className="text-xl sm:text-2xl text-gray-600 font-light leading-relaxed max-w-2xl">
              {config.hero.subtitle}
            </p>

            {/* CTA */}
            <div className="space-y-4">
              <button className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-bold text-xl transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
                🚀 {config.hero.ctaText}
              </button>

              <div className="flex items-center justify-center lg:justify-start space-x-2 text-sm text-gray-500">
                <svg
                  className="w-4 h-4 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  Download immediato • Garanzia 30 giorni • Pagamento sicuro
                </span>
              </div>
            </div>

            {/* STELLINE */}
            <div className="flex items-center justify-center lg:justify-start space-x-6 text-yellow-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className="w-5 h-5 fill-current"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-gray-600 font-medium ml-2">4.9/5</span>
            </div>
          </div>

          {/* ============== COLONNA DESTRA - IMAGE ============== */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative max-w-md lg:max-w-lg">
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative bg-white rounded-2xl shadow-2xl p-6 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <img
                  src={config.hero.image}
                  alt={config.hero.title}
                  className="w-full rounded-lg"
                />

                {/* TESTIMONIALS */}
                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-3 max-w-48">
                  <p className="text-xs text-gray-600 italic">
                    "Questo libro ha cambiato la mia vita!"
                  </p>
                  <p className="text-xs font-semibold text-purple-600 mt-1">
                    - Maria, 34 anni
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
