import { useLandingContext } from "../../../context/LandingContext";
import { useState, useEffect } from "react";

export default function UrgencySect() {
  const { config, isLoading } = useLandingContext();
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!config?.urgency?.enabled) return;

    const timer = setInterval(() => {
      const end = new Date(config.urgency.endDate).getTime();
      const now = new Date().getTime();
      const diff = end - now;

      if (diff > 0) {
        setTimeLeft({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [config]);

  if (isLoading || !config || !config.urgency?.enabled) return null;

  return (
    <section className="py-8 bg-gradient-to-r from-red-500 to-orange-500 text-white">
      <div className="container mx-auto px-4 text-center">
        <p className="text-lg font-semibold mb-4">{config.urgency.message}</p>

        <div className="flex justify-center gap-4 mb-4">
          {Object.entries(timeLeft).map(([unit, value]) => (
            <div
              key={unit}
              className="bg-white/20 backdrop-blur rounded-lg p-4 min-w-[80px]"
            >
              <div className="text-3xl font-bold">
                {String(value).padStart(2, "0")}
              </div>
              <div className="text-xs uppercase">{unit}</div>
            </div>
          ))}
        </div>

        <p className="text-sm">{config.urgency.urgencyText}</p>

        {config.urgency.showStock && (
          <div className="mt-4 inline-block bg-yellow-400 text-gray-900 px-4 py-2 rounded-full text-sm font-bold">
            ⚠️ Only {config.urgency.stockRemaining} copies left at this price!
          </div>
        )}
      </div>
    </section>
  );
}
