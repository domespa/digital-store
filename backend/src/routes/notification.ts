import { Router } from "express";
import { Server as HTTPServer } from "http";
import NotificationController from "../controllers/notificationController";
import NotificationService from "../services/notificationService";
import WebSocketService from "../services/websocketService";
import EmailService from "../services/emailService";
import { authenticateToken, requireAdmin } from "../middleware/auth";

// Interfaccia comune per WebSocket service
interface IWebSocketService {
  sendNotificationToUser(
    userId: string,
    notification: unknown
  ): Promise<boolean>;
  sendNotificationToAdmins(notification: unknown): Promise<boolean>;
  sendNotificationToChannel(
    channel: string,
    notification: unknown,
    excludeUser?: string
  ): Promise<boolean>;
  broadcastSystemNotification(notification: unknown): Promise<void>;
  isUserOnline(userId: string): boolean;
  getOnlineUsersCount(): number;
  getUserConnectionCount(userId: string): number;
  getConnectionStats(): Promise<{
    totalConnections: number;
    onlineUsers: number;
    averageConnectionsPerUser: number;
  }>;
  cleanup(): Promise<void>;
}

// Mock WebSocket service implementation
class MockWebSocketService implements IWebSocketService {
  async sendNotificationToUser(): Promise<boolean> {
    return true;
  }

  async sendNotificationToAdmins(): Promise<boolean> {
    return true;
  }

  async sendNotificationToChannel(): Promise<boolean> {
    return true;
  }

  async broadcastSystemNotification(): Promise<void> {
    // Mock implementation
  }

  isUserOnline(): boolean {
    return false;
  }

  getOnlineUsersCount(): number {
    return 0;
  }

  getUserConnectionCount(): number {
    return 0;
  }

  async getConnectionStats(): Promise<{
    totalConnections: number;
    onlineUsers: number;
    averageConnectionsPerUser: number;
  }> {
    return {
      totalConnections: 0,
      onlineUsers: 0,
      averageConnectionsPerUser: 0,
    };
  }

  async cleanup(): Promise<void> {
    // Mock implementation
  }
}

function setupRoutes(
  router: Router,
  notificationController: NotificationController
): void {
  // Apply authentication middleware to all routes
  router.use(authenticateToken);

  // ===========================================
  //                USER ROUTES
  // ===========================================

  /**
   * @route GET /api/notifications
   * @desc Get user notifications with filtering and pagination
   * @access Private
   * @query page, limit, unreadOnly, category, type
   */
  router.get("/", notificationController.getNotifications);

  /**
   * @route GET /api/notifications/count
   * @desc Get unread notifications count
   * @access Private
   */
  router.get("/count", notificationController.getUnreadCount);

  /**
   * @route GET /api/notifications/stats
   * @desc Get user notification statistics
   * @access Private
   */
  router.get("/stats", notificationController.getStats);

  /**
   * @route GET /api/notifications/preferences
   * @desc Get user notification preferences
   * @access Private
   */
  router.get("/preferences", notificationController.getPreferences);

  /**
   * @route PUT /api/notifications/preferences
   * @desc Update user notification preferences
   * @access Private
   */
  router.put("/preferences", notificationController.updatePreferences);

  /**
   * @route PUT /api/notifications/:id/read
   * @desc Mark notification as read
   * @access Private
   */
  router.put("/:id/read", notificationController.markAsRead);

  /**
   * @route PUT /api/notifications/read-all
   * @desc Mark all notifications as read
   * @access Private
   */
  router.put("/read-all", notificationController.markAllAsRead);

  /**
   * @route DELETE /api/notifications/:id
   * @desc Delete notification
   * @access Private
   */
  router.delete("/:id", notificationController.deleteNotification);

  // ===========================================
  //                ADMIN ROUTES
  // ===========================================

  /**
   * @route POST /api/notifications/admin/create/:userId?
   * @desc Create notification for specific user or system notification
   * @access Admin
   */
  router.post(
    "/admin/create/:userId?",
    requireAdmin,
    notificationController.createNotification
  );

  /**
   * @route POST /api/notifications/admin/bulk
   * @desc Send bulk notifications
   * @access Admin
   */
  router.post(
    "/admin/bulk",
    requireAdmin,
    notificationController.sendBulkNotifications
  );

  /**
   * @route GET /api/notifications/admin/all
   * @desc Get all notifications with advanced filtering
   * @access Admin
   * @query page, limit, userId, category, type, priority, isRead, dateFrom, dateTo, search
   */
  router.get(
    "/admin/all",
    requireAdmin,
    notificationController.getAllNotifications
  );

  /**
   * @route GET /api/notifications/admin/stats
   * @desc Get global notification statistics
   * @access Admin
   */
  router.get(
    "/admin/stats",
    requireAdmin,
    notificationController.getGlobalStats
  );

  /**
   * @route POST /api/notifications/admin/test
   * @desc Send test notification
   * @access Admin
   */
  router.post(
    "/admin/test",
    requireAdmin,
    notificationController.sendTestNotification
  );

  /**
   * @route POST /api/notifications/admin/process-scheduled
   * @desc Process scheduled notifications manually
   * @access Admin
   */
  router.post(
    "/admin/process-scheduled",
    requireAdmin,
    notificationController.processScheduledNotifications
  );

  /**
   * @route DELETE /api/notifications/admin/cleanup-expired
   * @desc Cleanup expired notifications
   * @access Admin
   */
  router.delete(
    "/admin/cleanup-expired",
    requireAdmin,
    notificationController.cleanupExpiredNotifications
  );

  /**
   * @route GET /api/notifications/admin/connections
   * @desc Get WebSocket connection statistics
   * @access Admin
   */
  router.get(
    "/admin/connections",
    requireAdmin,
    notificationController.getConnectionStats
  );

  // ===========================================
  //           TEMPLATE MANAGEMENT ROUTES
  // ===========================================

  /**
   * @route POST /api/notifications/admin/templates
   * @desc Create notification template
   * @access Admin
   */
  router.post(
    "/admin/templates",
    requireAdmin,
    notificationController.createTemplate
  );

  /**
   * @route GET /api/notifications/admin/templates
   * @desc Get all notification templates
   * @access Admin
   */
  router.get(
    "/admin/templates",
    requireAdmin,
    notificationController.getTemplates
  );

  /**
   * @route PUT /api/notifications/admin/templates/:id
   * @desc Update notification template
   * @access Admin
   */
  router.put(
    "/admin/templates/:id",
    requireAdmin,
    notificationController.updateTemplate
  );

  /**
   * @route DELETE /api/notifications/admin/templates/:id
   * @desc Delete notification template
   * @access Admin
   */
  router.delete(
    "/admin/templates/:id",
    requireAdmin,
    notificationController.deleteTemplate
  );
}

