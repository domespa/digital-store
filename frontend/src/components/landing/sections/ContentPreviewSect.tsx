import { useLandingContext } from "../../../context/LandingContext";
import { useState } from "react";

export default function ContentPreviewSect() {
  const { config, isLoading } = useLandingContext();
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);

  if (isLoading || !config || !config.contentPreview) return null;

  return (
    <section className="py-16 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {config.contentPreview.title}
          </h2>
          <p className="text-xl text-gray-600 mb-6">
            {config.contentPreview.subtitle}
          </p>
          <div className="inline-block bg-purple-600 text-white px-6 py-2 rounded-full font-semibold">
            {config.contentPreview.totalPages}+ Pages of Transformation
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-4">
          {config.contentPreview.chapters.map((chapter) => (
            <div
              key={chapter.number}
              className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl"
            >
              <button
                onClick={() =>
                  setExpandedChapter(
                    expandedChapter === chapter.number ? null : chapter.number
                  )
                }
                className="w-full p-6 text-left flex items-start justify-between hover:bg-gray-50"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {chapter.number}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {chapter.title}
                    </h3>
                    <p className="text-gray-600">{chapter.description}</p>
                  </div>
                </div>
                <svg
                  className={`w-6 h-6 text-purple-600 flex-shrink-0 transition-transform ${
                    expandedChapter === chapter.number ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {expandedChapter === chapter.number && chapter.highlights && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <ul className="space-y-2 mt-4">
                    {chapter.highlights.map((highlight, idx) => (
                      <li key={idx} className="flex items-start">
                        <svg
                          className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-gray-700">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
