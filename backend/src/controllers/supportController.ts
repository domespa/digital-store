import { Request, Response, NextFunction } from "express";
import { PrismaClient, BusinessModel, UserRole } from "../generated/prisma";
import {
  CreateTicketRequest,
  UpdateTicketRequest,
  CreateMessageRequest,
  EscalateTicketRequest,
  TicketSearchFilters,
  TicketSortOptions,
  PaginationOptions,
  SubmitSatisfactionRequest,
  ApiResponse,
  SupportErrorCodes,
  SupportConfig,
  TicketResponse,
  TicketListResponse,
  SupportAgentResponse,
  CreateAgentRequest,
  UpdateAgentRequest,
  SupportAnalyticsResponse,
  AnalyticsFilters,
} from "../types/support";
import { UserProfile } from "../types/auth";
import { SupportService } from "../services/supportService";
import { handleValidationErrors } from "../middleware/validation";
import { authenticateToken } from "../middleware/auth";
import { generalLimiter } from "../middleware/rateLimiting";
import { Router } from "express";
import multer from "multer";

// ===========================================
//              INTERFACES
// ===========================================

interface DateRange {
  from: Date;
  to: Date;
}

interface AnalyticsOverview {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionRating: number;
  slaCompliance: number;
}

interface TrendData {
  date: string;
  tickets: number;
  resolved: number;
  satisfaction: number;
}

interface PerformanceMetrics {
  agentId: string;
  agentName: string;
  ticketsAssigned: number;
  ticketsResolved: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionRating: number;
  slaCompliance: number;
}

interface SupportAnalyticsService {
  getOverview(
    businessModel: BusinessModel,
    tenantId: string,
    dateRange: DateRange
  ): Promise<AnalyticsOverview>;

  getTrends(
    businessModel: BusinessModel,
    tenantId: string,
    period: "day" | "week" | "month",
    dateRange: DateRange
  ): Promise<TrendData[]>;

  getPerformanceMetrics(
    businessModel: BusinessModel,
    tenantId: string,
    agentId: string,
    dateRange: DateRange
  ): Promise<PerformanceMetrics>;
}

interface SupportAgentService {
  getAgents(
    businessModel: BusinessModel,
    tenantId: string,
    category?: string
  ): Promise<SupportAgentResponse[]>;

  createAgent(
    agentData: CreateAgentRequest,
    creatorId: string
  ): Promise<SupportAgentResponse>;

  updateAgent(
    agentId: string,
    updateData: UpdateAgentRequest,
    updaterId: string
  ): Promise<SupportAgentResponse>;

  updateAvailability(
    agentId: string,
    isAvailable: boolean,
    userId: string
  ): Promise<void>;
}

interface AuthenticatedRequest extends Request {
  user: UserProfile & {
    emailVerified: boolean;
    businessModel?: BusinessModel;
    tenantId?: string;
  };
  requestId?: string;
}

// ===========================================
//               CONSTANTS
// ===========================================

const StatusCodes = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// ===========================================
//              MIDDLEWARE
// ===========================================

const checkPermissions = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
};

// ===========================================
//            SUPPORT CONTROLLER
// ===========================================

export class SupportController {
  constructor(
    private supportService: SupportService,
    private analyticsService?: SupportAnalyticsService,
    private agentService?: SupportAgentService
  ) {}

  // ===========================================
  //              HELPER METHODS
  // ===========================================

