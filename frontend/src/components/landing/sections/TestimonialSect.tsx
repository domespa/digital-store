import { useLandingContext } from "../../../context/LandingContext";
import { useState } from "react";

export default function TestimonialSect() {
  const { config, isLoading } = useLandingContext();
  const [activeTestimonial, setActiveTestimonial] = useState(0);

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
  const stars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <svg
        key={index}
        className={`w-4 h-4 sm:w-5 sm:h-5 ${
          index < rating ? "text-yellow-400" : "text-gray-300"
        } fill-current`}
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };
  return (
    <section className="py-12 sm:py-16 lg:py-24 bg-gradient-to-br from-green-50 via-teal-50 to-blue-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* ============== TITLE + SUBTITLE ============== */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
            {config.testimonials.title}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            {config.testimonials.subtitle}
          </p>
        </div>

        {/* ============== FEATURED TESTIMONIAL (MOBILE CAROUSEL) ============== */}
        <div className="md:hidden mb-8 sm:mb-12">
          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-green-400">
            {/* TESTIMONIAL CONTENT */}
            <div className="mb-4">
              <div className="flex mb-3">
                {stars(
                  config.testimonials.testimonials[activeTestimonial].rating
                )}
              </div>
              <blockquote className="text-gray-700 text-base italic leading-relaxed mb-4">
                "{config.testimonials.testimonials[activeTestimonial].content}"
              </blockquote>
            </div>

            {/* AUTHOR INFO */}
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-teal-400 rounded-full flex items-center justify-center mr-4">
                <span className="text-white font-bold text-lg">
                  {config.testimonials.testimonials[
                    activeTestimonial
                  ].name.charAt(0)}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900">
                  {config.testimonials.testimonials[activeTestimonial].name}
                </h4>
                <p className="text-sm text-gray-600">
                  {config.testimonials.testimonials[activeTestimonial].title}
                  {config.testimonials.testimonials[activeTestimonial]
                    .location &&
                    ` • ${config.testimonials.testimonials[activeTestimonial].location}`}
                </p>
              </div>
            </div>

            {/* BEFORE/AFTER IF EXISTS */}
            {(config.testimonials.testimonials[activeTestimonial].before ||
              config.testimonials.testimonials[activeTestimonial].after) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 gap-3">
                  {config.testimonials.testimonials[activeTestimonial]
                    .before && (
                    <div>
                      <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                        Before
                      </span>
                      <p className="text-sm text-gray-700 mt-1">
                        {
                          config.testimonials.testimonials[activeTestimonial]
                            .before
                        }
                      </p>
                    </div>
                  )}
                  {config.testimonials.testimonials[activeTestimonial]
                    .after && (
                    <div>
                      <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                        After
                      </span>
                      <p className="text-sm text-gray-700 mt-1">
                        {
                          config.testimonials.testimonials[activeTestimonial]
                            .after
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* MOBILE NAVIGATION DOTS */}
          <div className="flex justify-center mt-6 space-x-2">
            {config.testimonials.testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveTestimonial(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === activeTestimonial
                    ? "bg-green-500 w-6"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* ============== DESKTOP GRID LAYOUT ============== */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-12 sm:mb-16">
          {config.testimonials.testimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 border-l-4 border-green-400 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl group"
            >
              {/* STARS RATING */}
              <div className="flex mb-4">{stars(testimonial.rating)}</div>

              {/* TESTIMONIAL QUOTE */}
              <blockquote className="text-gray-700 text-sm sm:text-base italic leading-relaxed mb-4 sm:mb-6">
                "{testimonial.content}"
              </blockquote>

              {/* AUTHOR INFO */}
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-400 to-teal-400 rounded-full flex items-center justify-center mr-3 sm:mr-4 group-hover:scale-110 transition-transform duration-200">
                  <span className="text-white font-bold text-sm sm:text-lg">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm sm:text-base">
                    {testimonial.name}
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {testimonial.title}
                    {testimonial.location && ` • ${testimonial.location}`}
                  </p>
                </div>
              </div>

              {/* BEFORE/AFTER TRANSFORMATION */}
              {(testimonial.before || testimonial.after) && (
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="grid grid-cols-1 gap-3">
                    {testimonial.before && (
                      <div>
                        <span className="text-xs font-semibold text-red-600 uppercase tracking-wide block mb-1">
                          Before
                        </span>
                        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                          {testimonial.before}
                        </p>
                      </div>
                    )}
                    {testimonial.after && (
                      <div>
                        <span className="text-xs font-semibold text-green-600 uppercase tracking-wide block mb-1">
                          After
                        </span>
                        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                          {testimonial.after}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ============== TRUST INDICATORS ============== */}
        <div className="text-center">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10 max-w-4xl mx-auto">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">
              Join Thousands of Women Who Have Already Transformed Their Lives
            </h3>

            {/* STATS ROW */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {[
                { number: "15,000+", label: "Women Helped", icon: "👩" },
                { number: "4.9/5", label: "Average Rating", icon: "⭐" },
                { number: "98%", label: "Would Recommend", icon: "💝" },
                { number: "30 Days", label: "Money Back", icon: "💰" },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl sm:text-3xl mb-2">{stat.icon}</div>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600 mb-1">
                    {stat.number}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 font-medium">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* FINAL CTA MESSAGE */}
            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 sm:p-6">
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                <strong className="text-green-600">
                  Real women, real transformations.
                </strong>{" "}
                These aren't paid actors or fake reviews. These are authentic
                stories from women just like you who decided to stop settling
                for chaos and started living the organized, confident life they
                deserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
