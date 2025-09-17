import type {
  User,
  Order,
  Product,
  Review,
  Notification,
  NotificationPreference,
  NotificationTemplate,
  WebSocketConnection,
  NotificationType as PrismaNotificationType,
  NotificationPriority as PrismaNotificationPriority,
  NotificationCategory as PrismaNotificationCategory,
  DeliveryMethod as PrismaDeliveryMethod,
} from "../generated/prisma";

// ===========================================
//                  ENUMS
// ===========================================

export const NotificationType = {
  // Order notifications
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_CONFIRMED: "ORDER_CONFIRMED",
  ORDER_PROCESSING: "ORDER_PROCESSING",
  ORDER_SHIPPED: "ORDER_SHIPPED",
  ORDER_DELIVERED: "ORDER_DELIVERED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  ORDER_REFUNDED: "ORDER_REFUNDED",

  // Payment notifications
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_REFUNDED: "PAYMENT_REFUNDED",

  // Product notifications
  PRODUCT_BACK_IN_STOCK: "PRODUCT_BACK_IN_STOCK",
  PRODUCT_PRICE_DROP: "PRODUCT_PRICE_DROP",
  PRODUCT_NEW_REVIEW: "PRODUCT_NEW_REVIEW",
  WISHLIST_ITEM_SALE: "WISHLIST_ITEM_SALE",

  // Review notifications
  REVIEW_SUBMITTED: "REVIEW_SUBMITTED",
  REVIEW_APPROVED: "REVIEW_APPROVED",
  REVIEW_REJECTED: "REVIEW_REJECTED",
  REVIEW_HELPFUL_VOTE: "REVIEW_HELPFUL_VOTE",

  // System notifications
  ACCOUNT_CREATED: "ACCOUNT_CREATED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  EMAIL_VERIFIED: "EMAIL_VERIFIED",
  PROFILE_UPDATED: "PROFILE_UPDATED",
  SYSTEM_NOTIFICATION: "SYSTEM_NOTIFICATION",

  // Admin notifications
  NEW_ORDER_ADMIN: "NEW_ORDER_ADMIN",
  LOW_STOCK_ALERT: "LOW_STOCK_ALERT",
  HIGH_VALUE_ORDER: "HIGH_VALUE_ORDER",
  SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY",
  SYSTEM_ERROR: "SYSTEM_ERROR",
  BACKUP_COMPLETED: "BACKUP_COMPLETED",

  // Marketing
  PROMOTION_STARTED: "PROMOTION_STARTED",
  DISCOUNT_EXPIRING: "DISCOUNT_EXPIRING",
  CART_ABANDONED: "CART_ABANDONED",
  WELCOME_SERIES: "WELCOME_SERIES",

  SUPPORT_TICKET_CREATED: "SUPPORT_TICKET_CREATED",
  SUPPORT_TICKET_ASSIGNED: "SUPPORT_TICKET_ASSIGNED",
  SUPPORT_TICKET_ESCALATED: "SUPPORT_TICKET_ESCALATED",
  SUPPORT_MESSAGE_RECEIVED: "SUPPORT_MESSAGE_RECEIVED",
  SUPPORT_TICKET_RESOLVED: "SUPPORT_TICKET_RESOLVED",
  SUPPORT_SLA_BREACH: "SUPPORT_SLA_BREACH",
  SUPPORT_SATISFACTION_SUBMITTED: "SUPPORT_SATISFACTION_SUBMITTED",
  SUPPORT_AGENT_CREATED: "SUPPORT_AGENT_CREATED",
  SUPPORT_ALERT: "SUPPORT_ALERT",
} as const;

export const NotificationPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;

export const NotificationCategory = {
  ORDER: "ORDER",
  PAYMENT: "PAYMENT",
  PRODUCT: "PRODUCT",
  REVIEW: "REVIEW",
  SYSTEM: "SYSTEM",
  ADMIN: "ADMIN",
  MARKETING: "MARKETING",
  SECURITY: "SECURITY",
} as const;

// DeliveryMethod come valore utilizzabile
export const DeliveryMethod = {
  WEBSOCKET: "WEBSOCKET",
  EMAIL: "EMAIL",
  PUSH: "PUSH",
  SMS: "SMS",
} as const;

// Type aliases derivati dai const objects
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
export type NotificationPriority =
  (typeof NotificationPriority)[keyof typeof NotificationPriority];
export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];
export type DeliveryMethod =
  (typeof DeliveryMethod)[keyof typeof DeliveryMethod];

// ===========================================
//             CORE INTERFACES
// ===========================================

