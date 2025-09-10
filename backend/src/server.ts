import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { createServer } from "http";
import { PrismaClient } from "./generated/prisma";

// IMPORT SECURITY
import {
  generalLimiter,
  speedLimiter,
  authLimiter,
  orderLimiter,
} from "./middleware/rateLimiting";
import {
  requestLogger,
  sanitizeInput,
  checkOrigin,
} from "./middleware/security";
import { reviewRateLimit } from "./middleware/reviewRateLimit";

// IMPORT ROTTE
import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import orderRoutes from "./routes/order";
import userRoutes from "./routes/user";
import adminRoutes from "./routes/admin";
import webhookRoutes from "./routes/webhook";
import categoryRoutes from "./routes/category";
import inventoryRoutes from "./routes/inventory";
import reviewRoutes from "./routes/review";
import wishlistRoutes from "./routes/wishlist";
import searchRoutes from "./routes/search";
import analyticsRoutes from "./routes/analytics";
import { createNotificationRoutes } from "./routes/notification";

// CARICHIAMO LE VARIABILI DI AMBIENTE
dotenv.config();

// INIT PRISMA
const prisma = new PrismaClient();

// CREO APP EXPRESS
const app = express();
const PORT = process.env.PORT || 3001;

// CREATE HTTP SERVER PER WEBSOCKET
const httpServer = createServer(app);

//=====================================================
// ==================== MIDDLEWARE ====================
//=====================================================

// 1. SICUREZZA GENERALE
app.use(helmet());
app.use(requestLogger);

// 2. CORS
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// 3. RATE LIMITING GLOBALE
app.use(generalLimiter);
app.use(speedLimiter);

// 4. WEBHOOK STRIPE (DEVE ESSERE PRIMA DI express.json())
app.use("/api/stripe", webhookRoutes);

// 5. PARSING BODY (DOPO WEBHOOKS)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 6. SANITIZZAZIONE INPUT
app.use(sanitizeInput);

//=====================================================
// ==================== HEALTH CHECK ==================
//=====================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Digital Store Backend running",
    timestamp: new Date().toISOString(),
    readable: new Date().toLocaleString("it-IT"),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    services: {
      database: "connected",
      reviews: "operational",
      payments: "operational",
      notifications: "operational",
      websocket: "enabled",
    },
  });
});

//=====================================================
// ================ ROUTE PUBBLICHE ===================
//=====================================================

// AUTH (CON RATE LIMITING SPECIFICO)
app.use("/api/auth", authLimiter, authRoutes);

// PRODOTTI (PUBBLICO)
app.use("/api/products", productRoutes);

// CATEGORIE (PUBBLICO)
app.use("/api/categories", categoryRoutes);

// RECENSIONI (PUBBLICO + AUTENTICATO)
app.use("/api/reviews", reviewRateLimit.globalLimit, reviewRoutes);

// RICERCA (PUBBLICO + AUTENTICATO)
app.use("/api/search", searchRoutes);

//=====================================================
// =============== NOTIFICHE (WEBSOCKET) ==============
//=====================================================

const notificationRoutes = createNotificationRoutes(httpServer);
app.use("/api/notifications", notificationRoutes);

//=====================================================
// ================ ROUTE AUTENTICATE =================
//=====================================================

// WISHLIST
app.use("/api/wishlist", wishlistRoutes);

// ORDINI (RICHIEDE AUTH)
app.use("/api/orders", orderLimiter, orderRoutes);

// UTENTI (RICHIEDE AUTH)
app.use("/api/user", userRoutes);

// INVENTARIO (RICHIEDE AUTH)
app.use("/api/inventory", inventoryRoutes);

//=====================================================
// ==================== ROUTE ADMIN ===================
//=====================================================

// ADMIN GENERALE (RICHIEDE ADMIN AUTH)
app.use("/api/admin", reviewRateLimit.adminModeration, adminRoutes);

