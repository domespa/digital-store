import axios from "axios";
import NodeCache from "node-cache";

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  flag?: string;
}

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

// VALUTE
export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  EUR: { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  USD: { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵" },
  CHF: { code: "CHF", symbol: "Fr", name: "Swiss Franc", flag: "🇨🇭" },
  SEK: { code: "SEK", symbol: "kr", name: "Swedish Krona", flag: "🇸🇪" },
  NOK: { code: "NOK", symbol: "kr", name: "Norwegian Krone", flag: "🇳🇴" },
  DKK: { code: "DKK", symbol: "kr", name: "Danish Krone", flag: "🇩🇰" },
};

export class CurrencyService {
  private cache: NodeCache;
  private fallbackRates: Record<string, Record<string, number>>;

  constructor() {
    // CACHE UN ORA
    this.cache = new NodeCache({
      stdTTL: parseInt(process.env.CURRENCY_CACHE_TTL || "3600"),
      checkperiod: 600,
    });

    // SE LE API NON VANNO
    this.fallbackRates = {
      EUR: {
        USD: 1.1,
        GBP: 0.85,
        AUD: 1.65,
        CAD: 1.5,
        JPY: 165.0,
        CHF: 0.97,
        SEK: 11.5,
        NOK: 11.8,
        DKK: 7.45,
      },
      USD: {
        EUR: 0.91,
        GBP: 0.77,
        AUD: 1.5,
        CAD: 1.36,
        JPY: 150.0,
        CHF: 0.88,
        SEK: 10.45,
        NOK: 10.72,
        DKK: 6.77,
      },
      GBP: {
        EUR: 1.18,
        USD: 1.3,
        AUD: 1.95,
        CAD: 1.77,
        JPY: 195.0,
        CHF: 1.14,
        SEK: 13.56,
        NOK: 13.93,
        DKK: 8.78,
      },
    };
  }

  // RILEVIAMO VALUTA DA IP
  static detectCurrencyFromCountry(country: string): string {
    const currencyMap: Record<string, string> = {
      US: "USD",
      GB: "GBP",
      AU: "AUD",
      CA: "CAD",
      IT: "EUR",
      FR: "EUR",
      DE: "EUR",
      ES: "EUR",
      NL: "EUR",
      JP: "JPY",
      CH: "CHF",
      SE: "SEK",
      NO: "NOK",
      DK: "DKK",
    };
    return currencyMap[country] || "EUR";
  }

  // OTTENIAMO I TASSI DA API
  private async fetchExchangeRates(
    baseCurrency: string = "EUR"
  ): Promise<ExchangeRates | null> {
    const cacheKey = `rates_${baseCurrency}`;

    // Controlla cache prima
    const cached = this.cache.get<ExchangeRates>(cacheKey);
    if (cached) {
      console.log(`📊 Using cached rates for ${baseCurrency}`);
      return cached;
    }

    try {
      const provider = process.env.EXCHANGE_API_PROVIDER || "exchangerate";
      let response;

      switch (provider) {
        case "fixer":
          response = await this.fetchFromFixer(baseCurrency);
          break;
        case "currencyapi":
          response = await this.fetchFromCurrencyAPI(baseCurrency);
          break;
        case "exchangerate":
        default:
          response = await this.fetchFromExchangeRate(baseCurrency);
          break;
      }

      if (response) {
        // Salva in cache
        this.cache.set(cacheKey, response);
        console.log(
          `💰 Fresh rates loaded for ${baseCurrency} from ${provider}`
        );
        return response;
      }
    } catch (error) {
      console.error("❌ Error fetching exchange rates:", error);
    }

    return null;
  }

  // EXCHANGERATE
  private async fetchFromExchangeRate(
    baseCurrency: string
  ): Promise<ExchangeRates | null> {
    try {
      const url = `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;
      const response = await axios.get(url, { timeout: 5000 });

      return {
        base: baseCurrency,
        rates: response.data.rates,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("ExchangeRate-API error:", error);
      return null;
    }
  }

  // FIXER.IO
  private async fetchFromFixer(
    baseCurrency: string
  ): Promise<ExchangeRates | null> {
    const apiKey = process.env.EXCHANGE_API_KEY;
    if (!apiKey) return null;

    try {
      const url = `http://data.fixer.io/api/latest?access_key=${apiKey}&base=${baseCurrency}`;
      const response = await axios.get(url, { timeout: 5000 });

      if (response.data.success) {
        return {
          base: baseCurrency,
          rates: response.data.rates,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error("Fixer.io error:", error);
    }
    return null;
  }

  // CURRENCYAPI
  private async fetchFromCurrencyAPI(
    baseCurrency: string
  ): Promise<ExchangeRates | null> {
    const apiKey = process.env.EXCHANGE_API_KEY;
    if (!apiKey) return null;

    try {
      const currencies = Object.keys(SUPPORTED_CURRENCIES).join(",");
      const url = `https://api.currencyapi.com/v3/latest?apikey=${apiKey}&base_currency=${baseCurrency}&currencies=${currencies}`;
      const response = await axios.get(url, { timeout: 5000 });

      // Trasforma formato CurrencyAPI in nostro formato
      const rates: Record<string, number> = {};
      for (const [currency, data] of Object.entries(
        response.data.data as Record<string, any>
      )) {
        rates[currency] = data.value;
      }

      return {
        base: baseCurrency,
        rates,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("CurrencyAPI error:", error);
    }
    return null;
  }

  // COVNERTIAMO IL PREZZO
  async convertPrice(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    precision: number = 2
  ): Promise<{
    convertedAmount: number;
    rate: number;
    source: "api" | "fallback" | "same";
    timestamp: number;
  }> {
    // UGUALE
    if (fromCurrency === toCurrency) {
      return {
        convertedAmount: amount,
        rate: 1,
        source: "same",
        timestamp: Date.now(),
      };
    }

    // PROVA API REALTIME
    const apiRates = await this.fetchExchangeRates(fromCurrency);

    if (apiRates && apiRates.rates[toCurrency]) {
      const rate = apiRates.rates[toCurrency];
      const convertedAmount =
        Math.round(amount * rate * Math.pow(10, precision)) /
        Math.pow(10, precision);

      return {
        convertedAmount,
        rate,
        source: "api",
        timestamp: apiRates.timestamp,
      };
    }

    // FALLBACK
    console.warn(
      `⚠️  Using fallback rates for ${fromCurrency} -> ${toCurrency}`
    );
    const fallbackRate = this.fallbackRates[fromCurrency]?.[toCurrency];

    if (fallbackRate) {
      const convertedAmount =
        Math.round(amount * fallbackRate * Math.pow(10, precision)) /
        Math.pow(10, precision);

      return {
        convertedAmount,
        rate: fallbackRate,
        source: "fallback",
        timestamp: Date.now(),
      };
    }

    // NN
    console.error(
      `❌ No conversion rate found for ${fromCurrency} -> ${toCurrency}`
    );
    return {
      convertedAmount: amount,
      rate: 1,
      source: "same",
      timestamp: Date.now(),
    };
  }

  // CONVERTIAMO I PREZZI
  async convertPriceList(
    items: Array<{ amount: number; currency: string }>,
    targetCurrency: string
  ): Promise<
    Array<{
      originalAmount: number;
      convertedAmount: number;
      currency: string;
      rate: number;
    }>
  > {
    const results = [];

    for (const item of items) {
      const conversion = await this.convertPrice(
        item.amount,
        item.currency,
        targetCurrency
      );
      results.push({
        originalAmount: item.amount,
        convertedAmount: conversion.convertedAmount,
        currency: targetCurrency,
        rate: conversion.rate,
      });
    }

    return results;
  }

  // OTTENIAMO TUTTE LE VALUTE
  getSupportedCurrencies(): CurrencyConfig[] {
    return Object.values(SUPPORTED_CURRENCIES);
  }

  // FORMATTAZIONE PREZZO CON SIMBOLO CORRETTO
  formatPrice(
    amount: number,
    currency: string,
    locale: string = "it-IT"
  ): string {
    const currencyConfig = SUPPORTED_CURRENCIES[currency];
    if (!currencyConfig) return `${amount} ${currency}`;

    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (error) {
      return `${currencyConfig.symbol}${amount.toFixed(2)}`;
    }
  }
  clearCache(): void {
    this.cache.flushAll();
    console.log("💾 Currency cache cleared");
  }

  // STATS
  getCacheStats(): { keys: number; hits: number; misses: number } {
    const stats = this.cache.getStats();
    return {
      keys: this.cache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
    };
  }
}

export const currencyService = new CurrencyService();
