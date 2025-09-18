import { Request, Response } from "express";
import { currencyService } from "../services/currency";

export class CurrencyController {
  // CONVERSIONE SINGOLO PREZZO
  // GET /api/currency/convert?amount=47&from=USD&to=EUR
  static async convertPrice(req: Request, res: Response) {
    try {
      const { amount, from, to } = req.query;

      if (!amount || !from || !to) {
        return res.status(400).json({
          success: false,
          message: "NEED AMOUNT FROM TO",
        });
      }

      const amountNum = parseFloat(amount as string);
      if (isNaN(amountNum) || amountNum < 0) {
        return res.status(400).json({
          success: false,
          message: "AMOUNT MUST BE +",
        });
      }

      const result = await currencyService.convertPrice(
        amountNum,
        from as string,
        to as string
      );

      res.json({
        success: true,
        originalAmount: amountNum,
        convertedAmount: result.convertedAmount,
        rate: result.rate,
        source: result.source,
        timestamp: result.timestamp,
        fromCurrency: from,
        toCurrency: to,
      });
    } catch (error) {
      console.log("ERROR CONVERSION PRICE", error);
      res.status(500).json({
        success: false,
        message: "INTERNAL ERROR",
      });
    }
  }

  //============================
  //  CONVERTI LISTA PREZZI
  //============================
  // POST /api/currency/convert-batch
  // Body: { items: [{ amount: 47, fromCurrency: 'USD' }], targetCurrency: 'EUR' }

  static async convertPriceList(req: Request, res: Response) {
    try {
      const { items, targetCurrency } = req.body;

      // VALIDAZIONE
      if (!Array.isArray(items) || !targetCurrency) {
        return res.status(400).json({
          success: false,
          message: "Richiesti: items (array) e targetCurrency (string)",
        });
      }

      if (items.length === 0) {
        return res.json({
          success: true,
          conversions: [],
        });
      }

      // CONVERTI TUTTI I PREZZI
      const conversions = [];

      for (const item of items) {
        if (!item.amount || !item.fromCurrency) {
          conversions.push({
            success: false,
            error: "Item mancano amount o fromCurrency",
          });
          continue;
        }

        const result = await currencyService.convertPrice(
          item.amount,
          item.fromCurrency,
          targetCurrency
        );

        conversions.push({
          success: true,
          originalAmount: item.amount,
          convertedAmount: result.convertedAmount,
          rate: result.rate,
          source: result.source,
          timestamp: result.timestamp,
        });
      }

      res.json({
        success: true,
        targetCurrency,
        conversions,
      });
    } catch (error) {
      console.error("ERRORE CONVERSIONE BATCH:", error);
      res.status(500).json({
        success: false,
        message: "Errore interno del server",
      });
    }
  }

  // OTTIENI VALUTE SUPPORTATE
  // GET /api/currency/supported
  static async getSupportedCurrencies(req: Request, res: Response) {
    try {
      const currencies = currencyService.getSupportedCurrencies();

      res.json({
        success: true,
        currencies,
      });
    } catch (error) {
      console.error("ERRORE RECUPERO VALUTE:", error);
      res.status(500).json({
        success: false,
        message: "Errore interno del server",
      });
    }
  }

  // FORMATTA PREZZO CON LOCALE
  // GET /api/currency/format?amount=47.50&currency=EUR&locale=it-IT
  static async formatPrice(req: Request, res: Response) {
    try {
      const { amount, currency, locale = "en-US" } = req.query;

      if (!amount || !currency) {
        return res.status(400).json({
          success: false,
          message: "Richiesti amount e currency",
        });
      }

      const amountNum = parseFloat(amount as string);
      if (isNaN(amountNum)) {
        return res.status(400).json({
          success: false,
          message: "Amount deve essere un numero",
        });
      }

      const formatted = currencyService.formatPrice(
        amountNum,
        currency as string,
        locale as string
      );

      res.json({
        success: true,
        amount: amountNum,
        currency,
        locale,
        formatted,
      });
    } catch (error) {
      console.error("ERRORE FORMATTAZIONE PREZZO:", error);
      res.status(500).json({
        success: false,
        message: "Errore interno del server",
      });
    }
  }
  // STATISTICHE CACHE PER DEBUGGING
  // GET /api/currency/cache-stats
  static async getCacheStats(req: Request, res: Response) {
    try {
      const stats = currencyService.getCacheStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("ERRORE STATS CACHE:", error);
      res.status(500).json({
        success: false,
        message: "Errore interno del server",
      });
    }
  }

  // PULISCI CACHE (ADMIN)
  // POST /api/currency/clear-cache
  static async clearCache(req: Request, res: Response) {
    try {
      currencyService.clearCache();

      res.json({
        success: true,
        message: "Cache pulita con successo",
      });
    } catch (error) {
      console.error("ERRORE PULIZIA CACHE:", error);
      res.status(500).json({
        success: false,
        message: "Errore interno del server",
      });
    }
  }
}
