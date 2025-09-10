import { PrismaClient } from "../generated/prisma";
import { logger } from "../utils/logger";
import { CustomError } from "../utils/customError";
import WebSocketService from "./websocketService";
import EmailService from "./emailService";
import {
  NotificationType,
  NotificationPriority,
  NotificationCategory,
  DeliveryMethod,
  User,
  Order,
  Product,
  Notification,
  NotificationPreference,
  NotificationTemplate,
  NotificationData,
  BulkNotificationData,
  CreateTemplateData,
  OrderWithUser,
  ProductWithWishlists,
  ReviewWithRelations,
  NotificationWithRelations,
  QuietHours,
  PromotionDetails,
  CartItem,
  NotificationListResult,
  PaginationParams,
  NotificationPreferenceUpdate,
} from "../types/notifications";

const prisma = new PrismaClient();

class NotificationService {
  constructor(
    private webSocketService: WebSocketService,
    private emailService: EmailService
  ) {}
  // ===========================================
  //         CORE NOTIFICATION METHODS
  // ===========================================

  async createNotification(
    data: NotificationData
  ): Promise<NotificationWithRelations> {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          priority: data.priority || NotificationPriority.NORMAL,
          category: data.category,
          data: (data.data || {}) as any,
          actionUrl: data.actionUrl,
          expiresAt: data.expiresAt,
          scheduledFor: data.scheduledFor,
          orderId: data.orderId,
          productId: data.productId,
          reviewId: data.reviewId,
          source: data.source || "system",
        },
        include: {
          user: true,
          order: true,
          product: true,
          review: {
            include: {
              user: true,
              product: true,
            },
          },
        },
      });

      if (!data.scheduledFor || data.scheduledFor <= new Date()) {
        await this.deliverNotification(notification);
      }

      return notification as NotificationWithRelations;
    } catch (error) {
      logger.error("Failed to create notification:", error);
      throw new CustomError("Failed to create notification", 500);
    }
  }

  async createBulkNotifications(
    data: BulkNotificationData
  ): Promise<Notification[]> {
    try {
      const notifications = await prisma.$transaction(
        data.userIds.map((userId) =>
          prisma.notification.create({
            data: {
              userId,
              ...data.notification,
              priority:
                data.notification.priority || NotificationPriority.NORMAL,
              data: (data.notification.data || {}) as any,
              source: data.notification.source || "system",
            },
          })
        )
      );

      // Deliver all notifications
      await Promise.all(
        notifications.map((notification) =>
          this.deliverNotification(notification)
        )
      );

      return notifications;
    } catch (error) {
      logger.error("Failed to create bulk notifications:", error);
      throw new CustomError("Failed to create bulk notifications", 500);
    }
  }
  // ===========================================
  //         USER NOTIFICATION METHODS
  // ===========================================

  async getUserNotifications(
    userId: string,
    options: PaginationParams
  ): Promise<NotificationListResult> {
    try {
      const skip = (options.page - 1) * options.limit;

      const where: Record<string, unknown> = {
        userId: userId,
      };

      if (options.unreadOnly) {
        where.isRead = false;
      }

      if (options.category) {
        where.category = options.category;
      }

      if (options.type) {
        where.type = options.type;
      }

      where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: options.limit,
          include: {
            user: true,
            order: true,
            product: true,
            review: {
              include: {
                user: true,
                product: true,
              },
            },
          },
        }),
        prisma.notification.count({ where }),
      ]);

      return {
        notifications: notifications as NotificationWithRelations[],
        pagination: {
          total,
          pages: Math.ceil(total / options.limit),
          currentPage: options.page,
          hasNext: options.page * options.limit < total,
          hasPrev: options.page > 1,
        },
      };
    } catch (error) {
      logger.error("Failed to get user notifications:", error);
      throw new CustomError("Failed to get user notifications", 500);
    }
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          id,
          userId,
        },
      });

      return result.count > 0;
    } catch (error) {
      logger.error("Failed to delete notification:", error);
      return false;
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return result.count > 0;
    } catch (error) {
      logger.warn("Failed to mark notification as read:", error);
      return false;
    }
  }

  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return result.count;
    } catch (error) {
      logger.warn("Failed to mark all notifications as read:", error);
      return 0;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.notification.count({
        where: {
          userId,
          isRead: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
    } catch (error) {
      return 0;
    }
  }
  // ===========================================
  //         PREFERENCES METHODS
  // ===========================================
  async getUserPreferences(userId: string): Promise<NotificationPreference> {
    try {
      let preferences = await prisma.notificationPreference.findUnique({
        where: { userId },
      });

      if (!preferences) {
        preferences = await prisma.notificationPreference.create({
          data: { userId },
        });
      }

      return preferences;
    } catch (error) {
      throw error;
    }
  }

  async updateUserPreferences(
    userId: string,
    data: NotificationPreferenceUpdate
  ): Promise<NotificationPreference> {
    try {
      const updateData = {
        ...data,
        quietHours: data.quietHours as any,
      };

      const createData = {
        userId,
        ...data,
        quietHours: data.quietHours as any,
      };

      return await prisma.notificationPreference.upsert({
        where: { userId },
        update: updateData,
        create: createData,
      });
    } catch (error) {
      logger.error("Failed to update user preferences:", error);
      throw new CustomError("Failed to update user preferences", 500);
    }
  }
  // ===========================================
  //         STATISTICS METHODS
  // ===========================================
  async getNotificationStats(userId?: string) {
    try {
      const where = userId ? { userId } : {};

      const [total, unread, byCategory, byPriority] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { ...where, isRead: false } }),
        prisma.notification.groupBy({
          by: ["category"],
          where,
          _count: true,
        }),
        prisma.notification.groupBy({
          by: ["priority"],
          where,
          _count: true,
        }),
      ]);

      return {
        total,
        unread,
        readRate:
          total > 0 ? (((total - unread) / total) * 100).toFixed(2) : "0",
        byCategory: byCategory.reduce((acc, item) => {
          acc[item.category] = item._count;
          return acc;
        }, {} as Record<string, number>),
        byPriority: byPriority.reduce((acc, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      logger.error("Failed to get notification stats:", error);
      throw new CustomError("Failed to get notification stats", 500);
    }
  }
  // ===========================================
  //         ADMIN METHODS
  // ===========================================
  async processScheduledNotifications(): Promise<number> {
    try {
      const scheduledNotifications = await prisma.notification.findMany({
        where: {
          scheduledFor: {
            lte: new Date(),
          },
          isDelivered: false,
        },
        include: {
          user: true,
          order: true,
          product: true,
          review: {
            include: {
              user: true,
              product: true,
            },
          },
        },
      });

      let processedCount = 0;

      for (const notification of scheduledNotifications) {
        try {
          await this.deliverNotification(
            notification as NotificationWithRelations
          );

          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              isDelivered: true,
              deliveredAt: new Date(),
            },
          });

          processedCount++;
        } catch (error) {
          logger.error(
            `Failed to process notification ${notification.id}:`,
            error
          );
        }
      }

      return processedCount;
    } catch (error) {
      logger.error("Failed to process scheduled notifications:", error);
      throw new CustomError("Failed to process scheduled notifications", 500);
    }
  }

  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return result.count;
    } catch (error) {
      logger.error("Failed to cleanup expired notifications:", error);
      throw new CustomError("Failed to cleanup expired notifications", 500);
    }
  }
  // ===========================================
  //             TEMPLATE METHODS
  // ===========================================
  async createTemplate(
    data: CreateTemplateData
  ): Promise<NotificationTemplate> {
    try {
      return await prisma.notificationTemplate.create({
        data: {
          ...data,
          variables: data.variables as any,
        },
      });
    } catch (error) {
      logger.error("Failed to create template:", error);
      throw new CustomError("Failed to create template", 500);
    }
  }

  async getTemplate(
    type: NotificationType
  ): Promise<NotificationTemplate | null> {
    try {
      return await prisma.notificationTemplate.findUnique({
        where: { type },
      });
    } catch (error) {
      return null;
    }
  }

  async getAllTemplates(): Promise<NotificationTemplate[]> {
    try {
      return await prisma.notificationTemplate.findMany({
        orderBy: { type: "asc" },
      });
    } catch (error) {
      logger.error("Failed to get templates:", error);
      throw new CustomError("Failed to get templates", 500);
    }
  }

  async updateTemplate(
    id: string,
    updates: Partial<CreateTemplateData>
  ): Promise<NotificationTemplate> {
    try {
      return await prisma.notificationTemplate.update({
        where: { id },
        data: {
          ...updates,
          variables: updates.variables as any,
        },
      });
    } catch (error) {
      logger.error("Failed to update template:", error);
      throw new CustomError("Failed to update template", 500);
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      await prisma.notificationTemplate.delete({
        where: { id },
      });
    } catch (error) {
      logger.error("Failed to delete template:", error);
      throw new CustomError("Failed to delete template", 500);
    }
  }
  // ===========================================
  //             PRIVATE METHODS
  // ===========================================
  private async deliverNotification(
    notification: NotificationWithRelations | Notification
  ): Promise<void> {
    try {
      if (!notification.userId) {
        // System/admin notification
        await this.webSocketService.sendNotificationToAdmins({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          data: notification.data as Record<string, unknown>,
          actionUrl: notification.actionUrl || undefined,
          expiresAt: notification.expiresAt || undefined,
          createdAt: notification.createdAt,
        });
        return;
      }

      let preferences;
      try {
        preferences = await this.getUserPreferences(notification.userId);
      } catch (error) {
        preferences = {
          enableWebSocket: true,
          enableEmail: true,
          orderUpdates: true,
          paymentAlerts: true,
          systemAlerts: true,
          promotions: false,
        } as any;
      }

      if (preferences.enableWebSocket) {
        await this.webSocketService.sendNotificationToUser(
          notification.userId,
          {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            data: notification.data as Record<string, unknown>,
            actionUrl: notification.actionUrl || undefined,
            expiresAt: notification.expiresAt || undefined,
            createdAt: notification.createdAt,
          }
        );
      }

      if (
        (notification.priority === NotificationPriority.HIGH ||
          notification.priority === NotificationPriority.URGENT ||
          preferences.enableEmail) &&
        this.shouldSendEmailForType(notification.type, preferences)
      ) {
        await this.sendEmailNotification(notification);
      }
    } catch (error) {
      logger.error(`Failed to deliver notification ${notification.id}:`, error);
    }
  }
  // ===========================================
  //             TEMPLATE-BASED NOTIFICATIONS
  // ===========================================
  async createNotificationFromTemplate(
    type: NotificationType,
    userId: string | null,
    variables: Record<string, unknown> = {}
  ): Promise<NotificationWithRelations> {
    try {
      const template = await this.getTemplate(type);
      if (!template) {
        // Fallback se il template non esiste
        return await this.createNotification({
          userId: userId || undefined,
          type,
          title: `Notification: ${type}`,
          message: `A ${type} event occurred`,
          category: NotificationCategory.SYSTEM,
          data: variables,
          source: "fallback-system",
        });
      }

      const title = this.processTemplate(template.websocketTitle, variables);
      const message = this.processTemplate(
        template.websocketMessage,
        variables
      );

      const notificationData: NotificationData = {
        userId: userId || undefined,
        type,
        title,
        message,
        priority: template.priority,
        category: template.category,
        data: variables,
        source: "template-system",
      };

      if (template.autoExpire && template.expirationHours) {
        notificationData.expiresAt = new Date(
          Date.now() + template.expirationHours * 60 * 60 * 1000
        );
      }

      return await this.createNotification(notificationData);
    } catch (error) {
      return await this.createNotification({
        userId: userId || undefined,
        type,
        title: `Notification: ${type}`,
        message: `A ${type} event occurred`,
        category: NotificationCategory.SYSTEM,
        data: variables,
        source: "fallback-system",
      });
    }
  }
  // ===========================================
  //           ORDER NOTIFICATIONS
  // ===========================================
  async notifyOrderCreated(order: OrderWithUser): Promise<void> {
    const variables = {
      orderNumber: order.id,
      orderTotal: Number(order.total).toString(),
      currency: order.currency,
      userName: (order.user as any).firstName || order.user.email,
    };

    try {
      await this.createNotificationFromTemplate(
        NotificationType.ORDER_CREATED,
        order.userId,
        variables
      );

      if (Number(order.total) >= 1000) {
        await this.createNotificationFromTemplate(
          NotificationType.HIGH_VALUE_ORDER,
          null,
          { ...variables, isHighValue: true }
        );
      }
    } catch (error) {
      logger.warn("Failed to send order notification:", error);
    }
  }

  async notifyOrderStatusChange(
    order: OrderWithUser,
    newStatus: string,
    previousStatus: string
  ): Promise<void> {
    const statusTypeMap: Record<string, NotificationType> = {
      CONFIRMED: NotificationType.ORDER_CONFIRMED,
      PROCESSING: NotificationType.ORDER_PROCESSING,
      SHIPPED: NotificationType.ORDER_SHIPPED,
      DELIVERED: NotificationType.ORDER_DELIVERED,
      CANCELLED: NotificationType.ORDER_CANCELLED,
    };

    const notificationType = statusTypeMap[newStatus];
    if (!notificationType) return;

    const variables = {
      orderNumber: order.id,
      orderTotal: Number(order.total).toString(),
      currency: order.currency,
      newStatus,
      previousStatus,
      userName: (order.user as any).firstName || order.user.email,
    };

    try {
      await this.createNotificationFromTemplate(
        notificationType,
        order.userId,
        variables
      );
    } catch (error) {
      logger.warn("Failed to send order status notification:", error);
    }
  }
  // ===========================================
  //           PAYMENT NOTIFICATIONS
  // ===========================================
  async notifyPaymentSuccess(order: OrderWithUser): Promise<void> {
    const variables = {
      orderNumber: order.id,
      amount: Number(order.total).toString(),
      currency: order.currency,
      userName: (order.user as any).firstName || order.user.email,
      paymentMethod: (order as any).paymentMethod || "unknown",
    };

    try {
      await this.createNotificationFromTemplate(
        NotificationType.PAYMENT_SUCCESS,
        order.userId,
        variables
      );
    } catch (error) {
      logger.warn("Failed to send payment success notification:", error);
    }
  }

  async notifyPaymentFailed(
    order: OrderWithUser,
    reason?: string
  ): Promise<void> {
    const variables = {
      orderNumber: order.id,
      amount: Number(order.total).toString(),
      currency: order.currency,
      userName: (order.user as any).firstName || order.user.email,
      reason: reason || "Unknown error",
      retryUrl: `/orders/${order.id}/retry-payment`,
    };

    try {
      await this.createNotificationFromTemplate(
        NotificationType.PAYMENT_FAILED,
        order.userId,
        variables
      );
    } catch (error) {
      logger.warn("Failed to send payment failed notification:", error);
    }
  }
  // ===========================================
  //           USER NOTIFICATIONS
  // ===========================================
  async notifyAccountCreated(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) return;

      const variables = {
        userName: (user as any).firstName || user.email,
        verificationUrl: `/verify-email?token=${
          (user as any).emailVerificationToken || "token"
        }`,
      };

      await this.createNotificationFromTemplate(
        NotificationType.ACCOUNT_CREATED,
        userId,
        variables
      );
    } catch (error) {
      logger.warn("Failed to send account creation notification:", error);
    }
  }

  async notifyPasswordChanged(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) return;

      const variables = {
        userName: (user as any).firstName || user.email,
        changeTime: new Date().toLocaleString(),
        securityUrl: "/account/security",
      };

      await this.createNotificationFromTemplate(
        NotificationType.PASSWORD_CHANGED,
        userId,
        variables
      );
    } catch (error) {
      logger.warn("Failed to send password change notification:", error);
    }
  }
  // ===========================================
  //           SYSTEM NOTIFICATIONS
  // ===========================================
  async notifySystemError(error: Error, context?: string): Promise<void> {
    try {
      const variables = {
        errorMessage: error.message,
        context: context || "Unknown",
        timestamp: new Date().toISOString(),
      };

      await this.createNotificationFromTemplate(
        NotificationType.SYSTEM_ERROR,
        null,
        variables
      );
    } catch (err) {
      logger.warn("Failed to send system error notification:", err);
    }
  }

  // ===========================================
  //           STUB METHODS
  // ===========================================

  async notifyProductBackInStock(productId: string): Promise<void> {
    logger.info(`Product ${productId} back in stock notification queued`);
  }

  async notifyLowStock(
    productId: string,
    currentStock: number,
    threshold: number
  ): Promise<void> {
    logger.info(`Low stock alert for product ${productId}`);
  }

  async notifyNewReview(reviewId: string): Promise<void> {
    logger.info(`New review ${reviewId} notification queued`);
  }

  async notifyPromotionStarted(
    userIds: string[],
    promotion: PromotionDetails
  ): Promise<void> {
    logger.info(
      `Promotion ${promotion.name} notification queued for ${userIds.length} users`
    );
  }

  async notifyCartAbandoned(
    userId: string,
    cartItems: CartItem[]
  ): Promise<void> {
    logger.info(`Cart abandonment notification queued for user ${userId}`);
  }

  // ===========================================
  //           HELPER METHODS
  // ===========================================
  private processTemplate(
    template: string,
    variables: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : match;
    });
  }

  private shouldSendEmailForType(
    type: NotificationType,
    preferences: any
  ): boolean {
    const emailEnabledTypes: Record<string, boolean> = {
      [NotificationType.ORDER_CREATED]: preferences.orderUpdates ?? true,
      [NotificationType.ORDER_CONFIRMED]: preferences.orderUpdates ?? true,
      [NotificationType.ORDER_SHIPPED]: preferences.orderUpdates ?? true,
      [NotificationType.ORDER_DELIVERED]: preferences.orderUpdates ?? true,
      [NotificationType.PAYMENT_SUCCESS]: preferences.paymentAlerts ?? true,
      [NotificationType.PAYMENT_FAILED]: preferences.paymentAlerts ?? true,
      [NotificationType.PASSWORD_CHANGED]: preferences.systemAlerts ?? true,
      [NotificationType.ACCOUNT_CREATED]: preferences.systemAlerts ?? true,
      [NotificationType.PROMOTION_STARTED]: preferences.promotions ?? false,
    };

    return emailEnabledTypes[type] ?? false;
  }

  private async sendEmailNotification(
    notification: NotificationWithRelations | Notification
  ): Promise<void> {
    try {
      const user =
        "user" in notification
          ? notification.user
          : await prisma.user.findUnique({
              where: { id: notification.userId || "" },
            });

      if (!user?.email) return;

      const template = await this.getTemplate(notification.type);
      if (!template?.emailSubject || !template?.emailTemplate) return;

      const subject = this.processTemplate(
        template.emailSubject,
        notification.data as Record<string, unknown>
      );
      const content = this.processTemplate(
        template.emailTemplate,
        notification.data as Record<string, unknown>
      );

      await this.emailService.sendEmail({
        to: user.email,
        subject,
        html: content,
        text: notification.message,
      });
    } catch (error) {
      logger.warn("Failed to send email notification:", error);
    }
  }
}

export default NotificationService;
