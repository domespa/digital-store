import { Server, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PrismaClient } from "../generated/prisma";
import {
  NotificationType,
  NotificationPriority,
  DeliveryMethod,
  NotificationPayload,
  QuietHours,
} from "../types/notifications";
import { logger } from "../utils/logger";
import { CustomError } from "../utils/customError";
import { prisma } from "../utils/prisma";

// ===========================================
//               TYPES & INTERFACES
// ===========================================

interface AuthenticatedSocket extends Socket {
  userId: string;
  userRole: string;
}

interface SocketAuth {
  token: string;
}

interface JwtDecoded extends JwtPayload {
  userId: string;
}

interface SocketHandshakeAuth {
  token?: string;
}

interface SocketHandshakeHeaders {
  authorization?: string;
  "user-agent"?: string;
}

interface SocketHandshake {
  auth?: SocketHandshakeAuth;
  headers: SocketHandshakeHeaders;
  address?: string;
}

// ===========================================
//          WEBSOCKET SERVICE CLASS
// ===========================================

class WebSocketService {
  private io: Server;
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private socketToUser = new Map<string, string>(); // socketId -> userId
  private heartbeatInterval!: NodeJS.Timeout; // Definite assignment assertion

  constructor(httpServer: HTTPServer) {
    // ===========================================
    //              INITIALIZATION
    // ===========================================

    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupHeartbeat();
    this.setupCleanupTasks();
  }

  // ===========================================
  //              MIDDLEWARE SETUP
  // ===========================================

  private setupMiddleware(): void {
    // AUTHENTICATION MIDDLEWARE
    this.io.use(async (socket: Socket, next: (err?: Error) => void) => {
      try {
        const handshake = socket.handshake as SocketHandshake;
        const token =
          handshake.auth?.token ||
          handshake.headers?.authorization?.replace("Bearer ", "");

        console.log("🔍 WEBSOCKET AUTH DEBUG:", {
          hasToken: !!token,
          tokenLength: token?.length,
          authMethod: handshake.auth?.token ? "auth.token" : "header",
        });

        if (!token) {
          throw new CustomError("Authentication token required", 401);
        }

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET!
        ) as JwtDecoded;

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            role: true,
            emailVerified: true,
          },
        });

        console.log("🔍 FOUND USER:", user);

        // CONTROLLO SE L'UTENTE ESISTE ED È VERIFICATO
        if (!user) {
          throw new CustomError("User not found", 401);
        }

        if (!user.emailVerified && user.role !== "ADMIN") {
          throw new CustomError("User not verified", 401);
        }

