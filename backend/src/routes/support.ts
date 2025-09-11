import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { PrismaClient } from "../generated/prisma";
import { createSupportRoutes } from "../controllers/supportController";
import { SupportService } from "../services/supportService";
import NotificationService from "../services/notificationService";
import EmailService from "../services/emailService";
import WebSocketService from "../services/websocketService";
import { FileUploadService } from "../services/uploadService";

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

    // Servizi opzionali (da implementare in futuro)
    let analyticsService;
    let agentService;

    if (options.enableAnalytics) {
      // const { SupportAnalyticsService } = await import('../services/supportAnalyticsService');
      // analyticsService = new SupportAnalyticsService(prisma);
      console.warn("Analytics service not yet implemented");
    }

    if (options.enableAgentManagement) {
      // const { SupportAgentService } = await import('../services/supportAgentService');
      // agentService = new SupportAgentService(prisma);
      console.warn("Agent management service not yet implemented");
    }

    // Aggiungi health check
    router.use("/support", createHealthCheckRoute(prisma));

    // Crea le routes principali del support
    const supportRoutes = createSupportRoutes(
      supportService,
      analyticsService,
      agentService
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
        agentManagement: !!agentService,
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
