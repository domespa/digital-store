import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SupportRole,
  BusinessModel,
} from "../generated/prisma";

// ===== CONFIGURATION TYPES =====

export interface SupportConfig {
  mode: "internal" | "vendor" | "platform";
  escalationEnabled: boolean;
  chatEnabled: boolean;
  slaTracking: boolean;
  businessModel: BusinessModel;
  tenantId?: string;

  // SLA Configuration
  slaDefaults: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };

  businessHours: {
    start: string;
    end: string;
    days: string[];
    timezone: string;
  };

  autoAssignment: boolean;
  roundRobin: boolean;
  emailNotifications: boolean;

  rateLimits: {
    ticketsPerHour: number;
    ticketsPerDay: number;
    maxConcurrentTickets: number;
  };
}

// ===== TICKET =====

export interface CreateTicketRequest {
  subject: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  orderId?: string;
  productId?: string;
  attachments?: Express.Multer.File[];
  metadata?: Record<string, any>;
}

export interface UpdateTicketRequest {
  subject?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedToId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface TicketResponse {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  businessModel: BusinessModel;
  tenantId?: string;

  // RELAZIONI
  user: {
    id: string;
    name: string;
    email: string;
  };

  assignedTo?: {
    id: string;
    name: string;
    email: string;
    role: SupportRole;
  };

  vendor?: {
    id: string;
    name: string;
    email: string;
  };

  order?: {
    id: string;
    orderNumber: string;
  };

  product?: {
    id: string;
    name: string;
  };

  messages: SupportMessageResponse[];
  attachments: SupportAttachmentResponse[];

  // SLA
  sla?: {
    firstResponseDue: Date;
    resolutionDue: Date;
    firstResponseMet: boolean;
    resolutionMet: boolean;
    breaches: {
      firstResponse: boolean;
      resolution: boolean;
      totalBreachTime: number;
    };
  };

  // Satisfaction
  satisfaction?: {
    rating: number;
    feedback?: string;
    detailedRatings: {
      responseTime?: number;
      helpfulness?: number;
      professionalism?: number;
      resolution?: number;
    };
  };

  // Metadata
  tags: string[];
  metadata: Record<string, any>;
  escalationHistory?: EscalationHistoryItem[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  firstResponseAt?: Date;
  lastResponseAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

export interface TicketListResponse {
  tickets: TicketResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    status?: TicketStatus[];
    priority?: TicketPriority[];
    category?: TicketCategory[];
    assignedTo?: string[];
    dateRange?: {
      from: Date;
      to: Date;
    };
  };
  sorting: {
    field: string;
    direction: "asc" | "desc";
  };
}

// ===== MESSAGE TYPES =====

export interface CreateMessageRequest {
  content: string;
  isInternal?: boolean;
  attachments?: Express.Multer.File[];
}

export interface SupportMessageResponse {
  id: string;
  content: string;
  isInternal: boolean;

  author: {
    id: string;
    name: string;
    email: string;
    role: SupportRole;
  };

  attachments: SupportAttachmentResponse[];
  readBy: MessageReadStatus[];

  createdAt: Date;
  updatedAt: Date;
}

export interface MessageReadStatus {
  userId: string;
  userName: string;
  readAt: Date;
}

// ===== ATTACHMENT TYPES =====

export interface SupportAttachmentResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;

  uploadedBy: {
    id: string;
    name: string;
  };

  createdAt: Date;
}

// ===== ESCALATION TYPES =====

export interface EscalateTicketRequest {
  reason: string;
  escalateTo?: string;
  priority?: TicketPriority;
  addMessage?: string;
}

export interface EscalationHistoryItem {
  id: string;
  escalatedAt: Date;
  escalatedFrom: string;
  escalatedTo: string;
  reason: string;
  escalatedBy: {
    id: string;
    name: string;
  };
}

// ===== AGENT =====

export interface SupportAgentResponse {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };

  role: SupportRole;
  businessModel: BusinessModel;
  tenantId?: string;
  categories: TicketCategory[];
  maxConcurrentTickets: number;

  status: {
    isActive: boolean;
    isAvailable: boolean;
    currentTickets: number;
  };