// ANALYTICS ADMIN (RICHIEDE ADMIN AUTH)
app.use("/api/admin/analytics", analyticsRoutes);

//=====================================================
// ==================== DATABASE TEST =================
//=====================================================

app.get("/api/test-db", async (req, res) => {
  try {
    const [
      userCount,
      productCount,
      orderCount,
      reviewCount,
      notificationCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.review.count(),
      prisma.notification.count().catch(() => 0), // Se la tabella non esiste ancora
    ]);

    res.json({
      status: "Database collegato",
      tables: {
        users: userCount,
        products: productCount,
        orders: orderCount,
        reviews: reviewCount,
        notifications: notificationCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Errore nella connessione del DB:", error);
    res.status(500).json({
      status: "connessione db non riuscita",
      error: error instanceof Error ? error.message : "errore sconosciuto",
    });
  }
});

//=====================================================
// ================ API INFO ENDPOINT =================
//=====================================================

app.get("/api/info", (req, res) => {
  res.json({
    success: true,
    api: {
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      endpoints: {
        public: [
          "GET /api/health",
          "GET /api/test-db",
          "GET /api/info",
          "POST /api/auth/login",
          "POST /api/auth/register",
          "GET /api/products",
          "GET /api/categories",
          "GET /api/reviews",
          "POST /api/reviews (guest)",
          "POST /api/reviews/:id/vote",
          "GET /api/wishlist/shared/:shareToken",
        ],
        authenticated: [
          "GET /api/user/profile",
          "GET /api/orders",
          "POST /api/orders",
          "GET /api/reviews/me",
          "POST /api/reviews (authenticated)",
          "PUT /api/reviews/:id",
          "DELETE /api/reviews/:id",
          "POST /api/reviews/:id/report",
          "GET /api/wishlist",
          "POST /api/wishlist",
          "GET /api/wishlist/stats",
          "GET /api/wishlist/check/:productId",
          "POST /api/wishlist/toggle",
          "POST /api/wishlist/bulk",
          "GET /api/wishlist/share",
          "DELETE /api/wishlist",
          "POST /api/wishlist/:productId/move-to-cart",
          "DELETE /api/wishlist/:productId",
          "GET /api/notifications",
          "GET /api/notifications/count",
          "GET /api/notifications/stats",
          "GET /api/notifications/preferences",
          "PUT /api/notifications/preferences",
          "PUT /api/notifications/:id/read",
          "PUT /api/notifications/read-all",
          "DELETE /api/notifications/:id",
        ],
        admin: [
          "GET /api/admin/*",
          "GET /api/reviews/admin/pending",
          "PUT /api/reviews/admin/:id",
          "DELETE /api/reviews/admin/:id",
          "POST /api/notifications/admin/create",
          "POST /api/notifications/admin/bulk",
          "GET /api/notifications/admin/all",
          "GET /api/notifications/admin/stats",
          "POST /api/notifications/admin/test",
          "POST /api/notifications/admin/process-scheduled",
          "DELETE /api/notifications/admin/cleanup-expired",
          "GET /api/notifications/admin/connections",
          "POST /api/notifications/admin/templates",
          "GET /api/notifications/admin/templates",
          "PUT /api/notifications/admin/templates/:id",
          "DELETE /api/notifications/admin/templates/:id",
        ],
      },
      rateLimits: {
        global: "500 requests per 15 minutes",
        auth: "10 requests per minute",
        orders: "20 requests per minute",
        reviews: {
          create: "5 per hour (authenticated), 2 per day (guest)",
          vote: "50 per hour",
          report: "10 per hour",
          read: "100 per 15 minutes",
        },
        wishlist: {
          standard: "20 per 15 minutes",
          bulk: "5 per hour",
          sharing: "3 per hour",
        },
        search: {
          standard: "100 per 15 minutes",
          autocomplete: "300 per 15 minutes",
          advanced: "30 per hour",
        },
        admin: "100 moderation actions per hour",
        notifications: {
          general: "100 requests per 15 minutes",
          admin: "200 requests per 15 minutes",
          bulk: "10 bulk operations per hour",
          markRead: "50 mark as read per minute",
        },
      },
      features: {
        websocket: "Real-time notifications enabled",
        email: "Email notifications enabled",
        templates: "Customizable notification templates",
        scheduling: "Scheduled notifications support",
        preferences: "User notification preferences",
      },
    },
  });
});

//=====================================================
//================== ERROR HANDLERS ==================
//=====================================================

// 404 - PAGINA NON TROVATA
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      "GET /api/health",
      "GET /api/info",
      "GET /api/test-db",
      "POST /api/auth/login",
      "GET /api/products",
      "GET /api/reviews",
      "GET /api/notifications",
    ],
  });
});

