import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../generated/prisma";
import { catchAsync } from "../utils/catchAsync";
import { CustomError } from "../utils/customError";
import NotificationService from "../services/notificationService";
import {
  NotificationCategory,
  NotificationType,
  NotificationPriority,
  PaginationParams,
} from "../types/notifications";
import { z } from "zod";

// ===========================================
//                CONSTANTS
// ===========================================
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ADMIN_DEFAULT_PAGE_SIZE = 50;

// ===========================================
//                  TYPES
// ===========================================
interface AuthenticatedRequest extends Omit<Request, "user"> {
  user: {
    // Required now instead of optional
    id: string;
    role: string;
    email: string;
  };
}

interface QueryFilters {
  page?: string;
  limit?: string;
  unreadOnly?: string;
  category?: string;
  type?: string;
  userId?: string;
  priority?: string;
  isRead?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface AdminNotificationFilters extends QueryFilters {
  // Admin-specific filters can be added here
}

// ===========================================
//            VALIDATION SCHEMAS
// ===========================================
const createNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.nativeEnum(NotificationType),
  category: z.nativeEnum(NotificationCategory),
  priority: z.nativeEnum(NotificationPriority).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  actionUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
  scheduledFor: z.string().datetime().optional(),
  orderId: z.string().optional(),
  productId: z.string().optional(),
  reviewId: z.string().optional(),
});

const updatePreferencesSchema = z.object({
  enableWebSocket: z.boolean().optional(),
  enableEmail: z.boolean().optional(),
  enablePush: z.boolean().optional(),
  orderUpdates: z.boolean().optional(),
  paymentAlerts: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
  reviewNotifications: z.boolean().optional(),
  promotions: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  inventoryAlerts: z.boolean().optional(),
  quietHours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string(),
    })
    .optional(),
  instantDelivery: z.boolean().optional(),
  batchDelivery: z.boolean().optional(),
});

const bulkNotificationSchema = z.object({
  userIds: z.array(z.string()).min(1).max(1000),
  notification: createNotificationSchema.omit({
    orderId: true,
    productId: true,
    reviewId: true,
  }),
});

const templateSchema = z.object({
  type: z.nativeEnum(NotificationType),
  category: z.nativeEnum(NotificationCategory),
  websocketTitle: z.string().min(1).max(200),
  websocketMessage: z.string().min(1).max(1000),
  emailSubject: z.string().max(200).optional(),
  emailTemplate: z.string().optional(),
  pushTitle: z.string().max(100).optional(),
  pushMessage: z.string().max(200).optional(),
  priority: z.nativeEnum(NotificationPriority),
  requiresAction: z.boolean().default(false),
  autoExpire: z.boolean().default(false),
  expirationHours: z.number().min(1).max(8760).optional(), // Max 1 year
  variables: z.record(z.string(), z.unknown()).optional(),
});

// ===========================================
//                MIDDLEWARE
// ===========================================
const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user.role !== "ADMIN") {
    throw new CustomError("Access denied", 403);
  }
  next();
};

// ===========================================
//            CONTROLLER CLASS
// ===========================================
class NotificationController {
  constructor(private notificationService: NotificationService) {}

  // ===========================================
  //             HELPER METHODS
  // ===========================================

  private buildPaginationQuery(
    query: QueryFilters,
    defaultLimit = DEFAULT_PAGE_SIZE
  ) {
    const page = Math.max(1, parseInt(query.page || "1"));
    const limit = Math.min(
      parseInt(query.limit || defaultLimit.toString()),
      MAX_PAGE_SIZE
    );
    return { page, limit };
  }

  private buildPaginationParams(
    query: QueryFilters,
    defaultLimit = DEFAULT_PAGE_SIZE
  ): PaginationParams {
    const { page, limit } = this.buildPaginationQuery(query, defaultLimit);
    return {
      page,
      limit,
      unreadOnly: query.unreadOnly === "true",
      category: query.category as NotificationCategory | undefined,
      type: query.type as NotificationType | undefined,
    };
  }

  private buildPaginationResponse(total: number, page: number, limit: number) {
    return {
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  private parseDateTime(dateString?: string): Date | undefined {
    return dateString ? new Date(dateString) : undefined;
  }

  // ===========================================
  //             USER ENDPOINTS
  // ===========================================

  // Get user notifications with filtering and pagination
  getNotifications = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.id;
      const query = req.query as QueryFilters;
      const options = this.buildPaginationParams(query);

      const result = await this.notificationService.getUserNotifications(
        userId,
        options
      );

      res.json({
        success: true,
        data: result.notifications,
        pagination: result.pagination,
      });
    }
  );

