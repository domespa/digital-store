import { useLandingContext } from "../../../context/LandingContext";

export default function TrustBarSect() {
  const { config, isLoading } = useLandingContext();

  if (isLoading || !config || !config.trustBar) return null;

  return (
    <section className="py-6 bg-white border-y border-gray-200">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {config.trustBar.stats.map((stat, idx) => (
            <div key={idx} className="text-center">
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-purple-600">
                {stat.number}
              </div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>

        {config.trustBar.trustedBy && (
          <p className="text-center text-sm text-gray-500 italic">
            {config.trustBar.trustedBy}
          </p>
        )}
      </div>
    </section>
  );
}