// GLOBAL ERROR HANDLER
app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error:", error);

    // RATE LIMITING ERRORS
    if (error instanceof Error && error.message.includes("Too many requests")) {
      return res.status(429).json({
        success: false,
        error: "Rate limit exceeded",
        message: "Please try again later",
        retryAfter: "15 minutes",
      });
    }

    // PRISMA ERRORS
    if (error instanceof Error && error.name?.includes("Prisma")) {
      return res.status(500).json({
        success: false,
        error: "Database error",
        message:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Database operation failed",
      });
    }

    // VALIDATION ERRORS
    if (
      error instanceof Error &&
      (error.message.includes("validation") ||
        error.message.includes("Invalid"))
    ) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: error.message,
      });
    }

    // CUSTOM ERROR HANDLING
    let status = 500;
    let message = "Internal server error";

    if (error instanceof Error) {
      message =
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong";

      // CHECK FOR CUSTOM STATUS
      if ("status" in error && typeof error.status === "number") {
        status = error.status;
      }
    }

    res.status(status).json({
      success: false,
      error: "Internal server error",
      message,
      ...(process.env.NODE_ENV === "development" && {
        stack: error instanceof Error ? error.stack : undefined,
      }),
    });
  }
);

//=====================================================
//================== SERVER STARTUP ===================
//=====================================================

httpServer.listen(PORT, () => {
  console.log(`
🚀 Digital Store Backend started!
📡 Server: http://localhost:${PORT}
🧪 Health: http://localhost:${PORT}/api/health  
📋 API Info: http://localhost:${PORT}/api/info
🗃️  Database: http://localhost:${PORT}/api/test-db
📊 Prisma Studio: http://localhost:5555

🔐 Security Features:
  ✅ Rate limiting enabled
  ✅ Input sanitization active
  ✅ CORS configured
  ✅ Helmet security headers
  🔔 WebSocket notifications enabled
  📧 Email notifications ready

📝 API Endpoints:
  🌍 Public: /api/products, /api/reviews, /api/auth
  🔒 Protected: /api/user, /api/orders, /api/notifications
  👑 Admin: /api/admin/*, /api/notifications/admin/*

🔔 Notification Features:
  📡 Real-time WebSocket notifications
  📧 Email notifications with templates
  ⚙️  User preferences management
  📊 Admin statistics and monitoring
  ⏰ Scheduled notifications support

⏰ Started: ${new Date().toLocaleString("it-IT")}
🌍 Environment: ${process.env.NODE_ENV || "development"}
  `);
});

// GRACEFUL SHUTDOWN
process.on("SIGINT", async () => {
  console.log("\n🛑 Graceful shutdown initiated...");

  try {
    await prisma.$disconnect();
    console.log("✅ Database disconnected");
  } catch (error) {
    console.error("❌ Error disconnecting database:", error);
  }

  console.log("👋 Server stopped");
  process.exit(0);
});

// HANDLE UNHANDLED REJECTIONS
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// HANDLE UNCAUGHT EXCEPTIONS
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

export default app;
