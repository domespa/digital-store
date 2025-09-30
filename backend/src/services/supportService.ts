import {
  PrismaClient,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SupportRole,
  BusinessModel,
} from "../generated/prisma";
import {
  CreateTicketRequest,
  UpdateTicketRequest,
  TicketResponse,
  TicketListResponse,
  TicketSearchFilters,
  TicketSortOptions,
  PaginationOptions,
  CreateMessageRequest,
  EscalateTicketRequest,
  SupportConfig,
  SupportErrorCodes,
  SubmitSatisfactionRequest,
  SupportWebSocketEvent,
  SupportMessageResponse,
} from "../types/support";
import NotificationService from "../services/notificationService";
import EmailService from "../services/emailService";
import WebSocketService from "../services/websocketService";
import { FileUploadService } from "../services/uploadService";
import { NotificationType as PrismaNotificationType } from "../generated/prisma";

export class SupportService {
  constructor(
    private prisma: PrismaClient,
    private notificationService: NotificationService,
    private emailService: EmailService,
    private websocketService: WebSocketService,
    private uploadService: FileUploadService
  ) {}

  // ===== CONFIGURATION =====

  async getBusinessModelConfig(
    businessModel: BusinessModel,
    tenantId: string | null = null
  ): Promise<SupportConfig> {
    const config = await this.prisma.supportConfig.findUnique({
      where: {
        businessModel_tenantId: {
          businessModel,
          tenantId: tenantId || "",
        },
      },
    });

    if (!config) {
      throw new Error(SupportErrorCodes.SLA_CONFIG_MISSING);
    }

    return {
      mode: config.mode as "internal" | "vendor" | "platform",
      escalationEnabled: config.escalationEnabled,
      chatEnabled: config.chatEnabled,
      slaTracking: config.slaTracking,
      businessModel: config.businessModel,
      tenantId: config.tenantId || undefined,

      slaDefaults: {
        low: config.lowPrioritySLA,
        medium: config.mediumPrioritySLA,
        high: config.highPrioritySLA,
        urgent: config.urgentPrioritySLA,
      },

      businessHours: {
        start: config.businessHoursStart,
        end: config.businessHoursEnd,
        days: config.businessDays,
        timezone: config.timezone,
      },

      autoAssignment: config.autoAssignEnabled,
      roundRobin: config.roundRobinEnabled,
      emailNotifications: config.emailNotifications,

      rateLimits: {
        ticketsPerHour: config.maxTicketsPerHour,
        ticketsPerDay: config.maxTicketsPerDay,
        maxConcurrentTickets: 10,
      },
    };
  }

  // ===== TICKET MANAGEMENT =====

  async createTicket(
    userId: string,
    request: CreateTicketRequest,
    businessModel: BusinessModel,
    tenantId: string | null = null
  ): Promise<TicketResponse> {
    const config = await this.getBusinessModelConfig(businessModel, tenantId);

    await this.checkRateLimits(userId, config);

    const ticketNumber = await this.generateTicketNumber();

    const ticket = await this.prisma.$transaction(async (tx) => {
      // CREA TICKET
      const newTicket = await tx.supportTicket.create({
        data: {
          ticketNumber,
          subject: request.subject,
          description: request.description,
          category: request.category,
          priority: request.priority || TicketPriority.MEDIUM,
          businessModel,
          tenantId: tenantId ?? null,
          userId,
          orderId: request.orderId,
          productId: request.productId,
          metadata: request.metadata || {},
        },
        include: {
          user: true,
          order: true,
          product: true,
        },
      });

      if (config.slaTracking) {
        const slaMinutes =
          config.slaDefaults[
            newTicket.priority.toLowerCase() as keyof typeof config.slaDefaults
          ];
        const now = new Date();

        await tx.supportSLA.create({
          data: {
            ticketId: newTicket.id,
            firstResponseSLA: slaMinutes,
            resolutionSLA: slaMinutes * 4,
            firstResponseDue: new Date(now.getTime() + slaMinutes * 60000),
            resolutionDue: new Date(now.getTime() + slaMinutes * 4 * 60000),
          },
        });
      }

      if (request.attachments && request.attachments.length > 0) {
        for (const file of request.attachments) {
          const uploadResult = await this.uploadService.uploadDigitalFile(
            file.path,
            file.originalname,
            "support",
            userId
          );

          await tx.supportAttachment.create({
            data: {
              filename: uploadResult.id,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              url: uploadResult.url,
              ticketId: newTicket.id,
              uploadedById: userId,
            },
          });
        }
      }

      if (config.autoAssignment) {
        const assignee = await this.findBestAgent(
          newTicket.category,
          businessModel,
          tenantId
        );
        if (assignee) {
          await tx.supportTicket.update({
            where: { id: newTicket.id },
            data: { assignedToId: assignee.userId },
          });
        }
      }

      return newTicket;
    });

    await this.sendTicketNotifications("created", ticket.id);

    await this.emitWebSocketEvent({
      type: "ticket_created",
      ticketId: ticket.id,
      data: { ticketNumber: ticket.ticketNumber },
      timestamp: new Date(),
    });

    return await this.getTicketById(ticket.id, userId);
  }