  // Get unread notifications count
  getUnreadCount = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.id;
      const count = await this.notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    }
  );

  // Mark notification as read
  markAsRead = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    const success = await this.notificationService.markAsRead(id, userId);

    if (!success) {
      throw new CustomError("Notification not found or already read", 404);
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  });

  // Mark all notifications as read
  markAllAsRead = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.id;
      const count = await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: `${count} notifications marked as read`,
      });
    }
  );

  // Delete notification
  deleteNotification = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const userId = req.user.id;

      const success = await this.notificationService.deleteNotification(
        id,
        userId
      );

      if (!success) {
        throw new CustomError("Notification not found", 404);
      }

      res.json({
        success: true,
        message: "Notification deleted",
      });
    }
  );

  // Get user notification preferences
  getPreferences = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.id;
      const preferences = await this.notificationService.getUserPreferences(
        userId
      );

      res.json({
        success: true,
        data: preferences,
      });
    }
  );

  // Update user notification preferences
  updatePreferences = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.id;
      const validatedData = updatePreferencesSchema.parse(req.body);

      const preferences = await this.notificationService.updateUserPreferences(
        userId,
        validatedData
      );

      res.json({
        success: true,
        data: preferences,
        message: "Preferences updated successfully",
      });
    }
  );

  // Get notification statistics (user-specific)
  getStats = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const stats = await this.notificationService.getNotificationStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  });

  // ===========================================
  //            ADMIN ENDPOINTS
  // ===========================================

  // Create notification (admin only)
  createNotification = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const validatedData = createNotificationSchema.parse(req.body);
      const { userId } = req.params;

      const notification = await this.notificationService.createNotification({
        ...validatedData,
        userId: userId || undefined,
        expiresAt: this.parseDateTime(validatedData.expiresAt),
        scheduledFor: this.parseDateTime(validatedData.scheduledFor),
      });

      res.status(201).json({
        success: true,
        data: notification,
        message: "Notification created successfully",
      });
    }
  );

  // Send bulk notifications (admin only)
  sendBulkNotifications = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const validatedData = bulkNotificationSchema.parse(req.body);

      const notifications =
        await this.notificationService.createBulkNotifications({
          userIds: validatedData.userIds,
          notification: {
            ...validatedData.notification,
            expiresAt: this.parseDateTime(validatedData.notification.expiresAt),
            scheduledFor: this.parseDateTime(
              validatedData.notification.scheduledFor
            ),
          },
        });

      res.status(201).json({
        success: true,
        data: {
          count: notifications.length,
          notifications: notifications.slice(0, 5), // Return first 5 for reference
        },
        message: `${notifications.length} notifications sent successfully`,
      });
    }
  );

  // Get all notifications (admin only) with advanced filtering
  getAllNotifications = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const query = req.query as AdminNotificationFilters;
      const { page, limit } = this.buildPaginationQuery(
        query,
        ADMIN_DEFAULT_PAGE_SIZE
      );
      const skip = (page - 1) * limit;

      // Build where clause with proper typing
      const where: Record<string, unknown> = {};

      if (query.userId) where.userId = query.userId;
      if (query.category)
        where.category = query.category as NotificationCategory;
      if (query.type) where.type = query.type as NotificationType;
      if (query.priority)
        where.priority = query.priority as NotificationPriority;
      if (query.isRead !== undefined) where.isRead = query.isRead === "true";

      if (query.dateFrom || query.dateTo) {
        where.createdAt = {};
        if (query.dateFrom) {
          (where.createdAt as Record<string, unknown>).gte = new Date(
            query.dateFrom
          );
        }
        if (query.dateTo) {
          (where.createdAt as Record<string, unknown>).lte = new Date(
            query.dateTo
          );
        }
      }

      if (query.search) {
        where.OR = [
          { title: { contains: query.search, mode: "insensitive" } },
          { message: { contains: query.search, mode: "insensitive" } },
        ];
      }

      const prisma = new PrismaClient();
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            order: {
              select: { id: true, total: true, currency: true },
            },
            product: {
              select: { id: true, name: true, price: true },
            },
            review: {
              select: { id: true, rating: true },
            },
          },
        }),
        prisma.notification.count({ where }),
      ]);

      res.json({
        success: true,
        data: notifications,
        pagination: this.buildPaginationResponse(total, page, limit),
      });
    }
  );

  // Get global notification statistics (admin only)
  getGlobalStats = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const stats = await this.notificationService.getNotificationStats();

      // Additional admin-specific stats
      const prisma = new PrismaClient();
      const [
        totalUsers,
        activeConnections,
        recentNotifications,
        deliveryStats,
        deliveredCount,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.webSocketConnection.count({ where: { isActive: true } }),
        prisma.notification.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        }),
        prisma.notification.groupBy({
          by: ["deliveryMethod"],
          _count: true,
          where: {
            isDelivered: true,
          },
        }),
        prisma.notification.count({ where: { isDelivered: true } }),
      ]);

      res.json({
        success: true,
        data: {
          ...stats,
          systemStats: {
            totalUsers,
            activeConnections,
            recentNotifications,
            deliveryRate:
              stats.total > 0
                ? ((deliveredCount / stats.total) * 100).toFixed(2)
                : "0",
          },
          deliveryStats: deliveryStats.reduce((acc, item) => {
            if (item.deliveryMethod) {
              acc[item.deliveryMethod] = item._count;
            }
            return acc;
          }, {} as Record<string, number>),
        },
      });
    }
  );

  // Send test notification (admin only)
  sendTestNotification = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { userId = req.user.id } = req.body as { userId?: string };

      const notification = await this.notificationService.createNotification({
        userId,
        type: NotificationType.SYSTEM_ERROR,
        title: "Test Notification",
        message:
          "This is a test notification to verify the system is working correctly.",
        category: NotificationCategory.SYSTEM,
        priority: NotificationPriority.NORMAL,
        data: { isTest: true },
        source: "admin-test",
      });

      res.json({
        success: true,
        data: notification,
        message: "Test notification sent successfully",
      });
    }
  );

  // Process scheduled notifications manually (admin only)
  processScheduledNotifications = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const processedCount =
        await this.notificationService.processScheduledNotifications();

      res.json({
        success: true,
        message: `${processedCount} scheduled notifications processed`,
      });
    }
  );

  // Cleanup expired notifications (admin only)
  cleanupExpiredNotifications = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const count =
        await this.notificationService.cleanupExpiredNotifications();

      res.json({
        success: true,
        message: `${count} expired notifications cleaned up`,
      });
    }
  );

  // Get WebSocket connection stats (admin only)
  getConnectionStats = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const prisma = new PrismaClient();
      const [activeConnections, totalConnections, connectionsByHour] =
        await Promise.all([
          prisma.webSocketConnection.count({ where: { isActive: true } }),
          prisma.webSocketConnection.count(),
          prisma.webSocketConnection.groupBy({
            by: ["connectedAt"],
            _count: true,
            where: {
              connectedAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
            orderBy: {
              connectedAt: "asc",
            },
          }),
        ]);

      const uniqueActiveUsers = await prisma.webSocketConnection.findMany({
        where: { isActive: true },
        select: { userId: true },
        distinct: ["userId"],
      });

      res.json({
        success: true,
        data: {
          activeConnections,
          totalConnections,
          uniqueActiveUsers: uniqueActiveUsers.length,
          averageConnectionsPerUser:
            uniqueActiveUsers.length > 0
              ? (activeConnections / uniqueActiveUsers.length).toFixed(2)
              : "0",
          connectionsByHour: connectionsByHour.map((item) => ({
            hour: item.connectedAt,
            count: item._count,
          })),
        },
      });
    }
  );

  // ===========================================
  //          TEMPLATE MANAGEMENT
  // ===========================================

  // Create template (admin only)
  createTemplate = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const validatedData = templateSchema.parse(req.body);
      const template = await this.notificationService.createTemplate(
        validatedData
      );

      res.status(201).json({
        success: true,
        data: template,
        message: "Template created successfully",
      });
    }
  );

  // Get all templates (admin only)
  getTemplates = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const templates = await this.notificationService.getAllTemplates();

      res.json({
        success: true,
        data: templates,
      });
    }
  );

  // Update template (admin only)
  updateTemplate = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const updates = templateSchema.partial().parse(req.body);

      const template = await this.notificationService.updateTemplate(
        id,
        updates
      );

      res.json({
        success: true,
        data: template,
        message: "Template updated successfully",
      });
    }
  );

  // Delete template (admin only)
  deleteTemplate = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      await this.notificationService.deleteTemplate(id);

      res.json({
        success: true,
        message: "Template deleted successfully",
      });
    }
  );
}

export default NotificationController;