  private createApiResponse = (
    authReq: AuthenticatedRequest,
    data: unknown
  ): ApiResponse => {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date(),
        requestId: authReq.requestId || "",
      },
    };
  };

  private isValidSortField = (
    field: string
  ): field is TicketSortOptions["field"] => {
    const validFields: TicketSortOptions["field"][] = [
      "createdAt",
      "updatedAt",
      "priority",
      "status",
      "lastResponseAt",
    ];
    return validFields.includes(field as TicketSortOptions["field"]);
  };

  // ===========================================
  //            TICKET ENDPOINTS
  // ===========================================

  createTicket = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const businessModel =
        authReq.user.businessModel || BusinessModel.B2B_SALE;
      const tenantId = authReq.user.tenantId || null;

      const ticketData: CreateTicketRequest = {
        subject: req.body.subject,
        description: req.body.description,
        category: req.body.category,
        priority: req.body.priority,
        orderId: req.body.orderId,
        productId: req.body.productId,
        attachments: req.files as Express.Multer.File[],
        metadata: req.body.metadata,
      };

      const ticket = await this.supportService.createTicket(
        userId,
        ticketData,
        businessModel,
        tenantId
      );

      const response = this.createApiResponse(authReq, ticket);
      res.status(StatusCodes.CREATED).json(response);
    } catch (error) {
      next(error);
    }
  };

  getTickets = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      // PARSE FILTERS CON TYPING CORRETTO
      const filters: TicketSearchFilters = {
        status: req.query.status
          ? JSON.parse(req.query.status as string)
          : undefined,
        priority: req.query.priority
          ? JSON.parse(req.query.priority as string)
          : undefined,
        category: req.query.category
          ? JSON.parse(req.query.category as string)
          : undefined,
        assignedTo: req.query.assignedTo
          ? JSON.parse(req.query.assignedTo as string)
          : undefined,
        user: req.query.user as string,
        businessModel: req.query.businessModel as BusinessModel,
        tenantId: req.query.tenantId as string,
        createdFrom: req.query.createdFrom
          ? new Date(req.query.createdFrom as string)
          : undefined,
        createdTo: req.query.createdTo
          ? new Date(req.query.createdTo as string)
          : undefined,
        updatedFrom: req.query.updatedFrom
          ? new Date(req.query.updatedFrom as string)
          : undefined,
        updatedTo: req.query.updatedTo
          ? new Date(req.query.updatedTo as string)
          : undefined,
        search: req.query.search as string,
        tags: req.query.tags ? JSON.parse(req.query.tags as string) : undefined,
        slaBreached: req.query.slaBreached === "true",
        overdueOnly: req.query.overdueOnly === "true",
        orderId: req.query.orderId as string,
        productId: req.query.productId as string,
      };

      // PARSE SORTING CON VALIDAZIONE
      const sortField = (req.query.sortField as string) || "createdAt";
      const sorting: TicketSortOptions = {
        field: this.isValidSortField(sortField) ? sortField : "createdAt",
        direction: (req.query.sortDirection as "asc" | "desc") || "desc",
      };

      // PARSE PAGINATION
      const pagination: PaginationOptions = {
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
      };

      const result = await this.supportService.getTickets(
        userId,
        filters,
        sorting,
        pagination
      );

      const response = this.createApiResponse(authReq, result);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  getTicketById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ticketId = req.params.id;
      const userId = authReq.user.id;

      const ticket = await this.supportService.getTicketById(ticketId, userId);
      const response = this.createApiResponse(authReq, ticket);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  updateTicket = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ticketId = req.params.id;
      const userId = authReq.user.id;
      const updateData: UpdateTicketRequest = req.body;

      const ticket = await this.supportService.updateTicket(
        ticketId,
        updateData,
        userId
      );

      const response = this.createApiResponse(authReq, ticket);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteTicket = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ticketId = req.params.id;
      const userId = authReq.user.id;

      await this.supportService.deleteTicket(ticketId, userId);
      const response = this.createApiResponse(authReq, { deleted: true });
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  // ===========================================
  //           MESSAGE ENDPOINTS
  // ===========================================

  addMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ticketId = req.params.id;
      const userId = authReq.user.id;

      const messageData: CreateMessageRequest = {
        content: req.body.content,
        isInternal: req.body.isInternal,
        attachments: req.files as Express.Multer.File[],
      };

      await this.supportService.addMessage(ticketId, userId, messageData);
      const response = this.createApiResponse(authReq, {
        message: "Message added successfully",
      });
      res.status(StatusCodes.CREATED).json(response);
    } catch (error) {
      next(error);
    }
  };

  getTicketMessages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ticketId = req.params.id;
      const userId = authReq.user.id;
      const includeInternal = req.query.includeInternal === "true";

      const messages = await this.supportService.getTicketMessages(
        ticketId,
        userId,
        includeInternal
      );

      const response = this.createApiResponse(authReq, messages);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  markMessageAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const messageId = req.params.id;
      const userId = authReq.user.id;

      await this.supportService.markMessageAsRead(messageId, userId);
      const response = this.createApiResponse(authReq, { read: true });
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  // ===========================================
  //      ASSIGNMENT & ESCALATION ENDPOINTS
  // ===========================================

  assignTicket = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ticketId = req.params.id;
      const assigneeId = req.body.assigneeId;
      const assignerId = authReq.user.id;

      const ticket = await this.supportService.assignTicket(
        ticketId,
        assigneeId,
        assignerId
      );

      const response = this.createApiResponse(authReq, ticket);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  escalateTicket = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ticketId = req.params.id;
      const userId = authReq.user.id;

      const escalationData: EscalateTicketRequest = {
        reason: req.body.reason,
        escalateTo: req.body.escalateTo,
        priority: req.body.priority,
        addMessage: req.body.addMessage,
      };

      const ticket = await this.supportService.escalateTicket(
        ticketId,
        userId,
        escalationData
      );

      const response = this.createApiResponse(authReq, ticket);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  // ===========================================
  //         SATISFACTION ENDPOINTS
  // ===========================================

  submitSatisfaction = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const ticketId = req.params.id;
      const userId = authReq.user.id;

      const satisfactionData: SubmitSatisfactionRequest = {
        rating: req.body.rating,
        feedback: req.body.feedback,
        detailedRatings: req.body.detailedRatings,
      };

      await this.supportService.submitSatisfaction(
        ticketId,
        userId,
        satisfactionData
      );

      const response = this.createApiResponse(authReq, {
        message: "Satisfaction submitted successfully",
      });
      res.status(StatusCodes.CREATED).json(response);
    } catch (error) {
      next(error);
    }
  };

  // ===========================================
  //       AGENT MANAGEMENT ENDPOINTS
  // ===========================================

  getAgents = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.agentService) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: "Agent service not available",
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const businessModel = req.query.businessModel as BusinessModel;
      const tenantId = req.query.tenantId as string;
      const category = req.query.category as string;

      const agents = await this.agentService.getAgents(
        businessModel,
        tenantId,
        category
      );

      const response = this.createApiResponse(authReq, agents);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  createAgent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.agentService) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: "Agent service not available",
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const agentData: CreateAgentRequest = req.body;
      const creatorId = authReq.user.id;

      const agent = await this.agentService.createAgent(agentData, creatorId);
      const response = this.createApiResponse(authReq, agent);
      res.status(StatusCodes.CREATED).json(response);
    } catch (error) {
      next(error);
    }
  };

  updateAgent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.agentService) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: "Agent service not available",
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const agentId = req.params.id;
      const updateData: UpdateAgentRequest = req.body;
      const updaterId = authReq.user.id;

      const agent = await this.agentService.updateAgent(
        agentId,
        updateData,
        updaterId
      );

      const response = this.createApiResponse(authReq, agent);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  updateAgentAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.agentService) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: "Agent service not available",
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const agentId = req.params.id;
      const isAvailable = req.body.isAvailable;
      const userId = authReq.user.id;

      await this.agentService.updateAvailability(agentId, isAvailable, userId);
      const response = this.createApiResponse(authReq, { isAvailable });
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  // ===========================================
  //          ANALYTICS ENDPOINTS
  // ===========================================

  getAnalyticsOverview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.analyticsService) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: "Analytics service not available",
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const businessModel = req.query.businessModel as BusinessModel;
      const tenantId = req.query.tenantId as string;
      const dateRange: DateRange = {
        from: new Date(req.query.from as string),
        to: new Date(req.query.to as string),
      };

      const analytics = await this.analyticsService.getOverview(
        businessModel,
        tenantId,
        dateRange
      );

      const response = this.createApiResponse(authReq, analytics);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  getTrends = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.analyticsService) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: "Analytics service not available",
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const businessModel = req.query.businessModel as BusinessModel;
      const tenantId = req.query.tenantId as string;
      const period = req.query.period as "day" | "week" | "month";
      const dateRange: DateRange = {
        from: new Date(req.query.from as string),
        to: new Date(req.query.to as string),
      };

      const trends = await this.analyticsService.getTrends(
        businessModel,
        tenantId,
        period,
        dateRange
      );

      const response = this.createApiResponse(authReq, trends);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  getPerformanceMetrics = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.analyticsService) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: "Analytics service not available",
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const businessModel = req.query.businessModel as BusinessModel;
      const tenantId = req.query.tenantId as string;
      const agentId = req.query.agentId as string;
      const dateRange: DateRange = {
        from: new Date(req.query.from as string),
        to: new Date(req.query.to as string),
      };

      const metrics = await this.analyticsService.getPerformanceMetrics(
        businessModel,
        tenantId,
        agentId,
        dateRange
      );

      const response = this.createApiResponse(authReq, metrics);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  // ===========================================
  //        CONFIGURATION ENDPOINTS
  // ===========================================

  getConfig = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const businessModel = req.query.businessModel as BusinessModel;
      const tenantId = req.query.tenantId as string;

      const config = await this.supportService.getBusinessModelConfig(
        businessModel,
        tenantId
      );

      const response = this.createApiResponse(authReq, config);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  updateConfig = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const businessModel = req.body.businessModel as BusinessModel;
      const tenantId = req.body.tenantId as string;
      const configData = req.body;

      const config = await this.supportService.updateConfig(
        businessModel,
        tenantId,
        configData
      );

      const response = this.createApiResponse(authReq, config);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  // ===========================================
  //           UTILITY ENDPOINTS
  // ===========================================

  searchTickets = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = req.query.q as string;
      const userId = authReq.user.id;
      const filters = req.query.filters
        ? JSON.parse(req.query.filters as string)
        : {};

      const results = await this.supportService.searchTickets(
        query,
        userId,
        filters
      );

      const response = this.createApiResponse(authReq, results);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  getUserStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      const stats = await this.supportService.getUserStats(userId);
      const response = this.createApiResponse(authReq, stats);
      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  // ===========================================
  //           EXPORT ENDPOINTS
  // ===========================================

  exportTickets = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const format = req.query.format as "csv" | "excel";
      const filters = req.query.filters
        ? JSON.parse(req.query.filters as string)
        : {};
      const userId = authReq.user.id;

      const exportResult = await this.supportService.exportTickets(
        format,
        filters,
        userId
      );

      res.setHeader("Content-Type", exportResult.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.filename}"`
      );
      res.send(exportResult.data);
    } catch (error) {
      next(error);
    }
  };
}

