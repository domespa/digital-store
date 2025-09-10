import { Router } from "express";
import { AnalyticsController } from "../controllers/analyticsController";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import rateLimit from "express-rate-limit";

const router = Router();

// ==================== MIDDLEWARE ====================

// APPLICA AUTH ADMIN A TUTTE LE ROUTE
router.use(authenticateToken);
router.use(requireAdmin);

// RATE LIMITING PER ANALYTICS
const analyticsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // 100 richieste per 15 minuti
  message: {
    success: false,
    error: "Troppe richieste analytics. Riprova tra 15 minuti.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(analyticsRateLimit);

// ==================== ROUTE ANALYTICS ====================

// DASHBOARD METRICS COMPLETE
// GET /api/admin/analytics/dashboard?period=week&from=2024-01-01&to=2024-01-31
router.get("/dashboard", AnalyticsController.getDashboardMetrics);

// METRICHE OVERVIEW (KPI PRINCIPALI)
// GET /api/admin/analytics/overview?period=month
router.get("/overview", AnalyticsController.getOverviewMetrics);

// METRICHE VENDITE
// GET /api/admin/analytics/sales?period=week&currency=EUR
router.get("/sales", AnalyticsController.getSalesMetrics);

// METRICHE PRODOTTI
// GET /api/admin/analytics/products?period=month&categoryId=123
router.get("/products", AnalyticsController.getProductMetrics);

// METRICHE UTENTI
// GET /api/admin/analytics/users?period=month
router.get("/users", AnalyticsController.getUserMetrics);

// METRICHE RECENSIONI
// GET /api/admin/analytics/reviews?period=week
router.get("/reviews", AnalyticsController.getReviewMetrics);

// METRICHE REAL-TIME
// GET /api/admin/analytics/realtime
router.get("/realtime", AnalyticsController.getRealTimeMetrics);

// INSIGHTS E SUGGERIMENTI
// GET /api/admin/analytics/insights?period=month
router.get("/insights", AnalyticsController.getDashboardInsights);

// TOP PRODUCTS PER PERIODO
// GET /api/admin/analytics/top-products?period=month&limit=10
router.get("/top-products", AnalyticsController.getTopProducts);

// PERFORMANCE PER CATEGORIA
// GET /api/admin/analytics/categories?period=month
router.get("/categories", AnalyticsController.getCategoryPerformance);

// TREND ANALYSIS
// GET /api/admin/analytics/trends?metric=revenue&period=month
router.get("/trends", AnalyticsController.getTrends);

// COMPARAZIONE PERIODI
// GET /api/admin/analytics/compare?currentPeriod=month&previousPeriod=month&metric=revenue
router.get("/compare", AnalyticsController.comparePeriods);

// EXPORT DATI ANALYTICS
// POST /api/admin/analytics/export
router.post("/export", AnalyticsController.exportAnalytics);

// ==================== HEALTH CHECK ====================

// HEALTH CHECK ANALYTICS SYSTEM
// GET /api/admin/analytics/health
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Analytics system operational",
    timestamp: new Date().toISOString(),
    endpoints: {
      dashboard: [
        "GET /dashboard (complete metrics)",
        "GET /overview (KPI metrics)",
        "GET /sales (sales metrics)",
        "GET /products (product metrics)",
        "GET /users (user metrics)",
        "GET /reviews (review metrics)",
        "GET /realtime (real-time metrics)",
        "GET /insights (performance insights)",
        "GET /top-products (best sellers)",
        "GET /categories (category performance)",
        "GET /trends (trend analysis)",
        "GET /compare (period comparison)",
        "POST /export (data export)",
      ],
    },
    features: [
      "Complete dashboard metrics",
      "Real-time KPI tracking",
      "Sales performance analysis",
      "Product performance metrics",
      "User growth analytics",
      "Review system metrics",
      "Performance insights & suggestions",
      "Period-over-period comparisons",
      "Top products analysis",
      "Category performance tracking",
      "Trend analysis & predictions",
      "Data export functionality",
    ],
    supportedPeriods: [
      "today",
      "week",
      "month",
      "quarter",
      "year",
      "custom (with from/to dates)",
    ],
    rateLimits: {
      analytics: "100 per 15 minutes",
    },
  });
});

export default router;
