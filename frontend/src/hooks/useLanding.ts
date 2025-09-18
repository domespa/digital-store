import { useState, useEffect } from "react";
import type {
  LandingConfig,
  LandingUser,
  LandingContextType,
} from "../types/landing";

export const useLanding = (config: LandingConfig): LandingContextType => {
  const [user, setUser] = useState<LandingUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // RILEVIAMO L'UTENTE UTILIZZANDO https://ipapi.co/json/
  useEffect(() => {
    const detectUser = async () => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();

        if (data.country_name && !data.error) {
          const detectUser: LandingUser = {
            country: data.country_name,
            currency: getCurrencyByCountry(data.country_code),
            latitude: data.latitude,
            longitude: data.longitude,
          };
          setUser(detectUser);
        } else {
          throw new Error("NON E' STATO POSSIBILE TROVARE L'UTENTE");
        }
      } catch (error) {
        console.warn("LOCALIZZAZIONE FALLITA", error);

        // USA DI DEF
        const fallbackUser: LandingUser = {
          country: "UNITED STATES",
          currency: "USD",
          latitude: 0,
          longitude: 0,
        };
        setUser(fallbackUser);
      } finally {
        setIsLoading(false);
      }
    };
    detectUser();
  }, []);

  const contextValue: LandingContextType = {
    config,
    user,
    isLoading,
  };
  return contextValue;
};

// IMPOSTIAMO LE VALUTE
const getCurrencyByCountry = (countryCode: string): string => {
  const countryToCurrency: Record<string, string> = {
    US: "USD", // Stati Uniti
    CA: "USD", // Canada
    GB: "GBP", // Regno Unito
    IE: "GBP", // Irlanda
    AU: "AUD", // Australia
    NZ: "AUD", // Nuova Zelanda
    IT: "EUR", // Italia
    DE: "EUR", // Germania
    FR: "EUR", // Francia
    ES: "EUR", // Spagna
    NL: "EUR", // Olanda
  };

  return countryToCurrency[countryCode] || "USD";
};
