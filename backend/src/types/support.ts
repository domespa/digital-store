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

export interface AnalyticsOverview {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionRating: number;
  slaCompliance: number;
  periodComparison: {
    tickets: { current: number; previous: number; change: number };
    responseTime: { current: number; previous: number; change: number };
    satisfaction: { current: number; previous: number; change: number };
  };
}

export interface TrendData {
  date: string;
  ticketsCreated: number;
  ticketsResolved: number;
  avgResponseTime: number;
  slaBreaches: number;
  satisfactionRating: number;
}

export interface PerformanceMetrics {
  agentId: string;
  agentName: string;
  ticketsAssigned: number;
  ticketsResolved: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionRating: number;
  slaCompliance: number;
  workloadScore: number;
  categories: TicketCategory[];
  currentTickets: number;
}

export interface SLAMetrics {
  firstResponseSLA: {
    target: number;
    actual: number;
    compliance: number;
    breaches: number;
  };
  resolutionSLA: {
    target: number;
    actual: number;
    compliance: number;
    breaches: number;
  };
  totalBreachTime: number;
  criticalBreaches: number;
}

export interface CategoryAnalytics {
  category: TicketCategory;
  tickets: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionRating: number;
  slaCompliance: number;
  trends: Array<{
    date: string;
    tickets: number;
    avgResponseTime: number;
  }>;
}

export interface BusinessModelAnalytics {
  businessModel: BusinessModel;
  tenantId?: string;
  overview: AnalyticsOverview;
  breakdown: {
    byStatus: Record<TicketStatus, number>;
    byPriority: Record<TicketPriority, number>;
    byCategory: Record<TicketCategory, number>;
  };
  trends: TrendData[];
  agents: PerformanceMetrics[];
}

export interface PredictiveAnalytics {
  expectedVolume: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
  capacityRecommendations: {
    currentCapacity: number;
    recommendedCapacity: number;
    reasoning: string[];
  };
  riskFactors: {
    slaRisk: "low" | "medium" | "high";
    volumeSpike: "unlikely" | "possible" | "likely";
    satisfactionTrend: "improving" | "stable" | "declining";
  };
}

// ===== CUSTOM REPORTS =====

export interface CustomReportConfig {
  name: string;
  description?: string;
  metrics: string[];
  filters: AnalyticsFilters;
  groupBy: "day" | "week" | "month" | "agent" | "category";
  format: "chart" | "table" | "summary";
  schedule?: {
    frequency: "daily" | "weekly" | "monthly";
    recipients: string[];
    enabled: boolean;
  };
}

// ===== BACKGROUND JOBS =====

export interface AnalyticsJobResult {
  businessModel: BusinessModel;
  tenantId: string | null;
  status: "success" | "failed";
  error?: string;
  duration?: number;
}

export interface BackfillResult {
  date: Date;
  status: "success" | "failed" | "skipped";
  error?: string;
}

export interface AnalyticsHealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  details: {
    latestHourlyData: Date | null;
    latestDailyData: Date | null;
    missingHours: number;
    missingDays: number;
    totalRecords: number;
  };
  recommendations?: string[];
}

// ===== ENHANCED ANALYTICS RESPONSE =====

export interface CompleteSupportAnalyticsResponse
  extends SupportAnalyticsResponse {
  // Real-time data
  realTime?: {
    isRealTime: boolean;
    lastUpdate: Date;
    refreshInterval: number;
  };

  // Predictions
  predictions?: {
    expectedVolume: {
      nextWeek: number;
      nextMonth: number;
      confidence: number;
    };
    capacity: {
      current: number;
      recommended: number;
      reasoning: string[];
    };
    risks: {
      slaRisk: "low" | "medium" | "high";
      volumeSpike: "unlikely" | "possible" | "likely";
      satisfactionTrend: "improving" | "stable" | "declining";
    };
  };

  // Insights and recommendations
  insights?: {
    topIssues: Array<{
      category: TicketCategory;
      tickets: number;
      trend: "increasing" | "stable" | "decreasing";
      impact: "low" | "medium" | "high";
    }>;

    performanceAlerts: Array<{
      type:
        | "sla_breach"
        | "satisfaction_drop"
        | "agent_overload"
        | "volume_spike";
      severity: "info" | "warning" | "critical";
      message: string;
      actionRequired: boolean;
      suggestions: string[];
    }>;

    recommendations: Array<{
      title: string;
      description: string;
      impact: "low" | "medium" | "high";
      effort: "low" | "medium" | "high";
      category: "performance" | "satisfaction" | "efficiency" | "capacity";
    }>;
  };
}

// ===== DASHBOARD RESPONSE =====

export interface SupportDashboardResponse {
  overview: AnalyticsOverview;
  trends: TrendData[];
  agents: PerformanceMetrics[];
  sla: SLAMetrics;
  categories: CategoryAnalytics[];
  dateRange: {
    from: Date;
    to: Date;
  };
  businessModel: BusinessModel;
  tenantId?: string;
  generatedAt: Date;
}

// ===== EXPORT CONFIGURATIONS =====