  async updateTicket(
    ticketId: string,
    request: UpdateTicketRequest,
    userId: string
  ): Promise<TicketResponse> {
    const existingTicket = await this.getTicketWithPermissions(
      ticketId,
      userId
    );

    if (request.status && request.status !== existingTicket.status) {
      await this.validateStatusTransition(
        existingTicket.status,
        request.status,
        userId
      );
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...request,
        ...(request.status === TicketStatus.RESOLVED && {
          resolvedAt: new Date(),
        }),
        ...(request.status === TicketStatus.CLOSED && { closedAt: new Date() }),
      },
    });

    if (request.priority && request.priority !== existingTicket.priority) {
      await this.updateSLAForPriorityChange(ticketId, request.priority);
    }

    await this.sendTicketNotifications("updated", ticketId);

    await this.emitWebSocketEvent({
      type: "ticket_updated",
      ticketId: ticketId,
      data: { changes: request },
      timestamp: new Date(),
      userId,
    });

    return await this.getTicketById(ticketId, userId);
  }

  async getTicketById(
    ticketId: string,
    userId: string
  ): Promise<TicketResponse> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        OR: [
          { userId },
          { assignedToId: userId },
          { vendorId: userId },
          { user: { supportAgent: { role: SupportRole.PLATFORM_ADMIN } } },
        ],
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            supportAgent: {
              select: { role: true },
            },
          },
        },
        vendor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        order: {
          select: { id: true },
        },
        product: {
          select: { id: true, name: true },
        },
        messages: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                supportAgent: { select: { role: true } },
              },
            },
            attachments: {
              include: {
                uploadedBy: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            readBy: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        slaConfig: true,
        satisfaction: true,
      },
    });

    if (!ticket) {
      throw new Error(SupportErrorCodes.TICKET_NOT_FOUND);
    }

    return this.transformTicketToResponse(ticket);
  }

  async getTickets(
    userId: string,
    filters: TicketSearchFilters = {},
    sorting: TicketSortOptions = { field: "createdAt", direction: "desc" },
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<TicketListResponse> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const userPermissions = await this.getUserPermissions(userId);
    const whereClause = this.buildWhereClause(filters, userPermissions, userId);

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              supportAgent: { select: { role: true } },
            },
          },
          vendor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          order: { select: { id: true } },
          product: { select: { id: true, name: true } },
          slaConfig: true,
          satisfaction: true,
          _count: {
            select: {
              messages: true,
              attachments: true,
            },
          },
        },
        orderBy: { [sorting.field]: sorting.direction },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where: whereClause }),
    ]);

    return {
      tickets: tickets.map((ticket) => this.transformTicketToResponse(ticket)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      filters,
      sorting,
    };
  }

  // ===== MESSAGE MANAGEMENT =====

  async addMessage(
    ticketId: string,
    userId: string,
    request: CreateMessageRequest
  ): Promise<void> {
    // CONTROLLA PERMESSI
    await this.getTicketWithPermissions(ticketId, userId);

    await this.prisma.$transaction(async (tx) => {
      // CREA MESSAGG
      const message = await tx.supportMessage.create({
        data: {
          content: request.content,
          isInternal: request.isInternal || false,
          ticketId,
          authorId: userId,
        },
      });
      if (request.attachments && request.attachments.length > 0) {
        for (const file of request.attachments) {
          const uploadResult = await this.uploadService.uploadDigitalFile(
            file.path,
            file.originalname,
            "support",
            userId
          );

          await tx.supportAttachment.create({
            data: {
              filename: uploadResult.id,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              url: uploadResult.url,
              messageId: message.id,
              uploadedById: userId,
            },
          });
        }
      }

      const updateData: {
        lastResponseAt: Date;
        updatedAt: Date;
        firstResponseAt?: Date;
      } = {
        lastResponseAt: new Date(),
        updatedAt: new Date(),
      };

      const ticket = await tx.supportTicket.findUnique({
        where: { id: ticketId },
        include: { assignedTo: true },
      });

      if (!ticket?.firstResponseAt && ticket?.assignedToId === userId) {
        updateData.firstResponseAt = new Date();

        await tx.supportSLA.updateMany({
          where: { ticketId },
          data: { firstResponseMet: true },
        });
      }

      await tx.supportTicket.update({
        where: { id: ticketId },
        data: updateData,
      });
    });

    await this.sendMessageNotifications(ticketId, userId);

    await this.emitWebSocketEvent({
      type: "message_created",
      ticketId,
      data: { content: request.content },
      timestamp: new Date(),
      userId,
    });
  }

  // ===== ESCALATION =====

  async escalateTicket(
    ticketId: string,
    userId: string,
    request: EscalateTicketRequest
  ): Promise<TicketResponse> {
    const ticket = await this.getTicketWithPermissions(ticketId, userId);
    const config = await this.getBusinessModelConfig(
      ticket.businessModel,
      ticket.tenantId
    );

    if (!config.escalationEnabled) {
      throw new Error(SupportErrorCodes.ESCALATION_NOT_ALLOWED);
    }

    const escalationTarget =
      request.escalateTo ||
      (await this.findEscalationTarget(ticket.businessModel, ticket.tenantId));

    if (!escalationTarget) {
      throw new Error(SupportErrorCodes.AGENT_NOT_AVAILABLE);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.ESCALATED,
          priority: request.priority || ticket.priority,
          assignedToId: escalationTarget,
          escalatedAt: new Date(),
          escalatedFrom: ticket.assignedToId,
          escalationReason: request.reason,
        },
      });

      if (request.addMessage) {
        await tx.supportMessage.create({
          data: {
            content: `Ticket escalated: ${request.reason}\n\n${request.addMessage}`,
            isInternal: true,
            ticketId,
            authorId: userId,
          },
        });
      }
    });

    await this.sendEscalationNotifications(ticketId, escalationTarget);

    await this.emitWebSocketEvent({
      type: "escalation",
      ticketId,
      data: { reason: request.reason },
      timestamp: new Date(),
      userId,
    });

    return await this.getTicketById(ticketId, userId);
  }

  // ===== ASSIGNMENT =====

  async assignTicket(
    ticketId: string,
    assigneeId: string,
    assignerId: string
  ): Promise<TicketResponse> {
    await this.getTicketWithPermissions(ticketId, assignerId);

    const agent = await this.prisma.supportAgent.findFirst({
      where: {
        userId: assigneeId,
        isActive: true,
        isAvailable: true,
      },
      include: {
        user: true,
      },
    });

    if (!agent) {
      throw new Error(SupportErrorCodes.AGENT_NOT_AVAILABLE);
    }

    const currentTickets = await this.prisma.supportTicket.count({
      where: {
        assignedToId: assigneeId,
        status: {
          in: [
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            TicketStatus.PENDING_USER,
          ],
        },
      },
    });

    if (currentTickets >= agent.maxConcurrentTickets) {
      throw new Error(SupportErrorCodes.AGENT_NOT_AVAILABLE);
    }

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedToId: assigneeId,
        status: TicketStatus.IN_PROGRESS,
        updatedAt: new Date(),
      },
    });

    await this.sendAssignmentNotifications(ticketId, assigneeId);

    await this.emitWebSocketEvent({
      type: "ticket_assigned",
      ticketId,
      data: {
        assigneeId,
        assigneeName: `${agent.user.firstName} ${agent.user.lastName}`,
      },
      timestamp: new Date(),
      userId: assignerId,
    });

    return await this.getTicketById(ticketId, assignerId);
  }

  // ===== SATISFACTION =====

  async submitSatisfaction(
    ticketId: string,
    userId: string,
    request: SubmitSatisfactionRequest
  ): Promise<void> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId,
        status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
    });

    if (!ticket) {
      throw new Error(SupportErrorCodes.TICKET_NOT_FOUND);
    }

    const existingSatisfaction =
      await this.prisma.supportSatisfaction.findUnique({
        where: { ticketId },
      });

    if (existingSatisfaction) {
      throw new Error(SupportErrorCodes.SATISFACTION_ALREADY_SUBMITTED);
    }

    await this.prisma.supportSatisfaction.create({
      data: {
        ticketId,
        rating: request.rating,
        feedback: request.feedback,
        responseTime: request.detailedRatings?.responseTime,
        helpfulness: request.detailedRatings?.helpfulness,
        professionalism: request.detailedRatings?.professionalism,
        resolution: request.detailedRatings?.resolution,
      },
    });

    if (ticket.assignedToId) {
      await this.updateAgentSatisfactionMetrics(ticket.assignedToId);
    }

    await this.sendSatisfactionNotifications(ticketId, request.rating);
  }

  // ===== UTILITY METHODS =====

  private async generateTicketNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    const count = await this.prisma.supportTicket.count({
      where: {
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          lt: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 1
          ),
        },
      },
    });

    return `SUP-${dateStr}-${(count + 1).toString().padStart(4, "0")}`;
  }

  private async checkRateLimits(
    userId: string,
    config: SupportConfig
  ): Promise<void> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [hourlyCount, dailyCount] = await Promise.all([
      this.prisma.supportTicket.count({
        where: {
          userId,
          createdAt: { gte: hourAgo },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          userId,
          createdAt: { gte: dayAgo },
        },
      }),
    ]);

    if (hourlyCount >= config.rateLimits.ticketsPerHour) {
      throw new Error(SupportErrorCodes.RATE_LIMIT_EXCEEDED);
    }

    if (dailyCount >= config.rateLimits.ticketsPerDay) {
      throw new Error(SupportErrorCodes.RATE_LIMIT_EXCEEDED);
    }
  }

  private async findBestAgent(
    category: TicketCategory,
    businessModel: BusinessModel,
    tenantId: string | null = null
  ): Promise<{ userId: string } | null> {
    const agents = await this.prisma.supportAgent.findMany({
      where: {
        businessModel,
        tenantId: tenantId ?? null,
        isActive: true,
        isAvailable: true,
        categories: { has: category },
      },
      include: {
        user: {
          select: {
            assignedTickets: {
              where: {
                status: {
                  in: [
                    TicketStatus.OPEN,
                    TicketStatus.IN_PROGRESS,
                    TicketStatus.PENDING_USER,
                  ],
                },
              },
            },
          },
        },
      },
    });

    if (agents.length === 0) return null;

    return agents.reduce((best, current) => {
      const currentLoad = current.user.assignedTickets.length;
      const bestLoad = best.user.assignedTickets.length;

      return currentLoad < bestLoad ? current : best;
    });
  }

  private async getTicketWithPermissions(ticketId: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        OR: [
          { userId },
          { assignedToId: userId },
          { vendorId: userId },
          {
            user: {
              supportAgent: {
                role: {
                  in: [SupportRole.PLATFORM_ADMIN, SupportRole.SUPER_ADMIN],
                },
              },
            },
          },
        ],
      },
    });

    if (!ticket) {
      throw new Error(SupportErrorCodes.UNAUTHORIZED_ACCESS);
    }

    return ticket;
  }

  private async validateStatusTransition(
    from: TicketStatus,
    to: TicketStatus,
    userId: string
  ): Promise<void> {
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.OPEN]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
      [TicketStatus.IN_PROGRESS]: [
        TicketStatus.PENDING_USER,
        TicketStatus.RESOLVED,
        TicketStatus.ESCALATED,
      ],
      [TicketStatus.PENDING_USER]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.CLOSED,
      ],
      [TicketStatus.PENDING_VENDOR]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.ESCALATED,
      ],
      [TicketStatus.ESCALATED]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.RESOLVED,
      ],
      [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.OPEN],
      [TicketStatus.CLOSED]: [],
    };

    if (!validTransitions[from]?.includes(to)) {
      throw new Error(SupportErrorCodes.INVALID_STATUS_TRANSITION);
    }
  }

  private transformTicketToResponse(
    ticket: Record<string, any>
  ): TicketResponse {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      businessModel: ticket.businessModel,
      tenantId: ticket.tenantId || undefined,

      user: {
        id: ticket.user.id,
        name: `${ticket.user.firstName} ${ticket.user.lastName}`.trim(),
        email: ticket.user.email,
      },

      assignedTo: ticket.assignedTo
        ? {
            id: ticket.assignedTo.id,
            name: `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`.trim(),
            email: ticket.assignedTo.email,
            role: ticket.assignedTo.supportAgent?.role || SupportRole.ADMIN,
          }
        : undefined,

      vendor: ticket.vendor
        ? {
            id: ticket.vendor.id,
            name: `${ticket.vendor.firstName} ${ticket.vendor.lastName}`.trim(),
            email: ticket.vendor.email,
          }
        : undefined,

      order: ticket.order
        ? {
            id: ticket.order.id,
            orderNumber: ticket.order.id,
          }
        : undefined,

      product: ticket.product
        ? {
            id: ticket.product.id,
            name: ticket.product.name,
          }
        : undefined,

      messages:
        ticket.messages?.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          isInternal: msg.isInternal,
          author: {
            id: msg.author.id,
            name: `${msg.author.firstName} ${msg.author.lastName}`.trim(),
            email: msg.author.email,
            role: msg.author.supportAgent?.role || SupportRole.USER,
          },
          attachments:
            msg.attachments?.map((att: any) => ({
              id: att.id,
              filename: att.filename,
              originalName: att.originalName,
              mimeType: att.mimeType,
              size: att.size,
              url: att.url,
              uploadedBy: {
                id: att.uploadedBy.id,
                name: `${att.uploadedBy.firstName} ${att.uploadedBy.lastName}`.trim(),
              },
              createdAt: att.createdAt,
            })) || [],
          readBy:
            msg.readBy?.map((read: any) => ({
              userId: read.user.id,
              userName: `${read.user.firstName} ${read.user.lastName}`.trim(),
              readAt: read.readAt,
            })) || [],
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        })) || [],

      attachments:
        ticket.attachments?.map((att: any) => ({
          id: att.id,
          filename: att.filename,
          originalName: att.originalName,
          mimeType: att.mimeType,
          size: att.size,
          url: att.url,
          uploadedBy: {
            id: att.uploadedBy.id,
            name: `${att.uploadedBy.firstName} ${att.uploadedBy.lastName}`.trim(),
          },
          createdAt: att.createdAt,
        })) || [],

      sla: ticket.slaConfig
        ? {
            firstResponseDue: ticket.slaConfig.firstResponseDue,
            resolutionDue: ticket.slaConfig.resolutionDue,
            firstResponseMet: ticket.slaConfig.firstResponseMet,
            resolutionMet: ticket.slaConfig.resolutionMet,
            breaches: {
              firstResponse: ticket.slaConfig.firstResponseBreach,
              resolution: ticket.slaConfig.resolutionBreach,
              totalBreachTime: ticket.slaConfig.totalBreachTime,
            },
          }
        : undefined,

      satisfaction: ticket.satisfaction
        ? {
            rating: ticket.satisfaction.rating,
            feedback: ticket.satisfaction.feedback,
            detailedRatings: {
              responseTime: ticket.satisfaction.responseTime,
              helpfulness: ticket.satisfaction.helpfulness,
              professionalism: ticket.satisfaction.professionalism,
              resolution: ticket.satisfaction.resolution,
            },
          }
        : undefined,

      tags: ticket.tags || [],
      metadata: ticket.metadata || {},

      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      firstResponseAt: ticket.firstResponseAt,
      lastResponseAt: ticket.lastResponseAt,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
    };
  }

  private async sendTicketNotifications(
    event: string,
    ticketId: string
  ): Promise<void> {
    try {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          user: true,
          assignedTo: true,
        },
      });

      if (!ticket) return;

      if (event === "created") {
        await this.notificationService.createNotificationFromTemplate(
          PrismaNotificationType.SUPPORT_TICKET_CREATED,
          ticket.userId,
          {
            ticketNumber: ticket.ticketNumber,
            ticketSubject: ticket.subject,
            ticketId: ticket.id,
          }
        );

        await this.emailService.sendEmail({
          to: ticket.user.email,
          subject: `Support Ticket Created - ${ticket.ticketNumber}`,
          html: `
            <h2>Support Ticket Created</h2>
            <p>Your support ticket has been created successfully.</p>
            <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
            <p><strong>Subject:</strong> ${ticket.subject}</p>
            <p><strong>Priority:</strong> ${ticket.priority}</p>
            <p>We'll respond to you as soon as possible.</p>
          `,
        });
      }

      if (ticket.assignedToId && event === "assigned") {
        await this.notificationService.createNotificationFromTemplate(
          PrismaNotificationType.SUPPORT_TICKET_ASSIGNED,
          ticket.assignedToId,
          {
            ticketNumber: ticket.ticketNumber,
            ticketSubject: ticket.subject,
            ticketId: ticket.id,
          }
        );
      }
    } catch (error) {
      console.error("Failed to send ticket notifications:", error);
    }
  }

  private async sendMessageNotifications(
    ticketId: string,
    authorId: string
  ): Promise<void> {
    try {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          user: true,
          assignedTo: true,
        },
      });

      if (!ticket) return;

      if (authorId !== ticket.userId && ticket.userId) {
        await this.notificationService.createNotificationFromTemplate(
          PrismaNotificationType.SUPPORT_MESSAGE_RECEIVED,
          ticket.userId,
          {
            ticketNumber: ticket.ticketNumber,
            ticketId: ticket.id,
          }
        );
      }

      if (authorId !== ticket.assignedToId && ticket.assignedToId) {
        await this.notificationService.createNotificationFromTemplate(
          PrismaNotificationType.SUPPORT_TICKET_ASSIGNED,
          ticket.assignedToId,
          {
            ticketNumber: ticket.ticketNumber,
            ticketId: ticket.id,
          }
        );
      }
    } catch (error) {
      console.error("Failed to send message notifications:", error);
    }
  }

  private async sendEscalationNotifications(
    ticketId: string,
    targetId: string
  ): Promise<void> {
    try {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) return;

      await this.notificationService.createNotificationFromTemplate(
        PrismaNotificationType.SUPPORT_TICKET_ESCALATED,
        targetId,
        {
          ticketNumber: ticket.ticketNumber,
          ticketSubject: ticket.subject,
          ticketId: ticket.id,
          escalationReason: ticket.escalationReason,
        }
      );
    } catch (error) {
      console.error("Failed to send escalation notifications:", error);
    }
  }

  private async sendAssignmentNotifications(
    ticketId: string,
    assigneeId: string
  ): Promise<void> {
    try {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          assignedTo: true,
        },
      });

      if (!ticket || !ticket.assignedTo) return;

      await this.notificationService.createNotificationFromTemplate(
        PrismaNotificationType.SUPPORT_TICKET_ASSIGNED,
        assigneeId,
        {
          ticketNumber: ticket.ticketNumber,
          ticketSubject: ticket.subject,
          ticketId: ticket.id,
        }
      );

      await this.emailService.sendEmail({
        to: ticket.assignedTo.email,
        subject: `Support Ticket Assigned - ${ticket.ticketNumber}`,
        html: `
          <h2>Support Ticket Assigned</h2>
          <p>A new support ticket has been assigned to you.</p>
          <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
          <p><strong>Subject:</strong> ${ticket.subject}</p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p>Please respond as soon as possible.</p>
        `,
      });
    } catch (error) {
      console.error("Failed to send assignment notifications:", error);
    }
  }

  private async sendSatisfactionNotifications(
    ticketId: string,
    rating: number
  ): Promise<void> {
    try {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          assignedTo: true,
        },
      });

      if (!ticket) return;

      if (ticket.assignedToId) {
        await this.notificationService.createNotificationFromTemplate(
          PrismaNotificationType.SUPPORT_SATISFACTION_SUBMITTED,
          ticket.assignedToId,
          {
            ticketNumber: ticket.ticketNumber,
            rating: rating.toString(),
            ticketId: ticket.id,
          }
        );
      }
    } catch (error) {
      console.error("Failed to send satisfaction notifications:", error);
    }
  }

  private async emitWebSocketEvent(
    event: SupportWebSocketEvent
  ): Promise<void> {
    try {
      await this.websocketService.sendNotificationToChannel("support", {
        id: event.ticketId,
        type: event.type as any,
        title: `Support: ${event.type}`,
        message: `Ticket ${event.ticketId} event: ${event.type}`,
        priority: "NORMAL" as any,
        data: event.data,
        createdAt: event.timestamp,
      });
    } catch (error) {
      console.error("Failed to emit WebSocket event:", error);
    }
  }

  private async getUserPermissions(userId: string): Promise<{
    role: SupportRole;
    businessModel?: BusinessModel;
    tenantId?: string;
  }> {
    const agent = await this.prisma.supportAgent.findFirst({
      where: { userId },
    });

    return {
      role: agent?.role || SupportRole.USER,
      businessModel: agent?.businessModel,
      tenantId: agent?.tenantId || undefined,
    };
  }

  private buildWhereClause(
    filters: TicketSearchFilters,
    permissions: {
      role: SupportRole;
      businessModel?: BusinessModel;
      tenantId?: string;
    },
    userId: string
  ): Record<string, any> {
    const where: Record<string, any> = {};

    if (permissions.role === SupportRole.USER) {
      where.userId = userId;
    } else if (permissions.role === SupportRole.ADMIN) {
      where.OR = [
        { userId },
        { assignedToId: userId },
        {
          businessModel: permissions.businessModel,
          tenantId: permissions.tenantId,
        },
      ];
    }

    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.priority?.length) where.priority = { in: filters.priority };
    if (filters.category?.length) where.category = { in: filters.category };
    if (filters.assignedTo?.length)
      where.assignedToId = { in: filters.assignedTo };
    if (filters.businessModel) where.businessModel = filters.businessModel;
    if (filters.tenantId) where.tenantId = filters.tenantId;

    if (filters.createdFrom || filters.createdTo) {
      where.createdAt = {};
      if (filters.createdFrom) where.createdAt.gte = filters.createdFrom;
      if (filters.createdTo) where.createdAt.lte = filters.createdTo;
    }

    if (filters.search) {
      where.OR = [
        { subject: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { ticketNumber: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  private async updateAgentSatisfactionMetrics(agentId: string): Promise<void> {
    try {
      const avgSatisfaction = await this.prisma.supportSatisfaction.aggregate({
        where: {
          ticket: { assignedToId: agentId },
        },
        _avg: { rating: true },
      });

      await this.prisma.supportAgent.updateMany({
        where: { userId: agentId },
        data: {
          satisfactionRating: avgSatisfaction._avg.rating || 0,
        },
      });
    } catch (error) {
      console.error("Failed to update agent satisfaction metrics:", error);
    }
  }

  private async updateSLAForPriorityChange(
    ticketId: string,
    newPriority: TicketPriority
  ): Promise<void> {
    try {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { slaConfig: true },
      });

      if (!ticket?.slaConfig) return;

      const config = await this.getBusinessModelConfig(
        ticket.businessModel,
        ticket.tenantId
      );
      const newSlaMinutes =
        config.slaDefaults[
          newPriority.toLowerCase() as keyof typeof config.slaDefaults
        ];

      const createdAt = ticket.createdAt;
      const newFirstResponseDue = new Date(
        createdAt.getTime() + newSlaMinutes * 60000
      );
      const newResolutionDue = new Date(
        createdAt.getTime() + newSlaMinutes * 4 * 60000
      );

      await this.prisma.supportSLA.update({
        where: { ticketId },
        data: {
          firstResponseSLA: newSlaMinutes,
          resolutionSLA: newSlaMinutes * 4,
          firstResponseDue: newFirstResponseDue,
          resolutionDue: newResolutionDue,
        },
      });
    } catch (error) {
      console.error("Failed to update SLA for priority change:", error);
    }
  }

  private async findEscalationTarget(
    businessModel: BusinessModel,
    tenantId: string | null = null
  ): Promise<string | null> {
    const escalationHierarchy = {
      [BusinessModel.B2B_SALE]: [
        SupportRole.VENDOR,
        SupportRole.PLATFORM_ADMIN,
      ],
      [BusinessModel.SAAS_MULTITENANT]: [
        SupportRole.SUPER_ADMIN,
        SupportRole.PLATFORM_ADMIN,
      ],
      [BusinessModel.MARKETPLACE_PLATFORM]: [
        SupportRole.PLATFORM_ADMIN,
        SupportRole.SUPER_ADMIN,
      ],
    };

    const targetRoles = escalationHierarchy[businessModel];

    for (const role of targetRoles) {
      const agent = await this.prisma.supportAgent.findFirst({
        where: {
          role,
          businessModel,
          tenantId: tenantId ?? null,
          isActive: true,
          isAvailable: true,
        },
        include: {
          user: {
            select: {
              assignedTickets: {
                where: {
                  status: {
                    in: [
                      TicketStatus.OPEN,
                      TicketStatus.IN_PROGRESS,
                      TicketStatus.PENDING_USER,
                    ],
                  },
                },
              },
            },
          },
        },
        orderBy: {
          user: {
            assignedTickets: {
              _count: "asc",
            },
          },
        },
      });

      if (agent) return agent.userId;
    }

    return null;
  }

  // ===== ADDITIONAL UTILITY METHODS =====

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    try {
      const existingRead = await this.prisma.supportMessageRead.findUnique({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
      });

      if (!existingRead) {
        await this.prisma.supportMessageRead.create({
          data: {
            messageId,
            userId,
          },
        });
      }
    } catch (error) {
      console.error("Failed to mark message as read:", error);
    }
  }

  async getTicketMessages(
    ticketId: string,
    userId: string,
    includeInternal: boolean = false
  ): Promise<SupportMessageResponse[]> {
    await this.getTicketWithPermissions(ticketId, userId);

    const messages = await this.prisma.supportMessage.findMany({
      where: {
        ticketId,
        ...(includeInternal ? {} : { isInternal: false }),
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            supportAgent: { select: { role: true } },
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        readBy: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      isInternal: msg.isInternal,
      author: {
        id: msg.author.id,
        name: `${msg.author.firstName} ${msg.author.lastName}`.trim(),
        email: msg.author.email,
        role: msg.author.supportAgent?.role || SupportRole.USER,
      },
      attachments: msg.attachments.map((att) => ({
        id: att.id,
        filename: att.filename,
        originalName: att.originalName,
        mimeType: att.mimeType,
        size: att.size,
        url: att.url,
        uploadedBy: {
          id: att.uploadedBy.id,
          name: `${att.uploadedBy.firstName} ${att.uploadedBy.lastName}`.trim(),
        },
        createdAt: att.createdAt,
      })),
      readBy: msg.readBy.map((read) => ({
        userId: read.user.id,
        userName: `${read.user.firstName} ${read.user.lastName}`.trim(),
        readAt: read.readAt,
      })),
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));
  }

  async deleteTicket(ticketId: string, userId: string): Promise<void> {
    const userPermissions = await this.getUserPermissions(userId);
    if (userPermissions.role === SupportRole.USER) {
      throw new Error(SupportErrorCodes.UNAUTHORIZED_ACCESS);
    }

    await this.getTicketWithPermissions(ticketId, userId);

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: new Date(),
      },
    });
  }

  async getUserStats(userId: string): Promise<{
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    avgResponseTime: number;
    satisfactionRating: number;
  }> {
    const [totalTickets, openTickets, resolvedTickets, avgResponseTime] =
      await Promise.all([
        this.prisma.supportTicket.count({
          where: { userId },
        }),
        this.prisma.supportTicket.count({
          where: {
            userId,
            status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
          },
        }),
        this.prisma.supportTicket.count({
          where: {
            userId,
            status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
          },
        }),
        this.calculateUserAvgResponseTime(userId),
      ]);

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      avgResponseTime,
      satisfactionRating: await this.calculateUserSatisfactionRating(userId),
    };
  }
  async searchTickets(
    query: string,
    userId: string,
    filters: Record<string, any> = {}
  ): Promise<{
    tickets: TicketResponse[];
    query: string;
    total: number;
  }> {
    const userPermissions = await this.getUserPermissions(userId);
    const whereClause = {
      ...this.buildWhereClause(
        { search: query, ...filters },
        userPermissions,
        userId
      ),
    };

    const tickets = await this.prisma.supportTicket.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            supportAgent: { select: { role: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return {
      tickets: tickets.map((ticket) => this.transformTicketToResponse(ticket)),
      query,
      total: tickets.length,
    };
  }
  private async calculateUserAvgResponseTime(userId: string): Promise<number> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        userId,
        firstResponseAt: { not: null },
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
      },
    });

    if (tickets.length === 0) return 0;

    const totalResponseTime = tickets.reduce((sum, ticket) => {
      const responseTime =
        ticket.firstResponseAt!.getTime() - ticket.createdAt.getTime();
      return sum + responseTime;
    }, 0);

    return Math.round(totalResponseTime / tickets.length / (1000 * 60));
  }

  private async calculateUserSatisfactionRating(
    userId: string
  ): Promise<number> {
    const satisfaction = await this.prisma.supportSatisfaction.aggregate({
      where: {
        ticket: { userId },
      },
      _avg: { rating: true },
    });

    return satisfaction._avg.rating || 0;
  }

  async exportTickets(
    format: "csv" | "excel",
    filters: Record<string, any>,
    userId: string
  ): Promise<{
    filename: string;
    mimeType: string;
    data: string;
  }> {
    const userPermissions = await this.getUserPermissions(userId);
    if (userPermissions.role === SupportRole.USER) {
      throw new Error(SupportErrorCodes.UNAUTHORIZED_ACCESS);
    }

    return {
      filename: `tickets-export-${Date.now()}.${format}`,
      mimeType:
        format === "csv"
          ? "text/csv"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      data: "Export functionality not implemented",
    };
  }

  async updateConfig(
    businessModel: BusinessModel,
    configData: Record<string, any>,
    tenantId: string | null = null
  ): Promise<SupportConfig> {
    const config = await this.prisma.supportConfig.upsert({
      where: {
        businessModel_tenantId: {
          businessModel,
          tenantId: tenantId || "",
        },
      },
      update: configData,
      create: {
        businessModel,
        tenantId: tenantId || null,
        mode: "internal",
        escalationEnabled: true,
        chatEnabled: true,
        slaTracking: true,
        lowPrioritySLA: 1440,
        mediumPrioritySLA: 480,
        highPrioritySLA: 120,
        urgentPrioritySLA: 30,
        businessHoursStart: "09:00",
        businessHoursEnd: "17:00",
        businessDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        timezone: "UTC",
        autoAssignEnabled: false,
        roundRobinEnabled: false,
        emailNotifications: true,
        escalationEmails: true,
        maxTicketsPerHour: 10,
        maxTicketsPerDay: 50,
        ...configData,
      },
    });

    return this.getBusinessModelConfig(businessModel, tenantId);
  }
}
