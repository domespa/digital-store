import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { PrismaClient } from "../generated/prisma";
import { createSupportRoutes } from "../controllers/supportController";
import { SupportService } from "../services/supportService";
import NotificationService from "../services/notificationService";
import EmailService from "../services/emailService";
import WebSocketService from "../services/websocketService";
import { FileUploadService } from "../services/uploadService";
import { SupportAnalyticsService } from "../services/supportAnalyticsService";
import { RealTimeAnalyticsService } from "../services/realtimeAnalyticsService";

// ===========================================
//            INTERFACES
// ===========================================

interface ExistingServices {
  notificationService?: NotificationService;
  emailService?: EmailService;
  websocketService?: WebSocketService;
  uploadService?: FileUploadService;
}

interface SupportSetupOptions {
  enableAnalytics?: boolean;
  enableAgentManagement?: boolean;
  rateLimitConfig?: {
    ticketCreation?: {
      windowMs: number;
      max: number;
    };
    messaging?: {
      windowMs: number;
      max: number;
    };
  };
}

// ===========================================
//            RATE LIMITERS
// ===========================================

const createSupportRateLimiters = (
  config?: SupportSetupOptions["rateLimitConfig"]
) => {
  const ticketCreationLimiter = rateLimit({
    windowMs: config?.ticketCreation?.windowMs || 60 * 60 * 1000, // 1 ora default
    max: config?.ticketCreation?.max || 5, // 5 ticket/ora default
    keyGenerator: (req: any) => req.user?.id || req.ip,
    message: {
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many support tickets created. Please try again later.",
      retryAfter: Math.ceil(
        (config?.ticketCreation?.windowMs || 3600000) / 1000
      ),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const messagingLimiter = rateLimit({
    windowMs: config?.messaging?.windowMs || 5 * 60 * 1000, // 5 minuti default
    max: config?.messaging?.max || 20, // 20 messaggi/5min default
    keyGenerator: (req: any) => req.user?.id || req.ip,
    message: {
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many messages sent. Please slow down.",
      retryAfter: Math.ceil((config?.messaging?.windowMs || 300000) / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  return { ticketCreationLimiter, messagingLimiter };
};

// ===========================================
//            SERVICE FACTORY
// ===========================================

class SupportServiceFactory {
  private static validateRequiredServices(
    prisma: PrismaClient,
    services: ExistingServices
  ): void {
    if (!prisma) {
      throw new Error("PrismaClient is required for Support System");
    }

    // WebSocketService è critico per il sistema di support real-time
    if (!services.websocketService) {
      throw new Error(
        "WebSocketService is required for Support System. " +
          "Please provide an existing WebSocketService instance."
      );
    }
  }

  static createSupportService(
    prisma: PrismaClient,
    existingServices: ExistingServices = {}
  ): SupportService {
    this.validateRequiredServices(prisma, existingServices);

    // Inizializza servizi mancanti con configurazione production-ready
    const emailService = existingServices.emailService || new EmailService();
    const uploadService =
      existingServices.uploadService || new FileUploadService();
    const websocketService = existingServices.websocketService!; // Validato sopra

    // NotificationService richiede Prisma - assicurati che sia compatibile
    const notificationService =
      existingServices.notificationService ||
      new NotificationService(websocketService, emailService);

    return new SupportService(
      prisma,
      notificationService,
      emailService,
      websocketService,
      uploadService
    );
  }
}

// ===========================================
//          HEALTH CHECK ENDPOINT
// ===========================================

const createHealthCheckRoute = (prisma: PrismaClient): Router => {
  const router = Router();

  router.get("/health", async (req, res) => {
    try {
      // Test database connectivity
      await prisma.$queryRaw`SELECT 1`;

      // Test support configuration
      const configCount = await prisma.supportConfig.count();

      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          support: "configured",
          configCount,
        },
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
};

// ===========================================
//         MAIN SETUP FUNCTION
// ===========================================

export function setupSupportRoutes(
  prisma: PrismaClient,
  existingServices: ExistingServices = {},
  options: SupportSetupOptions = {}
): Router {
  try {
    // Crea il router principale
    const router = Router();

    // Crea rate limiters
    const { ticketCreationLimiter, messagingLimiter } =
      createSupportRateLimiters(options.rateLimitConfig);

    // Crea il SupportService usando la factory
    const supportService = SupportServiceFactory.createSupportService(
      prisma,
      existingServices
    );

    // ANALITYCS SERVICE
    let analyticsService;
    let realTimeAnalyticsService;

    if (options.enableAnalytics) {
      analyticsService = new SupportAnalyticsService(prisma);
      if (existingServices.websocketService) {
        realTimeAnalyticsService = new RealTimeAnalyticsService(
          prisma,
          analyticsService,
          existingServices.websocketService
        );
      }
      console.log("✅ Analytics service enabled with real-time support");
    }

    if (options.enableAgentManagement) {
      // PROSSIMAMENTE
      console.warn("Agent management service not yet implemented");
    }

    if (analyticsService) {
      const analyticsRoutes = createAnalyticsRoutes(
        analyticsService,
        realTimeAnalyticsService
      );
      router.use("/support/analytics", analyticsRoutes);
    }

    // Aggiungi health check
    router.use("/support", createHealthCheckRoute(prisma));

    // Crea le routes principali del support
    const supportRoutes = createSupportRoutes(
      supportService,
      analyticsService
      // agentService
    );

    // Applica rate limiting specifico alle routes critiche
    router.use("/support/tickets", ticketCreationLimiter);
    router.use("/support/tickets/*/messages", messagingLimiter);

    // Monta le routes del support
    router.use("/support", supportRoutes);

    // Log successful initialization
    console.log("Support System initialized successfully", {
      features: {
        analytics: !!analyticsService,
        // agentManagement: !!agentService,
        rateLimiting: true,
        healthCheck: true,
      },
    });

    return router;
  } catch (error) {
    console.error("Failed to initialize Support System:", error);
    throw new Error(
      `Support System initialization failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// ===========================================
//        ENHANCED SETUP FUNCTION
// ===========================================

const createHealthCheckWithAnalytics = (
  prisma: PrismaClient,
  analyticsService?: SupportAnalyticsService
): Router => {
  const router = Router();

  router.get("/health", async (req, res) => {
    try {
      // Database test
      await prisma.$queryRaw`SELECT 1`;

      // Support config test
      const configCount = await prisma.supportConfig.count();

      // Analytics test (se abilitato)
      let analyticsStatus = "disabled";
      let analyticsHealth = {};

      if (analyticsService) {
        try {
          // Test basic analytics functionality
          await analyticsService.testAnalytics();
          analyticsStatus = "healthy";

          // Get analytics health metrics
          analyticsHealth = {
            aggregationStatus: "running",
            lastHourlyUpdate: new Date(),
            recordCount: await prisma.supportAnalytics.count(),
          };
        } catch (error) {
          analyticsStatus = "degraded";
          analyticsHealth = { error: "Analytics test failed" };
        }
      }

      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          support: "configured",
          analytics: analyticsStatus,
          configCount,
          ...analyticsHealth,
        },
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
};

export function setupSupportRoutesAdvanced(
  prisma: PrismaClient,
  existingServices: ExistingServices,
  options: SupportSetupOptions & {
    basePath?: string;
    enableMetrics?: boolean;
    customMiddleware?: Array<(req: any, res: any, next: any) => void>;
  } = {}
): Router {
  const router = Router();
  const basePath = options.basePath || "/support";

  // Applica middleware personalizzato se fornito
  if (options.customMiddleware?.length) {
    options.customMiddleware.forEach((middleware) => {
      router.use(basePath, middleware);
    });
  }

  // Setup standard
  const supportRouter = setupSupportRoutes(prisma, existingServices, options);

  // Metrics endpoint (se abilitato)
  if (options.enableMetrics) {
    router.get(`${basePath}/metrics`, async (req, res) => {
      try {
        const metrics = await prisma.supportTicket.groupBy({
          by: ["status"],
          _count: { status: true },
        });

        res.json({
          timestamp: new Date().toISOString(),
          tickets: metrics.reduce((acc, item) => {
            acc[item.status] = item._count.status;
            return acc;
          }, {} as Record<string, number>),
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch metrics" });
      }
    });
  }

  // Monta il router del support
  router.use(supportRouter);

  return router;
}
// ===========================================
//          DEDICATED ANALYTICS ROUTES
// ===========================================

const createAnalyticsRoutes = (
  analyticsService: SupportAnalyticsService,
  realTimeService?: RealTimeAnalyticsService
): Router => {
  const router = Router();

  // Dashboard endpoint
  router.get("/dashboard", async (req, res) => {
    try {
      const { businessModel, tenantId, from, to } = req.query;

      const dateRange = {
        from: new Date(from as string),
        to: new Date(to as string),
      };

      if (realTimeService) {
        const dashboard = await realTimeService.getDashboard(
          businessModel as any,
          tenantId as string,
          dateRange
        );
        res.json({ success: true, data: dashboard });
      } else {
        const overview = await analyticsService.getOverview(
          businessModel as any,
          tenantId as string,
          dateRange
        );
        res.json({ success: true, data: overview });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Analytics error",
      });
    }
  });

  // Real-time metrics endpoint
  if (realTimeService) {
    router.get("/realtime", async (req, res) => {
      try {
        const { businessModel, tenantId } = req.query;

        const metrics = await realTimeService.getCurrentMetrics(
          businessModel as any,
          tenantId as string
        );

        res.json({ success: true, data: metrics });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Real-time error",
        });
      }
    });

    // WebSocket subscription endpoint
    router.post("/subscribe", async (req, res) => {
      try {
        const { userId, businessModel, tenantId } = req.body;

        await realTimeService.subscribeToAnalytics(
          userId,
          businessModel,
          tenantId
        );

        res.json({ success: true, message: "Subscribed to analytics updates" });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Subscription error",
        });
      }
    });
  }

  // Custom reports endpoint
  router.post("/reports", async (req, res) => {
    try {
      const { config, businessModel, tenantId } = req.body;

      const report = await analyticsService.generateCustomReport(
        config,
        businessModel,
        tenantId
      );

      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Report generation error",
      });
    }
  });

  // Export endpoint
  router.get("/export", async (req, res) => {
    try {
      const { format, filename, data } = req.query;

      const exportResult = await analyticsService.exportAnalytics(
        format as any,
        JSON.parse(data as string),
        filename as string
      );

      res.setHeader("Content-Type", exportResult.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.filename}"`
      );
      res.send(exportResult.data);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Export error",
      });
    }
  });

  return router;
};

// ===========================================
//              EXPORTS
// ===========================================

export default setupSupportRoutes;

// Export anche le utilities
export {
  SupportServiceFactory,
  createSupportRateLimiters,
  createHealthCheckRoute,
};

// Export types per TypeScript
export type { ExistingServices, SupportSetupOptions };