  metrics: {
    totalTickets: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    satisfactionRating: number;
    slaCompliance: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentRequest {
  userId: string;
  role: SupportRole;
  categories?: TicketCategory[];
  maxConcurrentTickets?: number;
}

export interface UpdateAgentRequest {
  role?: SupportRole;
  categories?: TicketCategory[];
  maxConcurrentTickets?: number;
  isActive?: boolean;
  isAvailable?: boolean;
}

// ===== SATISFACTION =====

export interface SubmitSatisfactionRequest {
  rating: number;
  feedback?: string;
  detailedRatings?: {
    responseTime?: number;
    helpfulness?: number;
    professionalism?: number;
    resolution?: number;
  };
}

// ===== SEARCH & FILTER =====

export interface TicketSearchFilters {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  category?: TicketCategory[];
  assignedTo?: string[];
  user?: string;
  businessModel?: BusinessModel;
  tenantId?: string;

  // DATA
  createdFrom?: Date;
  createdTo?: Date;
  updatedFrom?: Date;
  updatedTo?: Date;

  // TESTO
  search?: string;
  tags?: string[];

  // SLA
  slaBreached?: boolean;
  overdueOnly?: boolean;

  // RELAZIONI
  orderId?: string;
  productId?: string;
}

export interface TicketSortOptions {
  field: "createdAt" | "updatedAt" | "priority" | "status" | "lastResponseAt";
  direction: "asc" | "desc";
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

// ===== ANALYTICS TYPES =====

export interface SupportAnalyticsResponse {
  overview: {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    slaCompliance: number;
    customerSatisfaction: number;
  };

  trends: {
    period: "day" | "week" | "month";
    data: Array<{
      date: string;
      ticketsCreated: number;
      ticketsResolved: number;
      avgResponseTime: number;
      slaBreaches: number;
    }>;
  };

  breakdown: {
    byStatus: Record<TicketStatus, number>;
    byPriority: Record<TicketPriority, number>;
    byCategory: Record<TicketCategory, number>;
    byAgent: Array<{
      agentId: string;
      agentName: string;
      ticketsHandled: number;
      avgResponseTime: number;
      satisfactionRating: number;
    }>;
  };

  performance: {
    slaMetrics: {
      firstResponseSLA: {
        target: number;
        actual: number;
        compliance: number;
      };
      resolutionSLA: {
        target: number;
        actual: number;
        compliance: number;
      };
    };

    satisfactionMetrics: {
      averageRating: number;
      responseRate: number;
      breakdown: Record<number, number>;
    };
  };
}

export interface AnalyticsFilters {
  businessModel?: BusinessModel;
  tenantId?: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  agentId?: string;
  category?: TicketCategory;
}

// ===== REAL-TIME TYPES =====

export interface SupportWebSocketEvent {
  type:
    | "ticket_created"
    | "ticket_updated"
    | "message_created"
    | "ticket_assigned"
    | "escalation";
  ticketId: string;
  data: any;
  timestamp: Date;
  userId?: string; // EVENTO
}

export interface ChatMessage {
  id: string;
  ticketId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: SupportRole;
  timestamp: Date;
  isInternal: boolean;
  attachments?: SupportAttachmentResponse[];
}

// ===== ERROR TYPES =====

export interface SupportError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export const SupportErrorCodes = {
  TICKET_NOT_FOUND: "TICKET_NOT_FOUND",
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  SLA_CONFIG_MISSING: "SLA_CONFIG_MISSING",
  AGENT_NOT_AVAILABLE: "AGENT_NOT_AVAILABLE",
  ESCALATION_NOT_ALLOWED: "ESCALATION_NOT_ALLOWED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  ATTACHMENT_TOO_LARGE: "ATTACHMENT_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  TICKET_ALREADY_CLOSED: "TICKET_ALREADY_CLOSED",
  SATISFACTION_ALREADY_SUBMITTED: "SATISFACTION_ALREADY_SUBMITTED",
} as const;

// ===== UTILITY TYPES =====

export type TicketTransition = {
  from: TicketStatus;
  to: TicketStatus;
  allowedRoles: SupportRole[];
  requiresReason?: boolean;
};

export type BusinessModelConfig = {
  [K in BusinessModel]: {
    roles: SupportRole[];
    escalationFlow: SupportRole[];
    features: {
      chat: boolean;
      sla: boolean;
      escalation: boolean;
      satisfaction: boolean;
    };
    defaultSLA: Record<TicketPriority, number>;
  };
};

// ===== REQUEST/RESPONSE WRAPPERS =====

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: SupportError;
  meta?: {
    timestamp: Date;
    requestId: string;
  };
}

export interface ListApiResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ===== WEBHOOK TYPES =====

export interface SupportWebhookPayload {
  event: string;
  ticketId: string;
  businessModel: BusinessModel;
  tenantId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

export type SupportWebhookEvent =
  | "ticket.created"
  | "ticket.updated"
  | "ticket.assigned"
  | "ticket.escalated"
  | "ticket.resolved"
  | "ticket.closed"
  | "message.created"
  | "satisfaction.submitted"
  | "sla.breached";
