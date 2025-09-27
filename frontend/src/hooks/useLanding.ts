import { useState, useEffect } from "react";
import locationWebSocketService from "../services/locationWebSocketService";
import type {
  LandingConfig,
  LandingUser,
  LandingContextType,
} from "../types/landing";
interface IpApiResponse {
  country_name: string;
  country_code: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  timezone: string;
  error?: boolean;
}

export const useLanding = (config: LandingConfig): LandingContextType => {
  const [user, setUser] = useState<LandingUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectUser = async () => {
      try {
        console.log("🌍 Fetching location from ipapi.co...");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch("https://ipapi.co/json/", {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; LocationService/1.0)",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: IpApiResponse = await response.json();
        console.log("🔍 DATI da ipapi.co:", JSON.stringify(data, null, 2));

        if (data.country_name && !data.error) {
          console.log("✅ Geolocalizzazione riuscita:", data.country_name);

          // CREA USER
          const detectedUser: LandingUser = {
            country: data.country_name,
            currency: getCurrencyByCountry(data.country_code),
            latitude: data.latitude || 37.5647,
            longitude: data.longitude || 15.0631,
          };

          setUser(detectedUser);

          // CONNETTI WEBSOCKET E PASSA DATI
          const locationData = {
            country: data.country_name,
            city: data.city || "Unknown",
            region: data.region || "Unknown",
            latitude: data.latitude || 37.5647,
            longitude: data.longitude || 15.0631,
            countryCode: data.country_code,
            timezone: data.timezone,
          };

          // CONNETTI -> INVIA
          locationWebSocketService.connect();
          locationWebSocketService.setLocationData(locationData);
        } else {
          throw new Error("Invalid data from ipapi.co");
        }
      } catch (error) {
        console.log(
          "🌍 API geolocalizzazione non disponibile, uso fallback Sicilia:",
          error
        );

        // FALLBACK MIA ZONA DA TOGLIERE !IMPORTANT
        const fallbackUser: LandingUser = {
          country: "Italy",
          currency: "EUR",
          latitude: 37.5647,
          longitude: 15.0631,
        };

        setUser(fallbackUser);

        const fallbackLocationData = {
          country: "Italy",
          city: "Catania",
          region: "Sicily",
          latitude: 37.5647,
          longitude: 15.0631,
          countryCode: "IT",
          timezone: "Europe/Rome",
        };

        console.log(
          "📍 Invio dati fallback Catania al WebSocket:",
          fallbackLocationData
        );

        locationWebSocketService.connect();
        locationWebSocketService.setLocationData(fallbackLocationData);
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

const getCurrencyByCountry = (countryCode: string): string => {
  const countryToCurrency: Record<string, string> = {
    IT: "EUR", // Italia
    DE: "EUR", // Germania
    FR: "EUR", // Francia
    ES: "EUR", // Spagna
    NL: "EUR", // Olanda
    AT: "EUR", // Austria
    BE: "EUR", // Belgio
    PT: "EUR", // Portogallo
    FI: "EUR", // Finlandia
    IE: "EUR", // Irlanda
    GR: "EUR", // Grecia
    US: "USD", // Stati Uniti
    CA: "CAD", // Canada
    GB: "GBP", // Regno Unito
    AU: "AUD", // Australia
    NZ: "AUD", // Nuova Zelanda
    CH: "CHF", // Svizzera
    JP: "JPY", // Giappone
    SE: "SEK", // Svezia
    NO: "NOK", // Norvegia
    DK: "DKK", // Danimarca
  };

  return countryToCurrency[countryCode] || "USD";
};
