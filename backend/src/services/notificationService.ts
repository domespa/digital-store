import {
  PrismaClient,
  NotificationType as PrismaNotificationType,
  Prisma,
} from "../generated/prisma";
import { logger } from "../utils/logger";
import { CustomError } from "../utils/customError";
import WebSocketService from "./websocketService";
import EmailService from "./emailService";
import {
  NotificationPriority as PrismaNotificationPriority,
  NotificationCategory as PrismaNotificationCategory,
  DeliveryMethod,
  Notification,
  NotificationPreference,
  NotificationTemplate,
  NotificationData,
  BulkNotificationData,
  CreateTemplateData,
  OrderWithUser,
  NotificationWithRelations,
  QuietHours,
  PromotionDetails,
  CartItem,
  NotificationListResult,
  PaginationParams,
  NotificationPreferenceUpdate,
} from "../types/notifications";
import { prisma } from "../utils/prisma";

class NotificationService {
  constructor(
    private webSocketService: WebSocketService,
    private emailService: EmailService
  ) {}

  // ===========================================
  //         CORE NOTIFICATION METHODS
  // ===========================================

  async createNotification(
    data: Omit<NotificationData, "type"> & { type: PrismaNotificationType }
  ): Promise<NotificationWithRelations> {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          priority: data.priority || PrismaNotificationPriority.NORMAL,
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
      logger.error(
        "Failed to create notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
              type: data.notification.type as PrismaNotificationType,
              title: data.notification.title,
              message: data.notification.message,
              category: data.notification.category,
              priority:
                data.notification.priority || PrismaNotificationPriority.NORMAL,
              data: (data.notification.data as Prisma.JsonValue) || {},
              actionUrl: data.notification.actionUrl,
              expiresAt: data.notification.expiresAt,
              scheduledFor: data.notification.scheduledFor,
              orderId: data.notification.orderId,
              productId: data.notification.productId,
              reviewId: data.notification.reviewId,
              source: data.notification.source || "system",
            },
          })
        )
      );

      await Promise.all(
        notifications.map((notification) =>
          this.deliverNotification(notification)
        )
      );

      return notifications;
    } catch (error) {
      logger.error(
        "Failed to create bulk notifications:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
      logger.error(
        "Failed to get user notifications:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
      logger.error(
        "Failed to delete notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
      logger.warn(
        "Failed to mark notification as read:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
      logger.warn(
        "Failed to mark all notifications as read:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
      logger.error(
        "Failed to update user preferences:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
      logger.error(
        "Failed to get notification stats:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
            error instanceof Error ? error.message : "errore sconosciuto"
          );
        }
      }

      return processedCount;
    } catch (error) {
      logger.error(
        "Failed to process scheduled notifications:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
      logger.error(
        "Failed to cleanup expired notifications:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
          type: data.type as PrismaNotificationType,
          category: data.category,
          websocketTitle: data.websocketTitle,
          websocketMessage: data.websocketMessage,
          emailSubject: data.emailSubject,
          emailTemplate: data.emailTemplate,
          priority: data.priority as PrismaNotificationPriority,
          autoExpire: data.autoExpire,
          expirationHours: data.expirationHours,
          variables: data.variables as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      logger.error(
        "Failed to create template:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
      throw new CustomError("Failed to create template", 500);
    }
  }

  async getTemplate(
    type: PrismaNotificationType
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
      logger.error(
        "Failed to get templates:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
      throw new CustomError("Failed to get templates", 500);
    }
  }

  async updateTemplate(
    id: string,
    updates: Partial<CreateTemplateData>
  ): Promise<NotificationTemplate> {
    try {
      const dataToUpdate: any = { ...updates };

      if (updates.variables !== undefined) {
        dataToUpdate.variables = updates.variables as Prisma.JsonValue;
      }

      return await prisma.notificationTemplate.update({
        where: { id },
        data: dataToUpdate,
      });
    } catch (error) {
      logger.error(
        "Failed to update template:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
      throw new CustomError("Failed to update template", 500);
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      await prisma.notificationTemplate.delete({
        where: { id },
      });
    } catch (error) {
      logger.error(
        "Failed to delete template:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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

      //  QUIET HOURS
      if (preferences.quietHours) {
        const quietHours = this.parseQuietHours(preferences.quietHours);
        if (quietHours && this.isInQuietHours(quietHours)) {
          logger.info(
            `Notification ${notification.id} delayed due to quiet hours`
          );
          return;
        }
      }

      let deliverySuccess = false;

      // WEBSOCKET DELIVERY WITH TRACKING
      if (preferences.enableWebSocket) {
        const wsSuccess = await this.webSocketService.sendNotificationToUser(
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

        if (wsSuccess) {
          deliverySuccess = true;
          await prisma.notification
            .update({
              where: { id: notification.id },
              data: {
                isDelivered: true,
                deliveredAt: new Date(),
                deliveryMethod: DeliveryMethod.WEBSOCKET,
              },
            })
            .catch(() => {});
        }
      }

      if (
        (notification.priority === PrismaNotificationPriority.HIGH ||
          notification.priority === PrismaNotificationPriority.URGENT ||
          preferences.enableEmail) &&
        this.shouldSendEmailForType(notification.type, preferences)
      ) {
        const emailSuccess = await this.sendEmailNotification(notification);

        if (emailSuccess && !deliverySuccess) {
          await prisma.notification
            .update({
              where: { id: notification.id },
              data: {
                isDelivered: true,
                deliveredAt: new Date(),
                deliveryMethod: DeliveryMethod.EMAIL,
              },
            })
            .catch(() => {});
        }
      }
    } catch (error) {
      logger.error(
        `Failed to deliver notification ${notification.id}:`,
        error instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  // ===========================================
  //        QUIET HOURS IMPLEMENTATION
  // ===========================================

  private isInQuietHours(quietHours: QuietHours): boolean {
    if (!quietHours?.start || !quietHours?.end || !quietHours?.timezone) {
      return false;
    }

    try {
      const now = new Date();
      const userTime = new Date(
        now.toLocaleString("en-US", { timeZone: quietHours.timezone })
      );
      const currentHour = userTime.getHours();
      const currentMinute = userTime.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = quietHours.start.split(":").map(Number);
      const [endHour, endMinute] = quietHours.end.split(":").map(Number);
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;

      if (startTime > endTime) {
        return currentTime >= startTime || currentTime < endTime;
      }

      return currentTime >= startTime && currentTime < endTime;
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.warn("Failed to check quiet hours:", error);
      }
      return false;
    }
  }

  private parseQuietHours(quietHours: unknown): QuietHours | null {
    if (!quietHours || typeof quietHours !== "object") {
      return null;
    }

    const qh = quietHours as Record<string, unknown>;

    if (
      typeof qh.start === "string" &&
      typeof qh.end === "string" &&
      typeof qh.timezone === "string"
    ) {
      return {
        start: qh.start,
        end: qh.end,
        timezone: qh.timezone,
      };
    }

    return null;
  }

  // ===========================================
  //       TEMPLATE-BASED NOTIFICATIONS
  // ===========================================

  async createNotificationFromTemplate(
    type: PrismaNotificationType,
    userId: string | null,
    variables: Record<string, unknown> = {}
  ): Promise<NotificationWithRelations> {
    try {
      const template = await this.getTemplate(type);

      if (!template) {
        return await this.createNotification({
          userId: userId || undefined,
          type,
          title: `Notification: ${type}`,
          message: `A ${type} event occurred`,
          category: "SYSTEM" as PrismaNotificationCategory,
          data: variables,
          source: "fallback-system",
          priority: "NORMAL" as PrismaNotificationPriority,
        });
      }

      const title = this.processTemplate(template.websocketTitle, variables);
      const message = this.processTemplate(
        template.websocketMessage,
        variables
      );

      const notificationData: Omit<NotificationData, "type"> & {
        type: PrismaNotificationType;
      } = {
        userId: userId || undefined,
        type,
        title,
        message,
        priority: template.priority as PrismaNotificationPriority,
        category: template.category as PrismaNotificationCategory,
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
        category: "SYSTEM" as PrismaNotificationCategory,
        data: variables,
        source: "fallback-system",
        priority: "NORMAL" as PrismaNotificationPriority,
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
        PrismaNotificationType.ORDER_CREATED,
        order.userId,
        variables
      );

      if (Number(order.total) >= 1000) {
        await this.createNotificationFromTemplate(
          PrismaNotificationType.HIGH_VALUE_ORDER,
          null,
          { ...variables, isHighValue: true }
        );
      }
    } catch (error) {
      logger.warn(
        "Failed to send order notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  async notifyOrderStatusChange(
    order: OrderWithUser,
    newStatus: string,
    previousStatus: string
  ): Promise<void> {
    const statusTypeMap: Record<string, PrismaNotificationType> = {
      CONFIRMED: PrismaNotificationType.ORDER_CONFIRMED,
      PROCESSING: PrismaNotificationType.ORDER_PROCESSING,
      SHIPPED: PrismaNotificationType.ORDER_SHIPPED,
      DELIVERED: PrismaNotificationType.ORDER_DELIVERED,
      CANCELLED: PrismaNotificationType.ORDER_CANCELLED,
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
      logger.warn(
        "Failed to send order status notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  // ===========================================
  //         PAYMENT NOTIFICATIONS
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
        PrismaNotificationType.PAYMENT_SUCCESS,
        order.userId,
        variables
      );
    } catch (error) {
      logger.warn(
        "Failed to send payment success notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
        PrismaNotificationType.PAYMENT_FAILED,
        order.userId,
        variables
      );
    } catch (error) {
      logger.warn(
        "Failed to send payment failed notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
        PrismaNotificationType.ACCOUNT_CREATED,
        userId,
        variables
      );
    } catch (error) {
      logger.warn(
        "Failed to send account creation notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
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
        PrismaNotificationType.PASSWORD_CHANGED,
        userId,
        variables
      );
    } catch (error) {
      logger.warn(
        "Failed to send password change notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  // ===========================================
  //          SYSTEM NOTIFICATIONS
  // ===========================================

  async notifySystemError(error: Error, context?: string): Promise<void> {
    try {
      const variables = {
        errorMessage: error.message,
        context: context || "Unknown",
        timestamp: new Date().toISOString(),
      };

      await this.createNotificationFromTemplate(
        PrismaNotificationType.SYSTEM_ERROR,
        null,
        variables
      );
    } catch (err) {
      logger.warn(
        "Failed to send system error notification:",
        err instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  // ===========================================
  //              STUB METHODS
  // ===========================================

  async notifyProductBackInStock(productId: string): Promise<void> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          wishlists: {
            include: { user: true },
          },
        },
      });

      if (!product || product.wishlists.length === 0) {
        logger.info(`No wishlists for product ${productId}`);
        return;
      }

      const userIds = product.wishlists.map((w) => w.userId);

      await this.createBulkNotifications({
        userIds,
        notification: {
          type: PrismaNotificationType.PRODUCT_BACK_IN_STOCK,
          title: `${product.name} is back in stock!`,
          message: `The product you wishlisted is now available. Get it before it's gone!`,
          category: PrismaNotificationCategory.PRODUCT,
          priority: PrismaNotificationPriority.NORMAL,
          actionUrl: `/products/${productId}`,
          data: {
            productId,
            productName: product.name,
            price: product.price.toString(),
            stock: product.stock,
          },
        },
      });

      logger.info(
        `Sent back-in-stock notifications to ${userIds.length} users for product ${productId}`
      );
    } catch (error) {
      logger.error(
        "Failed to send back-in-stock notifications:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  async notifyLowStock(
    productId: string,
    currentStock: number,
    threshold: number
  ): Promise<void> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, stock: true, price: true },
      });

      if (!product) return;

      await this.createNotification({
        userId: undefined,
        type: PrismaNotificationType.LOW_STOCK_ALERT,
        title: `Low Stock Alert: ${product.name}`,
        message: `Product stock is low (${currentStock}/${threshold}). Consider restocking soon.`,
        category: PrismaNotificationCategory.ADMIN,
        priority: PrismaNotificationPriority.HIGH,
        actionUrl: `/admin/products/${productId}`,
        data: {
          productId,
          productName: product.name,
          currentStock,
          threshold,
          stockPercentage: Math.round((currentStock / threshold) * 100),
        },
      });

      logger.info(`Low stock alert sent for product ${productId}`);
    } catch (error) {
      logger.error(
        "Failed to send low stock alert:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  async notifyNewReview(reviewId: string): Promise<void> {
    try {
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          product: {
            select: { id: true, name: true, createdBy: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!review) return;

      const reviewerName =
        review.user?.firstName || review.customerName || "A customer";

      if (review.product.createdBy) {
        await this.createNotification({
          userId: review.product.createdBy,
          type: PrismaNotificationType.PRODUCT_NEW_REVIEW,
          title: `New review for ${review.product.name}`,
          message: `${reviewerName} left a ${review.rating}-star review on your product.`,
          category: PrismaNotificationCategory.REVIEW,
          priority: PrismaNotificationPriority.NORMAL,
          actionUrl: `/products/${review.product.id}#reviews`,
          data: {
            reviewId,
            productId: review.product.id,
            productName: review.product.name,
            rating: review.rating,
            reviewerName,
          },
        });
      }

      logger.info(`New review notification sent for review ${reviewId}`);
    } catch (error) {
      logger.error(
        "Failed to send new review notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  async notifyPromotionStarted(
    userIds: string[],
    promotion: PromotionDetails
  ): Promise<void> {
    try {
      await this.createBulkNotifications({
        userIds,
        notification: {
          type: PrismaNotificationType.PROMOTION_STARTED,
          title: `🎉 ${promotion.name} - ${promotion.discountPercentage}% OFF!`,
          message: `Use code ${promotion.code} before ${new Date(
            promotion.validUntil
          ).toLocaleDateString()}. Don't miss out!`,
          category: PrismaNotificationCategory.MARKETING,
          priority: PrismaNotificationPriority.NORMAL,
          actionUrl: `/promotions/${promotion.code}`,
          expiresAt: new Date(promotion.validUntil),
          data: {
            promotionName: promotion.name,
            discountPercentage: promotion.discountPercentage,
            code: promotion.code,
            validUntil: promotion.validUntil,
          },
        },
      });

      logger.info(
        `Promotion ${promotion.name} notification sent to ${userIds.length} users`
      );
    } catch (error) {
      logger.error(
        "Failed to send promotion notifications:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  async notifyCartAbandoned(
    userId: string,
    cartItems: CartItem[]
  ): Promise<void> {
    try {
      const totalValue = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

      const itemsList = cartItems
        .slice(0, 3)
        .map((item) => item.name)
        .join(", ");

      await this.createNotification({
        userId,
        type: PrismaNotificationType.CART_ABANDONED,
        title: "You left items in your cart!",
        message: `Don't forget about ${itemCount} item${
          itemCount > 1 ? "s" : ""
        } waiting for you: ${itemsList}${
          cartItems.length > 3 ? "..." : ""
        }. Complete your purchase now!`,
        category: PrismaNotificationCategory.MARKETING,
        priority: PrismaNotificationPriority.NORMAL,
        actionUrl: "/cart",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        data: {
          totalValue: totalValue.toFixed(2),
          itemCount,
          items: cartItems,
        },
      });

      logger.info(`Cart abandonment notification sent to user ${userId}`);
    } catch (error) {
      logger.error(
        "Failed to send cart abandonment notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
    }
  }

  // ===========================================
  //   HELPER METHODS
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
    type: PrismaNotificationType,
    preferences: any
  ): boolean {
    const emailEnabledTypes: Record<string, boolean> = {
      [PrismaNotificationType.ORDER_CREATED]: preferences.orderUpdates ?? true,
      [PrismaNotificationType.ORDER_CONFIRMED]:
        preferences.orderUpdates ?? true,
      [PrismaNotificationType.ORDER_SHIPPED]: preferences.orderUpdates ?? true,
      [PrismaNotificationType.ORDER_DELIVERED]:
        preferences.orderUpdates ?? true,
      [PrismaNotificationType.PAYMENT_SUCCESS]:
        preferences.paymentAlerts ?? true,
      [PrismaNotificationType.PAYMENT_FAILED]:
        preferences.paymentAlerts ?? true,
      [PrismaNotificationType.PASSWORD_CHANGED]:
        preferences.systemAlerts ?? true,
      [PrismaNotificationType.ACCOUNT_CREATED]:
        preferences.systemAlerts ?? true,
      [PrismaNotificationType.PROMOTION_STARTED]:
        preferences.promotions ?? false,
    };

    return emailEnabledTypes[type] ?? false;
  }

  private async sendEmailNotification(
    notification: NotificationWithRelations | Notification
  ): Promise<boolean> {
    try {
      const user =
        "user" in notification
          ? notification.user
          : await prisma.user.findUnique({
              where: { id: notification.userId || "" },
            });

      if (!user?.email) return false;

      const template = await this.getTemplate(notification.type);

      // FALLBACK
      if (!template?.emailSubject || !template?.emailTemplate) {
        if (
          notification.priority === PrismaNotificationPriority.HIGH ||
          notification.priority === PrismaNotificationPriority.URGENT
        ) {
          await this.emailService.sendEmail({
            to: user.email,
            subject: notification.title,
            html: `<p>${notification.message}</p>`,
            text: notification.message,
          });
          return true;
        }
        return false;
      }

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

      return true;
    } catch (error) {
      logger.warn(
        "Failed to send email notification:",
        error instanceof Error ? error.message : "errore sconosciuto"
      );
      return false;
    }
  }
}

export default NotificationService;