// ===========================================
//            MULTER CONFIGURATION
// ===========================================

const upload = multer({
  dest: "uploads/temp",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,
  },
});

// ===========================================
//           ROUTE DEFINITIONS
// ===========================================

export function createSupportRoutes(
  supportService: SupportService,
  analyticsService?: SupportAnalyticsService,
  agentService?: SupportAgentService
): Router {
  const router = Router();
  const controller = new SupportController(
    supportService,
    analyticsService,
    agentService
  );

  // APPLY GLOBAL MIDDLEWARE
  router.use(authenticateToken);
  router.use(generalLimiter);

  // TICKET ROUTES
  router.post(
    "/tickets",
    upload.array("attachments", 5),
    handleValidationErrors,
    controller.createTicket
  );

  router.get("/tickets", controller.getTickets);
  router.get("/tickets/:id", controller.getTicketById);
  router.put("/tickets/:id", handleValidationErrors, controller.updateTicket);
  router.delete(
    "/tickets/:id",
    checkPermissions([UserRole.ADMIN]),
    controller.deleteTicket
  );

  // MESSAGE ROUTES
  router.post(
    "/tickets/:id/messages",
    upload.array("attachments", 3),
    handleValidationErrors,
    controller.addMessage
  );
  router.get("/tickets/:id/messages", controller.getTicketMessages);
  router.put("/messages/:id/read", controller.markMessageAsRead);

  // ASSIGNMENT & ESCALATION ROUTES
  router.put(
    "/tickets/:id/assign",
    checkPermissions([UserRole.ADMIN]),
    handleValidationErrors,
    controller.assignTicket
  );
  router.put(
    "/tickets/:id/escalate",
    checkPermissions([UserRole.ADMIN]),
    handleValidationErrors,
    controller.escalateTicket
  );

  // SATISFACTION ROUTES
  router.post(
    "/tickets/:id/satisfaction",
    handleValidationErrors,
    controller.submitSatisfaction
  );

  // AGENT MANAGEMENT ROUTES (SOLO SE IL SERVIZIO È DISPONIBILE)
  if (agentService) {
    router.get(
      "/agents",
      checkPermissions([UserRole.ADMIN]),
      controller.getAgents
    );
    router.post(
      "/agents",
      checkPermissions([UserRole.ADMIN]),
      handleValidationErrors,
      controller.createAgent
    );
    router.put(
      "/agents/:id",
      checkPermissions([UserRole.ADMIN]),
      handleValidationErrors,
      controller.updateAgent
    );
    router.put("/agents/:id/availability", controller.updateAgentAvailability);
  }

  // ANALYTICS ROUTES (SOLO SE IL SERVIZIO È DISPONIBILE)
  if (analyticsService) {
    router.get(
      "/analytics/overview",
      checkPermissions([UserRole.ADMIN]),
      controller.getAnalyticsOverview
    );
    router.get(
      "/analytics/trends",
      checkPermissions([UserRole.ADMIN]),
      controller.getTrends
    );
    router.get(
      "/analytics/performance",
      checkPermissions([UserRole.ADMIN]),
      controller.getPerformanceMetrics
    );
  }

  // CONFIGURATION ROUTES
  router.get(
    "/config",
    checkPermissions([UserRole.ADMIN]),
    controller.getConfig
  );
  router.put(
    "/config",
    checkPermissions([UserRole.ADMIN]),
    handleValidationErrors,
    controller.updateConfig
  );

  // UTILITY ROUTES
  router.get("/search", controller.searchTickets);
  router.get("/stats", controller.getUserStats);

  // EXPORT ROUTES
  router.get(
    "/export/tickets",
    checkPermissions([UserRole.ADMIN]),
    controller.exportTickets
  );

  return router;
}
