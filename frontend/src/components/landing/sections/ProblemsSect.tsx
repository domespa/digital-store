import { useLandingContext } from "../../../context/LandingContext";

export default function ProblemsSect() {
  const { config, isLoading } = useLandingContext();

  if (isLoading || !config) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 sm:py-16 lg:py-24 bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* TITLE + SUBTITLE */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
            {config.problems.title}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-6 sm:mb-8">
            {config.problems.subtitle}
          </p>

          {/* EMOTIONALS */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 max-w-2xl mx-auto">
            <p className="text-base sm:text-lg text-gray-700 italic leading-relaxed">
              "I always feel like I'm running behind, disorganized, like
              everyone else got a manual for life... and I didn't."
            </p>
            <p className="text-sm text-gray-500 mt-3 font-medium">
              - Sarah, 32, diagnosed with ADHD at 29
            </p>
          </div>
        </div>

        {/* PROBLEMS */}
        <div className="grid gap-4 sm:gap-6 lg:gap-8 md:grid-cols-2 lg:grid-cols-3 mb-8 sm:mb-12">
          {config.problems.problems.map((problem, index) => (
            <div
              key={problem.id}
              className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 border-l-4 border-red-400 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              {/* ICON + TITLE */}
              <div className="flex items-start mb-4">
                <div className="text-2xl sm:text-3xl mr-3 sm:mr-4 flex-shrink-0">
                  {problem.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                  {problem.title}
                </h3>
              </div>

              {/* DESCRIPTION */}
              <p className="text-gray-600 mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">
                {problem.description}
              </p>

              {/* PAINPOINTS */}
              <ul className="space-y-2">
                {problem.painPoints.map((point, pointIndex) => (
                  <li key={pointIndex} className="flex items-start">
                    <span className="text-red-500 mr-2 mt-1 flex-shrink-0">
                      •
                    </span>
                    <span className="text-gray-700 text-sm leading-relaxed">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center bg-white rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 lg:p-12">
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
            You Don't Have to Live Like This Anymore
          </h3>
          <p className="text-base sm:text-lg text-gray-600 mb-4 sm:mb-6 max-w-2xl mx-auto leading-relaxed">
            There's a way out. Thousands of women have already transformed their
            ADHD life from chaos to control, from overwhelming to empowering.
          </p>
          <div className="inline-flex items-center text-green-600 font-semibold text-sm sm:text-base">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Discover how you can do it too
          </div>
        </div>

        {/* STATS */}
        <div className="mt-8 sm:mt-12 lg:mt-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { number: "15,000+", label: "Women Transformed" },
              { number: "4.9/5", label: "Average Rating" },
              { number: "98%", label: "Satisfaction Rate" },
              { number: "30 days", label: "Money-Back Guarantee" },
            ].map((stat, index) => (
              <div
                key={index}
                className="text-center bg-white/80 backdrop-blur rounded-lg p-3 sm:p-4"
              >
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600 mb-1 sm:mb-2">
                  {stat.number}
                </div>
                <div className="text-xs sm:text-sm lg:text-base text-gray-600 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
