import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
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

// CARICHIAMO LE VARIABILI DI AMBIENTE
dotenv.config();

// INIT PRISMA
const prisma = new PrismaClient();

// CREO APP EXPRESS
const app = express();
const PORT = process.env.PORT || 3001;

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

//=====================================================
// ================ ROUTE AUTENTICATE =================
//=====================================================

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

//=====================================================
// ==================== DATABASE TEST =================
//=====================================================

app.get("/api/test-db", async (req, res) => {
  try {
    const [userCount, productCount, orderCount, reviewCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.product.count(),
        prisma.order.count(),
        prisma.review.count(),
      ]);

    res.json({
      status: "Database collegato",
      tables: {
        users: userCount,
        products: productCount,
        orders: orderCount,
        reviews: reviewCount,
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
        ],
        admin: [
          "GET /api/admin/*",
          "GET /api/reviews/admin/pending",
          "PUT /api/reviews/admin/:id",
          "DELETE /api/reviews/admin/:id",
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
        admin: "100 moderation actions per hour",
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

app.listen(PORT, () => {
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

📝 API Endpoints:
  🌍 Public: /api/products, /api/reviews, /api/auth
  🔒 Protected: /api/user, /api/orders
  👑 Admin: /api/admin/*

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
