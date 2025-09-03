import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { PrismaClient } from "./generated/prisma";

// IMPORT ROTTE
import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import orderRoutes from "./routes/order";
import userRoutes from "./routes/user";
import adminRoutes from "./routes/admin";
import webhookRoutes from "./routes/webhook";

// CARICHIAMO LE VARIABILI DI AMBIENTE
dotenv.config();

// INIT PRISMA
const prisma = new PrismaClient();

// CREO APP EXPRESS
const app = express();
const PORT = process.env.PORT || 3001;

// MIDDLEWARE CON ELMET
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  })
);

app.use("/api/stripe", webhookRoutes);

// PARSIAMO I DATI
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// TESTROTTA
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "backend connesso correttamente",
    timestamp: new Date().toISOString(),
    readable: new Date().toLocaleString("it-IT"),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes); // ADMIN

// TEST CONNESSIONE PRIMA
app.get("/api/test-db", async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    const productCount = await prisma.product.count();

    res.json({
      status: "Database collegato",
      tables: {
        users: userCount,
        products: productCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Errore nella connessione del DB:", error);
    res.status(500).json({
      status: "connessione db non riuscita",
      error: error instanceof Error ? error.message : " errore sconosciuto",
    });
  }
});

// PAGINA NON TROVATA
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Page not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// ERRORI GLOBALI
app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error:", error);

    let status = 500;
    let message = "Something went wrong";

    if (error instanceof Error) {
      message =
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong";

      if ("status" in error && typeof error.status === "number") {
        status = error.status;
      }
    }
    res.status(status).json({
      error: "Internal Error",
      message,
    });
  }
);

// AVVIO SERVER
app.listen(PORT, () => {
  console.log(`
    🚀 Digital Store Backend started!
    📡 Server: http://localhost:${PORT}
    🧪 Health: http://localhost:${PORT}/api/health  
    🗃️  Database: http://localhost:${PORT}/api/test-db
    📊 Prisma Studio: http://localhost:5555
    ⏰ Started at: ${new Date().toLocaleString()}
  `);
});

// SPENGO IL SERVER
process.on("SIGINT", async () => {
  console.log("Sto spegnendo...");
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