/**
 * Create notification routes with real WebSocket service
 * @param httpServer HTTP server instance for WebSocket
 * @returns Configured router
 */
export function createNotificationRoutes(httpServer: HTTPServer): Router {
  const router = Router();

  // Initialize services with real WebSocket
  const emailService = new EmailService();
  const webSocketService = new WebSocketService(httpServer);
  const notificationService = new NotificationService(
    webSocketService,
    emailService
  );
  const notificationController = new NotificationController(
    notificationService
  );

  setupRoutes(router, notificationController);

  return router;
}

/**
 * Create notification routes without WebSocket (for testing or environments where WebSocket is not needed)
 * @returns Configured router with mock WebSocket service
 */
export function createNotificationRoutesWithoutWebSocket(): Router {
  const router = Router();

  // Initialize services with mock WebSocket
  const emailService = new EmailService();
  const mockWebSocketService = new MockWebSocketService();
  const notificationService = new NotificationService(
    mockWebSocketService as any,
    emailService
  );
  const notificationController = new NotificationController(
    notificationService
  );

  setupRoutes(router, notificationController);

  return router;
}

/**
 * Create notification routes with optional WebSocket service
 * @param httpServer Optional HTTP server instance for WebSocket
 * @param webSocketService Optional WebSocket service instance
 * @returns Configured router
 */
export function createNotificationRoutesFlexible(
  httpServer?: HTTPServer,
  webSocketService?: IWebSocketService
): Router {
  const router = Router();

  // Initialize services
  const emailService = new EmailService();

  let wsService: IWebSocketService;
  if (webSocketService) {
    wsService = webSocketService;
  } else if (httpServer) {
    wsService = new WebSocketService(httpServer);
  } else {
    wsService = new MockWebSocketService();
  }

  const notificationService = new NotificationService(
    wsService as WebSocketService,
    emailService
  );
  const notificationController = new NotificationController(
    notificationService
  );

  setupRoutes(router, notificationController);

  return router;
}

// Export di default per sviluppo (senza WebSocket)
const router = createNotificationRoutesWithoutWebSocket();
export default router;
