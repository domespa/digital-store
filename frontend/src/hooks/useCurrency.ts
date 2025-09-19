import { useState, useCallback } from "react";
import type { ConversionResponse } from "../types/cart";

export default function useCurrency() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

  // CONVERTITORE VALUTA
  const convertPrice = useCallback(
    async (
      amount: number,
      fromCurrency: string,
      toCurrency: string
    ): Promise<ConversionResponse | null> => {
      // STESSA VALUTA
      if (fromCurrency === toCurrency) {
        return {
          convertedAmount: amount,
          rate: 1,
          source: "same",
          timestamp: Date.now(),
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/currency/convert?` +
            new URLSearchParams({
              amount: amount.toString(),
              from: fromCurrency,
              to: toCurrency,
            }),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`API ERROR: ${response.status}`);
        }

        const data = await response.json();

        return {
          convertedAmount: data.convertedAmount,
          rate: data.rate,
          source: data.source,
          timestamp: data.timestamp || Date.now(),
        };
      } catch (error) {
        console.warn("CONVERSION FAIL", error);

        const fallbackRates: Record<string, Record<string, number>> = {
          USD: { EUR: 0.91, GBP: 0.77, AUD: 1.5 },
          EUR: { USD: 1.1, GBP: 0.85, AUD: 1.65 },
          GBP: { USD: 1.3, EUR: 1.18, AUD: 1.95 },
          AUD: { USD: 0.67, EUR: 0.61, GBP: 0.51 },
        };

        const rate = fallbackRates[fromCurrency]?.[toCurrency];

        if (rate) {
          setError("CHANGE APPROX");
          return {
            convertedAmount: Math.round(amount * rate * 100) / 100,
            rate,
            source: "fallback",
            timestamp: Date.now(),
          };
        } else {
          setError("CONVS NOT AVAIBLE");
          return null;
        }
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE_URL]
  );

  // CONVERTIAMO TUTTO IL CARRELLO
  const convertPriceList = useCallback(
    async (
      items: Array<{ amount: number; fromCurrency: string }>,
      toCurrency: string
    ): Promise<ConversionResponse[]> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/currency/convert-batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items,
            targetCurrency: toCurrency,
          }),
        });

        if (!response.ok) {
          throw new Error(`FAIL BATCH: ${response.status}`);
        }

        const data = await response.json();
        return data.conversions;
      } catch (error) {
        console.warn("FAIL BATCH", error);

        const conversions: ConversionResponse[] = [];

        for (const item of items) {
          const conversion = await convertPrice(
            item.amount,
            item.fromCurrency,
            toCurrency
          );

          if (conversion) {
            conversions.push(conversion);
          }
        }
        return conversions;
      } finally {
        setIsLoading(false);
      }
    },
    [convertPrice, API_BASE_URL]
  );

  return {
    convertPrice,
    convertPriceList,
    isLoading,
    error,
  };
}