export interface AuthenticatedUser {
  id: string;
  role: string;
  email: string;
}

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  data?: Record<string, unknown>;
  actionUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface NotificationData {
  userId?: string;
  type: PrismaNotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  category: NotificationCategory;
  data?: Record<string, unknown>;
  actionUrl?: string;
  expiresAt?: Date;
  scheduledFor?: Date;
  orderId?: string;
  productId?: string;
  reviewId?: string;
  source?: string;
}

export interface BulkNotificationData {
  userIds: string[];
  notification: Omit<NotificationData, "userId">;
}

// ===========================================
//            EXTENDED MODELS
// ===========================================

export interface UserWithOrder extends User {
  orders?: Order[];
}

export interface OrderWithUser extends Order {
  user: User;
}

export interface ProductWithWishlists extends Product {
  wishlists: Array<{
    userId: string;
    user: User;
  }>;
}

export interface ReviewWithRelations extends Review {
  user: User | null;
  product: Product;
}

export interface NotificationWithRelations extends Notification {
  user: User | null;
  order: Order | null;
  product: Product | null;
  review?: ReviewWithRelations | null;
}

// ===========================================
//           WEBSOCKET INTERFACES
// ===========================================

export interface SocketAuth {
  token: string;
}

export interface SocketHandshakeAuth {
  token?: string;
}

export interface SocketHandshakeHeaders {
  authorization?: string;
  "user-agent"?: string;
  [key: string]: string | undefined;
}

export interface SocketHandshake {
  auth?: SocketHandshakeAuth;
  headers: SocketHandshakeHeaders;
  address?: string;
}

export interface AuthenticatedSocket {
  id: string;
  userId: string;
  userRole: string;
  handshake: SocketHandshake;
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, data?: unknown) => void;
  disconnect: (close?: boolean) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
}

export interface ConnectionStats {
  totalConnections: number;
  onlineUsers: number;
  averageConnectionsPerUser: number;
}

// ===========================================
//          TEMPLATE INTERFACES
// ===========================================

export interface CreateTemplateData {
  type: NotificationType;
  category: NotificationCategory;
  websocketTitle: string;
  websocketMessage: string;
  emailSubject?: string;
  emailTemplate?: string;
  pushTitle?: string;
  pushMessage?: string;
  priority: NotificationPriority;
  requiresAction: boolean;
  autoExpire: boolean;
  expirationHours?: number;
  variables?: Record<string, unknown>;
}

export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined;
}

// ===========================================
//         PREFERENCES INTERFACES
// ===========================================

export interface QuietHours {
  start: string;
  end: string;
  timezone: string;
  [key: string]: unknown;
}

export interface NotificationPreferenceUpdate {
  enableWebSocket?: boolean;
  enableEmail?: boolean;
  enablePush?: boolean;
  orderUpdates?: boolean;
  paymentAlerts?: boolean;
  productUpdates?: boolean;
  reviewNotifications?: boolean;
  promotions?: boolean;
  systemAlerts?: boolean;
  inventoryAlerts?: boolean;
  quietHours?: QuietHours;
  instantDelivery?: boolean;
  batchDelivery?: boolean;
}

// ===========================================
//         PAGINATION INTERFACES
// ===========================================

export interface PaginationParams {
  page: number;
  limit: number;
  unreadOnly: boolean;
  category?: NotificationCategory;
  type?: NotificationType;
}

