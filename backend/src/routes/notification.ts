import { Router } from "express";
import NotificationController from "../controllers/notificationController";
import NotificationService from "../services/notificationService";
import WebSocketService from "../services/websocketService";
import EmailService from "../services/emailService";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import {
  notificationLimiter,
  adminNotificationLimiter,
  bulkNotificationLimiter,
  markReadLimiter,
  testNotificationLimiter,
} from "../middleware/rateLimiting";

export function createNotificationRoutes(
  webSocketService: WebSocketService
): Router {
  const router = Router();

  const emailService = new EmailService();
  const notificationService = new NotificationService(
    webSocketService,
    emailService
  );
  const notificationController = new NotificationController(
    notificationService
  );

  router.use(authenticateToken);

  // ===========================================
  //                USER ROUTES
  // ===========================================

  // GET /api/notifications
  router.get("/", notificationLimiter, notificationController.getNotifications);

  // GET /api/notifications/count
  router.get(
    "/count",
    notificationLimiter,
    notificationController.getUnreadCount
  );

  // GET /api/notifications/stats
  router.get("/stats", notificationLimiter, notificationController.getStats);

  // GET /api/notifications/preferences
  router.get(
    "/preferences",
    notificationLimiter,
    notificationController.getPreferences
  );

  // PUT /api/notifications/preferences
  router.put(
    "/preferences",
    notificationLimiter,
    notificationController.updatePreferences
  );

  // PUT /api/notifications/:id/read
  router.put("/:id/read", markReadLimiter, notificationController.markAsRead);

  // PUT /api/notifications/read-all
  router.put(
    "/read-all",
    markReadLimiter,
    notificationController.markAllAsRead
  );

  // DELETE /api/notifications/:id
  router.delete(
    "/:id",
    notificationLimiter,
    notificationController.deleteNotification
  );

  // ===========================================
  //             ADMIN ROUTES
  // ===========================================

  // POST /api/notifications/admin/create/:userId?
  router.post(
    "/admin/create/:userId?",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.createNotification
  );

  // POST /api/notifications/admin/bulk
  router.post(
    "/admin/bulk",
    requireAdmin,
    bulkNotificationLimiter,
    notificationController.sendBulkNotifications
  );

  // GET /api/notifications/admin/all
  router.get(
    "/admin/all",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.getAllNotifications
  );

  // GET /api/notifications/admin/stats
  router.get(
    "/admin/stats",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.getGlobalStats
  );

  // POST /api/notifications/admin/test
  router.post(
    "/admin/test",
    requireAdmin,
    testNotificationLimiter,
    notificationController.sendTestNotification
  );

  // POST /api/notifications/admin/process-scheduled
  router.post(
    "/admin/process-scheduled",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.processScheduledNotifications
  );

  // DELETE /api/notifications/admin/cleanup-expired
  router.delete(
    "/admin/cleanup-expired",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.cleanupExpiredNotifications
  );

  // GET /api/notifications/admin/connections
  router.get(
    "/admin/connections",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.getConnectionStats
  );

  // ===========================================
  //           TEMPLATE MANAGEMENT ROUTES
  // ===========================================

  // POST /api/notifications/admin/templates
  router.post(
    "/admin/templates",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.createTemplate
  );

  // GET /api/notifications/admin/templates
  router.get(
    "/admin/templates",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.getTemplates
  );

  // PUT /api/notifications/admin/templates/:id
  router.put(
    "/admin/templates/:id",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.updateTemplate
  );

  // DELETE /api/notifications/admin/templates/:id
  router.delete(
    "/admin/templates/:id",
    requireAdmin,
    adminNotificationLimiter,
    notificationController.deleteTemplate
  );

  return router;
}