export const ANALYTICS_CRON_JOBS = {
  hourlyAggregation: "0 * * * *", // Every hour
  dailyAggregation: "0 1 * * *", // 1 AM daily
  weeklyCleanup: "0 2 * * 0", // 2 AM Sunday
  monthlyCleanup: "0 2 1 * *", // 2 AM first of month
  healthCheck: "*/15 * * * *", // Every 15 minutes
} as const;

export const ANALYTICS_RETENTION = {
  hourlyData: 90, // 90 days
  dailyData: 365, // 1 year
  monthlyData: 1095, // 3 years
} as const;

// ===== REAL-TIME ANALYTICS =====

export interface RealTimeMetrics {
  activeUsers: number;
  onlineAgents: number;
  todayTickets: number;
  pendingTickets: number;
  avgWaitTime: number;
  slaBreachesToday: number;
  lastUpdate: Date;
}

// ===== ANALYTICS FILTERS EXTENDED =====

export interface ExtendedAnalyticsFilters extends AnalyticsFilters {
  period?: "today" | "week" | "month" | "quarter" | "year" | "custom";
  includeArchived?: boolean;
  minTickets?: number;
  slaBreachedOnly?: boolean;
  satisfactionThreshold?: number;
}

// ===== EXPORT TYPES =====

export interface AnalyticsExportOptions {
  format: "csv" | "xlsx" | "json" | "pdf";
  metrics: string[];
  period: "day" | "week" | "month";
  from?: Date;
  to?: Date;
  includeCharts?: boolean;
  includeRawData?: boolean;
}

export interface AnalyticsExportResult {
  filename: string;
  downloadUrl?: string;
  mimeType: string;
  data: string | Buffer;
  size: number;
  expiresAt?: Date;
}

// ===== COMPARISON TYPES =====

export interface PeriodComparison<T> {
  current: {
    period: string;
    value: T;
  };
  previous: {
    period: string;
    value: T;
  };
  change: T;
  changePercent: number;
  trend: "up" | "down" | "stable";
}

// ===== ALERT TYPES =====

export interface AnalyticsAlert {
  id: string;
  type: "sla_breach" | "volume_spike" | "satisfaction_drop" | "agent_overload";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  businessModel: BusinessModel;
  tenantId?: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  actionRequired: boolean;
  suggestions: string[];
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  type: AnalyticsAlert["type"];
  enabled: boolean;
  conditions: {
    metric: string;
    operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
    threshold: number;
    timeWindow: number; // minutes
  }[];
  actions: {
    email?: string[];
    webhook?: string;
    slack?: string;
  };
  businessModel: BusinessModel;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== METRIC CALCULATION TYPES =====

export interface MetricCalculation {
  name: string;
  value: number;
  unit: string;
  trend?: "up" | "down" | "stable";
  benchmark?: number;
  target?: number;
  status: "good" | "warning" | "critical";
  lastCalculated: Date;
}

export interface KPITarget {
  metric: string;
  target: number;
  unit: string;
  businessModel: BusinessModel;
  tenantId?: string;
  validFrom: Date;
  validTo?: Date;
}

// ===== SEGMENT ANALYSIS =====

export interface SegmentAnalysis {
  segment: {
    name: string;
    criteria: Record<string, any>;
  };
  metrics: {
    tickets: number;
    responseTime: number;
    resolutionTime: number;
    satisfaction: number;
    slaCompliance: number;
  };
  trends: TrendData[];
  insights: string[];
}

// ===== TIME SERIES =====

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface TimeSeries {
  metric: string;
  unit: string;
  data: TimeSeriesPoint[];
  aggregation: "sum" | "avg" | "min" | "max" | "count";
  interval: "hour" | "day" | "week" | "month";
}

// ===== COHORT ANALYSIS =====

export interface CohortAnalysis {
  cohortType: "weekly" | "monthly";
  periods: string[];
  cohorts: Array<{
    period: string;
    size: number;
    data: number[];
  }>;
  metrics: {
    retention: number[];
    churn: number[];
    satisfaction: number[];
  };
}

// ===== A/B TESTING SUPPORT =====

export interface ExperimentMetrics {
  experimentId: string;
  name: string;
  variants: Array<{
    name: string;
    trafficPercent: number;
    metrics: {
      tickets: number;
      responseTime: number;
      satisfaction: number;
      slaCompliance: number;
    };
    significanceLevel?: number;
    confidenceInterval?: [number, number];
  }>;
  status: "running" | "completed" | "paused";
  startDate: Date;
  endDate?: Date;
}

// ===== FORECASTING =====

export interface ForecastModel {
  type: "linear" | "seasonal" | "arima" | "prophet";
  metric: string;
  horizon: number; // days
  confidence: number;
  accuracy?: number;
  lastTrained: Date;
}

export interface ForecastResult {
  model: ForecastModel;
  predictions: Array<{
    date: Date;
    value: number;
    confidenceLower: number;
    confidenceUpper: number;
  }>;
  trends: {
    trend: number;
    seasonal?: number;
    growth?: number;
  };
  insights: string[];
}

interface BaseAnalytics {
  overview: AnalyticsOverview;
  breakdown: any;
  trends: TrendData[];
  agents: PerformanceMetrics[];
}

interface BusinessModelAnalyticsResponse extends BaseAnalytics {
  businessModel: BusinessModel;
  tenantId?: string;
}
