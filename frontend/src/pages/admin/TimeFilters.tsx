import { useCallback, useState } from "react";

export type TimePeriod = "today" | "week" | "month" | "year" | "total";

interface TimeFiltersProps {
  selectedPeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  loading?: boolean;
}

const TIME_PERIODS: Array<{
  key: TimePeriod;
  label: string;
  description: string;
}> = [
  {
    key: "today",
    label: "Today",
    description: "00:00 - 23:00",
  },
  {
    key: "week",
    label: "Week",
    description: "This week - Mon to Sun",
  },
  {
    key: "month",
    label: "Month",
    description: "This month",
  },
  {
    key: "year",
    label: "Year",
    description: "This year",
  },
  {
    key: "total",
    label: "All time",
    description: "Last 5 year",
  },
];

export function TimeFilters({
  selectedPeriod,
  onPeriodChange,
  loading = false,
}: TimeFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-end items-center mb-6">
      <span className="text-sm font-medium text-gray-600 mr-2">Periodo:</span>

      <div className="flex flex-wrap gap-2">
        {TIME_PERIODS.map((period) => {
          const isSelected = selectedPeriod === period.key;
          const isDefault = period.key === "today";

          return (
            <button
              key={period.key}
              onClick={() => !loading && onPeriodChange(period.key)}
              disabled={loading}
              className={`
                px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200
                ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                }
                ${isDefault && !isSelected ? "ring-2 ring-blue-200" : ""}
                ${loading ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm"}
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              `}
              title={period.description}
            >
              {period.label}
              {isDefault && !isSelected && (
                <span className="ml-1 text-blue-600">*</span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center ml-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
          <span className="ml-2 text-sm text-gray-500">Aggiornamento...</span>
        </div>
      )}
    </div>
  );
}

// HOOK FILTRI - MESSO QUI PER COMODITà
export function useTimeFilters() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("today");
  const [loading, setLoading] = useState(false);

  const handlePeriodChange = useCallback(
    (period: TimePeriod) => {
      if (period === selectedPeriod) return;

      setLoading(true);
      setSelectedPeriod(period);

      setTimeout(() => {
        setLoading(false);
      }, 500);
    },
    [selectedPeriod]
  );

  const getApiParams = useCallback(() => {
    const now = new Date();

    switch (selectedPeriod) {
      case "today":
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        return {
          period: "today" as const,
          from: startOfDay.toISOString(),
          to: endOfDay.toISOString(),
        };

      case "week":
        // Inizio settimana Lunedì // Dev ocambiare in Domenica per anglof
        const startOfWeek = new Date(now);
        const dayOfWeek = startOfWeek.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Domenica = 0
        startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return {
          period: "week" as const,
          from: startOfWeek.toISOString(),
          to: endOfWeek.toISOString(),
        };

      case "month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return {
          period: "month" as const,
          from: startOfMonth.toISOString(),
          to: endOfMonth.toISOString(),
        };

      case "year":
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        endOfYear.setHours(23, 59, 59, 999);
        return {
          period: "year" as const,
          from: startOfYear.toISOString(),
          to: endOfYear.toISOString(),
        };

      case "total":
      default:
        return { period: "total" as const };
    }
  }, [selectedPeriod]);

  return {
    selectedPeriod,
    loading,
    handlePeriodChange,
    getApiParams,
  };
}