        const authenticatedSocket = socket as AuthenticatedSocket;
        authenticatedSocket.userId = user.id;
        authenticatedSocket.userRole = user.role;
        next();
      } catch (error) {
        logger.error(
          "WebSocket authentication failed:",
          error instanceof Error ? error.message : String(error)
        );
        next(new Error("Authentication failed"));
      }
    });

    // RATE LIMITING MIDDLEWARE
    this.io.use(async (socket: Socket, next: (err?: Error) => void) => {
      const authenticatedSocket = socket as AuthenticatedSocket;
      const userConnections =
        this.connectedUsers.get(authenticatedSocket.userId)?.size || 0;
      const maxConnections = authenticatedSocket.userRole === "ADMIN" ? 10 : 5;

      if (userConnections >= maxConnections) {
        next(new Error("Maximum connections exceeded"));
        return;
      }

      next();
    });
  }

  // ===========================================
  //            EVENT HANDLERS SETUP
  // ===========================================

  private setupEventHandlers(): void {
    this.io.on("connection", async (socket: Socket) => {
      const authenticatedSocket = socket as AuthenticatedSocket;

      try {
        await this.handleConnection(authenticatedSocket);

        // CHANNEL SUBSCRIPTION
        authenticatedSocket.on("subscribe", async (channels: string[]) => {
          await this.handleSubscription(authenticatedSocket, channels);
        });

        authenticatedSocket.on("unsubscribe", async (channels: string[]) => {
          await this.handleUnsubscription(authenticatedSocket, channels);
        });

        // NOTIFICATION ACTIONS
        authenticatedSocket.on("mark_read", async (notificationId: string) => {
          await this.markNotificationRead(
            authenticatedSocket.userId,
            notificationId
          );
        });

        authenticatedSocket.on("mark_all_read", async () => {
          await this.markAllNotificationsRead(authenticatedSocket.userId);
        });

        authenticatedSocket.on(
          "get_unread_count",
          async (callback: (response: { count: number }) => void) => {
            const count = await this.getUnreadCount(authenticatedSocket.userId);
            callback({ count });
          }
        );

        // HEARTBEAT/PING HANDLING
        authenticatedSocket.on("ping", () => {
          authenticatedSocket.emit("pong");
          this.updateLastPing(authenticatedSocket.id);
        });

        // DISCONNECTION HANDLING
        authenticatedSocket.on("disconnect", async (reason: string) => {
          await this.handleDisconnection(authenticatedSocket, reason);
        });

        // ERROR HANDLING
        authenticatedSocket.on("error", (error: Error) => {
          logger.error(
            `Socket error for user ${authenticatedSocket.userId}:`,
            error
          );
        });
      } catch (error) {
        logger.error(
          "Connection setup failed:",
          error instanceof Error ? error.message : String(error)
        );
        authenticatedSocket.disconnect(true);
      }
    });
  }

  // ===========================================
  //           CONNECTION MANAGEMENT
  // ===========================================

  private async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const { userId } = socket;

    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socket.id);
    this.socketToUser.set(socket.id, userId);

    try {
      const handshake = socket.handshake as SocketHandshake;
      await prisma.webSocketConnection.create({
        data: {
          userId,
          socketId: socket.id,
          userAgent: handshake.headers["user-agent"] || null,
          ipAddress: handshake.address || null,
          isActive: true,
        },
      });
    } catch (error) {
      logger.warn(
        "WebSocketConnection table not found, skipping database save"
      );
    }

    socket.join(`user:${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === "ADMIN") {
      socket.join("admin");
    }

    logger.info(`User ${userId} connected with socket ${socket.id}`);

    // INVIA DATI INIZIALI
    const unreadCount = await this.getUnreadCount(userId);
    socket.emit("connection_established", {
      message: "Connected successfully",
      unreadCount,
    });
  }

  private async handleSubscription(
    socket: AuthenticatedSocket,
    channels: string[]
  ): Promise<void> {
    const validChannels = [
      "orders",
      "payments",
      "products",
      "reviews",
      "system",
      "admin",
    ];
    const subscribedChannels = channels.filter((ch) =>
      validChannels.includes(ch)
    );

    for (const channel of subscribedChannels) {
      if (channel === "admin" && socket.userRole !== "ADMIN") {
        continue;
      }
      socket.join(channel);
    }

    // AGGIORNA DATABASE
    try {
      await prisma.webSocketConnection.updateMany({
        where: { userId: socket.userId, socketId: socket.id },
        data: {
          subscribedChannels: subscribedChannels,
        },
      });
    } catch (error) {
      logger.warn("Failed to update subscribed channels");
    }

    socket.emit("subscription_updated", {
      subscribedChannels,
      message: "Subscriptions updated successfully",
    });
  }

  private async handleUnsubscription(
    socket: AuthenticatedSocket,
    channels: string[]
  ): Promise<void> {
    for (const channel of channels) {
      socket.leave(channel);
    }

    // AGGIORNA DATABASE
    try {
      const connection = await prisma.webSocketConnection.findUnique({
        where: { socketId: socket.id },
      });

      if (connection?.subscribedChannels) {
        const currentChannels = connection.subscribedChannels as string[];
        const remainingChannels = currentChannels.filter(
          (ch) => !channels.includes(ch)
        );

        await prisma.webSocketConnection.update({
          where: { socketId: socket.id },
          data: { subscribedChannels: remainingChannels },
        });
      }
    } catch (error) {
      logger.warn("Failed to update unsubscribed channels");
    }
  }

  private async handleDisconnection(
    socket: AuthenticatedSocket,
    reason: string
  ): Promise<void> {
    const { userId } = socket;

    // RIMUOVI DAL TRACKING
    this.connectedUsers.get(userId)?.delete(socket.id);
    if (this.connectedUsers.get(userId)?.size === 0) {
      this.connectedUsers.delete(userId);
    }
    this.socketToUser.delete(socket.id);

    // AGGIORNA DATABASE
    try {
      await prisma.webSocketConnection.updateMany({
        where: { socketId: socket.id },
        data: {
          isActive: false,
          disconnectedAt: new Date(),
        },
      });
    } catch (error) {
      logger.warn("Failed to update disconnection in database");
    }

    logger.info(`User ${userId} disconnected: ${reason}`);
  }

  // ===========================================
  //          NOTIFICATION SENDING
  // ===========================================

  // INVIA NOTIFICA A UTENTE SPECIFICO
  async sendNotificationToUser(
    userId: string,
    notification: NotificationPayload
  ): Promise<boolean> {
    try {
      // CONTROLLA PREFERENZE UTENTE
      let preferences: {
        enableWebSocket: boolean;
        quietHours?: unknown;
      } | null = null;

      try {
        preferences = await prisma.notificationPreference.findUnique({
          where: { userId },
        });
      } catch (error) {
        preferences = { enableWebSocket: true };
      }

      if (!preferences?.enableWebSocket) {
        return false;
      }

      // CONTROLLA QUIET HOURS
      if (preferences.quietHours) {
        const parsedQuietHours = this.parseQuietHours(preferences.quietHours);
        if (parsedQuietHours && this.isQuietHour(parsedQuietHours)) {
          return false;
        }
      }

      // INVIA A TUTTI I SOCKET DELL'UTENTE CONNESSI
      this.io.to(`user:${userId}`).emit("notification", notification);

      try {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            isDelivered: true,
            deliveredAt: new Date(),
            deliveryMethod: DeliveryMethod.WEBSOCKET,
          },
        });
      } catch (error) {
        logger.warn("Failed to mark notification as delivered");
      }

      return true;
    } catch (error) {
      logger.error(
        `Failed to send notification to user ${userId}:`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  // INVIA NOTIFICA A CHANNEL
  async sendNotificationToChannel(
    channel: string,
    notification: NotificationPayload,
    excludeUser?: string
  ): Promise<boolean> {
    try {
      const socket = excludeUser
        ? this.io.to(channel).except(`user:${excludeUser}`)
        : this.io.to(channel);

      socket.emit("notification", notification);

      logger.info(`Notification sent to channel ${channel}`);
      return true;
    } catch (error) {
      logger.error(
        `Failed to send notification to channel ${channel}:`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  // INVIA NOTIFICA AGLI ADMIN
  async sendNotificationToAdmins(
    notification: NotificationPayload
  ): Promise<boolean> {
    return this.sendNotificationToChannel("admin", notification);
  }

  // BROADCAST NOTIFICA DI SISTEMA
  async broadcastSystemNotification(
    notification: NotificationPayload
  ): Promise<void> {
    this.io.emit("system_notification", notification);
    logger.info("System notification broadcasted");
  }

  // ===========================================
  //           NOTIFICATION UTILITIES
  // ===========================================

  private async markNotificationRead(
    userId: string,
    notificationId: string
  ): Promise<void> {
    try {
      await prisma.notification.updateMany({
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

      // INVIA CONTEGGIO NON LETTI AGGIORNATO
      const unreadCount = await this.getUnreadCount(userId);
      this.io
        .to(`user:${userId}`)
        .emit("unread_count_updated", { count: unreadCount });
    } catch (error) {
      logger.warn("Failed to mark notification as read");
    }
  }

  private async markAllNotificationsRead(userId: string): Promise<void> {
    try {
      await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      this.io.to(`user:${userId}`).emit("unread_count_updated", { count: 0 });
    } catch (error) {
      logger.warn("Failed to mark all notifications as read");
    }
  }

  private async getUnreadCount(userId: string): Promise<number> {
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

  private updateLastPing(socketId: string): void {
    prisma.webSocketConnection
      .updateMany({
        where: { socketId },
        data: { lastPing: new Date() },
      })
      .catch(() => {});
  }

  // ===========================================
  //           HELPER METHODS
  // ===========================================

  private isQuietHour(quietHours: QuietHours | null): boolean {
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

  // HELPER METHOD PER PARSARE SAFELY
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
  //         MAINTENANCE & MONITORING
  // ===========================================

  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const staleConnections = await prisma.webSocketConnection.findMany({
          where: {
            isActive: true,
            lastPing: {
              lt: new Date(Date.now() - 90000), // 90 SECONDS AGO
            },
          },
        });

        for (const connection of staleConnections) {
          const socket = this.io.sockets.sockets.get(connection.socketId);
          if (socket) {
            socket.disconnect(true);
          } else {
            // CLEAN UP ORPHANED DATABASE RECORD
            await prisma.webSocketConnection.update({
              where: { id: connection.id },
              data: { isActive: false, disconnectedAt: new Date() },
            });
          }
        }
      } catch (error) {}
    }, 60000); // OGNI MINUTO
  }

  private setupCleanupTasks(): void {
    setInterval(async () => {
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        await prisma.webSocketConnection.deleteMany({
          where: {
            isActive: false,
            disconnectedAt: {
              lt: oneDayAgo,
            },
          },
        });
      } catch (error) {}
    }, 60 * 60 * 1000); // EVERY HOUR
  }

  // ===========================================
  //           CONNECTION STATUS
  // ===========================================

  // CONTROLLA SE UTENTE È ONLINE
  isUserOnline(userId: string): boolean {
    return (
      this.connectedUsers.has(userId) &&
      this.connectedUsers.get(userId)!.size > 0
    );
  }

  // CONTEGGIO UTENTI ONLINE
  getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }

  // CONTEGGIO CONNESSIONI UTENTE
  getUserConnectionCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }

  // STATISTICHE CONNESSIONI
  async getConnectionStats(): Promise<{
    totalConnections: number;
    onlineUsers: number;
    averageConnectionsPerUser: number;
  }> {
    try {
      const totalConnections = await prisma.webSocketConnection.count({
        where: { isActive: true },
      });

      const onlineUsers = this.connectedUsers.size;

      return {
        totalConnections,
        onlineUsers,
        averageConnectionsPerUser:
          onlineUsers > 0 ? totalConnections / onlineUsers : 0,
      };
    } catch (error) {
      return {
        totalConnections: 0,
        onlineUsers: this.connectedUsers.size,
        averageConnectionsPerUser: 0,
      };
    }
  }

  // ===========================================
  //              CLEANUP METHOD
  // ===========================================

  // CLEANUP METHOD
  async cleanup(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // MARCA TUTTE LE CONNESSIONI ATTIVE COME INACTIVE
    try {
      await prisma.webSocketConnection.updateMany({
        where: { isActive: true },
        data: {
          isActive: false,
          disconnectedAt: new Date(),
        },
      });
    } catch (error) {
      // SILENTLY FAIL
    }

    this.io.close();
  }
}

export default WebSocketService;