export interface PaginationResult {
  total: number;
  pages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface NotificationListResult {
  notifications: NotificationWithRelations[];
  pagination: PaginationResult;
}

// ===========================================
//            ADMIN INTERFACES
// ===========================================

export interface AdminQueryParams extends PaginationParams {
  userId?: string;
  priority?: NotificationPriority;
  isRead?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface AdminStats {
  total: number;
  unread: number;
  readRate: string;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  systemStats: {
    totalUsers: number;
    activeConnections: number;
    recentNotifications: number;
    deliveryRate: string;
  };
  deliveryStats: Record<string, number>;
}

// ===========================================
//          MARKETING INTERFACES
// ===========================================

export interface PromotionDetails {
  name: string;
  discountPercentage: number;
  validUntil: string;
  code: string;
}

export interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

export interface CartAbandonmentData {
  userId: string;
  cartItems: CartItem[];
  totalValue: number;
  itemCount: number;
}

// ===========================================
//            EMAIL INTERFACES
// ===========================================

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export interface EmailTemplateContext {
  userName?: string;
  orderNumber?: string;
  orderTotal?: string;
  currency?: string;
  productName?: string;
  amount?: string;
  paymentMethod?: string;
  reason?: string;
  [key: string]: string | undefined;
}

// ===========================================
//            ERROR INTERFACES
// ===========================================

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
  pagination?: PaginationResult;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ===========================================
//         VALIDATION INTERFACES
// ===========================================

export interface CreateNotificationRequest {
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
  actionUrl?: string;
  expiresAt?: string;
  scheduledFor?: string;
  orderId?: string;
  productId?: string;
  reviewId?: string;
}

export interface BulkNotificationRequest {
  userIds: string[];
  notification: Omit<
    CreateNotificationRequest,
    "orderId" | "productId" | "reviewId"
  >;
}

export interface UpdatePreferencesRequest {
  enableWebSocket?: boolean;
  enableEmail?: boolean;
  enablePush?: boolean;
  orderUpdates?: boolean;
  paymentAlerts?: boolean;
  productUpdates?: boolean;
  reviewNotifications?: boolean;
  promotions?: boolean;
  systemAlerts?: boolean;
  inventoryAlerts?: boolean;
  quietHours?: QuietHours;
  instantDelivery?: boolean;
  batchDelivery?: boolean;
}

// ===========================================
//           WEBHOOK INTERFACES
// ===========================================

export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  id: string;
}

export interface OrderWebhookData {
  orderId: string;
  userId: string;
  status: string;
  previousStatus?: string;
  total: number;
  currency: string;
}

export interface PaymentWebhookData {
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  status: "success" | "failed" | "pending";
  paymentMethod: string;
  failureReason?: string;
}

// ===========================================
//              TYPE GUARDS
// ===========================================

export function isNotificationWithRelations(
  notification: Notification | NotificationWithRelations
): notification is NotificationWithRelations {
  return (
    "user" in notification ||
    "order" in notification ||
    "product" in notification
  );
}

export function isAuthenticatedSocket(
  socket: unknown
): socket is AuthenticatedSocket {
  return (
    typeof socket === "object" &&
    socket !== null &&
    "userId" in socket &&
    "userRole" in socket
  );
}

export function isValidNotificationType(
  type: string
): type is NotificationType {
  return Object.values(NotificationType).includes(type as NotificationType);
}

export function isValidNotificationPriority(
  priority: string
): priority is NotificationPriority {
  return Object.values(NotificationPriority).includes(
    priority as NotificationPriority
  );
}

export function isValidNotificationCategory(
  category: string
): category is NotificationCategory {
  return Object.values(NotificationCategory).includes(
    category as NotificationCategory
  );
}

// ===========================================
//            UTILITY TYPES
// ===========================================

export type NotificationEventHandler = (
  notification: NotificationPayload
) => void | Promise<void>;

export type SocketEventHandler = (...args: unknown[]) => void | Promise<void>;

export type NotificationFilter = Partial<{
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  isRead: boolean;
  dateFrom: Date;
  dateTo: Date;
}>;

export type NotificationSort = {
  field: "createdAt" | "priority" | "type";
  direction: "asc" | "desc";
};

export type WebSocketChannel =
  | "orders"
  | "payments"
  | "products"
  | "reviews"
  | "system"
  | "admin";

// ===========================================
//               CONSTANTS
// ===========================================

export const NOTIFICATION_PRIORITIES = Object.values(NotificationPriority);
export const NOTIFICATION_TYPES = Object.values(NotificationType);
export const NOTIFICATION_CATEGORIES = Object.values(NotificationCategory);
export const DELIVERY_METHODS = Object.values(DeliveryMethod);

export const WEBSOCKET_CHANNELS: readonly WebSocketChannel[] = [
  "orders",
  "payments",
  "products",
  "reviews",
  "system",
  "admin",
] as const;

export const DEFAULT_PAGINATION_LIMIT = 20;
export const MAX_PAGINATION_LIMIT = 100;
export const MAX_BULK_NOTIFICATION_USERS = 1000;

export const RATE_LIMITS = {
  NOTIFICATION_GENERAL: { windowMs: 15 * 60 * 1000, max: 100 },
  NOTIFICATION_ADMIN: { windowMs: 15 * 60 * 1000, max: 200 },
  BULK_NOTIFICATIONS: { windowMs: 60 * 60 * 1000, max: 10 },
  MARK_READ: { windowMs: 1 * 60 * 1000, max: 50 },
} as const;

// ===========================================
//          RE-EXPORT PRISMA TYPES
// ===========================================

// Re-export Prisma types per compatibilità
export type {
  PrismaNotificationType,
  PrismaNotificationPriority,
  PrismaNotificationCategory,
  PrismaDeliveryMethod,
  User,
  Order,
  Product,
  Review,
  Notification,
  NotificationPreference,
  NotificationTemplate,
  WebSocketConnection,
};
