import { useLandingContext } from "../../../context/LandingContext";

export default function FeaturesSect() {
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
    <section className="py-12 sm:py-16 lg:py-24 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* TITLE + SUBTITLE */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
            {config.features.title}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            {config.features.subtitle}
          </p>
        </div>

        {/* FEATURES GRID */}
        <div className="grid gap-6 sm:gap-8 lg:gap-10 md:grid-cols-2 mb-12 sm:mb-16 lg:mb-20">
          {config.features.features.map((feature) => (
            <div
              key={feature.id}
              className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10 border-l-4 border-purple-400 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl group"
            >
              <div className="flex items-start mb-4 sm:mb-6">
                <div className="text-3xl sm:text-4xl mr-4 flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                    {feature.description}
                  </p>
                </div>
              </div>

              <ul className="space-y-3">
                {feature.benefits.map((benefit, benefitIndex) => (
                  <li key={benefitIndex} className="flex items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mr-3 mt-0.5">
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
                    <span className="text-gray-700 text-sm sm:text-base leading-relaxed">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CHAPTER HIGHLIGHTS */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-8">
            What You'll Discover Inside
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
              <h4 className="font-bold text-purple-600 mb-3 text-lg">
                Chapter 2: Understanding Masking
              </h4>
              <p className="text-gray-700">
                Learn why you've been pretending to be "normal" and what it's
                costing you. Discover how to unmask safely and authentically
                without losing yourself.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-pink-500">
              <h4 className="font-bold text-pink-600 mb-3 text-lg">
                Chapter 5: The 2-Minute Rule
              </h4>
              <p className="text-gray-700">
                The simple technique that stops procrastination before it
                starts. Works even when you have zero motivation or energy.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500">
              <h4 className="font-bold text-indigo-600 mb-3 text-lg">
                Chapter 7: ADHD Motherhood
              </h4>
              <p className="text-gray-700">
                Managing your ADHD while raising kids. Morning routines that
                work, handling mom guilt, and modeling healthy ADHD management
                for your children.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-teal-500">
              <h4 className="font-bold text-teal-600 mb-3 text-lg">
                Chapter 9: Real Transformation Stories
              </h4>
              <p className="text-gray-700">
                Stories from Maria (entrepreneur), Sarah (mom of 3), and
                Jennifer (student) who went from struggling daily to thriving in
                their lives.
              </p>
            </div>
          </div>
        </div>

        {/* BONUSES SECTION */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-12 text-white">
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">
              Exclusive Bonuses Included
            </h3>
            <p className="text-lg sm:text-xl text-purple-100 max-w-2xl mx-auto leading-relaxed">
              In addition to the main guide, you'll get these incredible bonuses
              absolutely FREE
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
            {config.features.bonuses.map((bonus) => (
              <div
                key={bonus.id}
                className="bg-white/10 backdrop-blur rounded-xl p-4 sm:p-6 border border-white/20 transform transition-all duration-300 hover:scale-105 hover:bg-white/15"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="text-2xl sm:text-3xl">{bonus.icon}</div>
                  <div className="bg-yellow-400 text-purple-900 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                    ${bonus.value} VALUE
                  </div>
                </div>

                <h4 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">
                  {bonus.title}
                </h4>
                <p className="text-sm sm:text-base text-purple-100 leading-relaxed">
                  {bonus.description}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8 sm:mt-10 lg:mt-12 p-4 sm:p-6 bg-white/10 rounded-xl border border-white/20">
            <p className="text-base sm:text-lg text-purple-100 mb-2">
              Total Bonus Value:
            </p>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-yellow-400">
              $
              {config.features.bonuses.reduce(
                (total, bonus) => total + bonus.value,
                0
              )}
            </div>
            <p className="text-sm sm:text-base text-purple-200 mt-2">
              But today, it's all yours FREE with your purchase
            </p>
          </div>
        </div>

        {/* FINAL CTA */}
        <div className="text-center mt-12 sm:mt-16 lg:mt-20">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl p-8 max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold mb-4">
              200+ Pages. 10 Chapters. Lifetime Access.
            </h3>
            <p className="text-xl mb-6 text-purple-100">
              From late diagnosis to daily strategies, relationships to
              motherhood - everything you need in one complete system.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl mb-2">📖</div>
                <div className="font-bold">200+ Pages</div>
                <div className="text-sm text-purple-200">Evidence-based</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🎧</div>
                <div className="font-bold">8+ Hours Audio</div>
                <div className="text-sm text-purple-200">
                  Professional narration
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">📝</div>
                <div className="font-bold">50+ Exercises</div>
                <div className="text-sm text-purple-200">
                  Interactive workbook
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">✅</div>
                <div className="font-bold">30+ Templates</div>
                <div className="text-sm text-purple-200">
                  Ready to use today
                </div>
              </div>
            </div>

            <div className="bg-white/20 backdrop-blur rounded-lg p-4">
              <p className="text-sm">
                ⚡ <strong>Instant Download</strong> - Start reading in 2
                minutes. Works on any device. Yours forever with lifetime
                updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
