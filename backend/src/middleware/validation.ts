import {
  body,
  param,
  query,
  ValidationChain,
  validationResult,
} from "express-validator";
import { Request, Response, NextFunction } from "express";

// HLPER PER ERRORI DI CALIDAZIONE
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: "param" in error ? error.param : "unknown",
        message: error.msg,
        value: "value" in error ? error.value : undefined,
      })),
    });
  }
  next();
};

// VALIDAZIONE EMAIL
export const emailValidation = body("email")
  .isEmail()
  .normalizeEmail()
  .withMessage("Must be a valid email address");

// VALIDAZIONE PASSWORD
export const passwordValidation = body("password")
  .isLength({ min: 8, max: 128 })
  .withMessage("Password must be between 8 and 128 chars")
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .withMessage(
    "Password must contain at least one lowercase letter, one uppercase letter, and one number"
  );

// VALIDAZIONE NOME
export const nameValidation = (field: string) =>
  body(field)
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage(`${field} must be between 2 and 50 characters`)
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage(`${field} can only contain letters and spaces`);

// VALIDAZIONE CUID
export const idValidation = (paramName: string = "id") =>
  param(paramName)
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid ID format");

// VALIDAZIONE PAGINAZIONE
export const paginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Page must be a positive integer between 1 and 1000"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be a positive integer between 1 and 100"),
];

// VALIDAZIONE ORDINI
export const createOrderValidation = [
  emailValidation,
  body("customerFirstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  body("customerLastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),
  body("items")
    .isArray({ min: 1, max: 20 })
    .withMessage("Items must be an array with 1-20 items"),
  body("items.*.productId")
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid product ID format"),
  body("items.*.quantity")
    .isInt({ min: 1, max: 100 })
    .withMessage("Quantity must be between 1 and 100"),
  body("paymentProvider")
    .optional()
    .isIn(["STRIPE", "PAYPAL"])
    .withMessage("Payment provider must be STRIPE or PAYPAL"),
  body("currency")
    .optional()
    .isIn([
      "EUR",
      "USD",
      "GBP",
      "AUD",
      "CAD",
      "JPY",
      "CHF",
      "SEK",
      "NOK",
      "DKK",
    ])
    .withMessage("Invalid currency code"),
  body("discountCode")
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Discount code must be between 3 and 20 characters"),
];

// VALIDAZIONE PASS+EMAIL
export const passwordResetRequestValidation = [
  emailValidation,
  handleValidationErrors,
];

export const resetPasswordValidation = [
  body("token")
    .notEmpty()
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid token format"),
  passwordValidation,
  handleValidationErrors,
];

export const verifyEmailValidation = [
  body("token")
    .notEmpty()
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid token format"),
  handleValidationErrors,
];

export const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  passwordValidation.withMessage(
    "New password must be between 8 and 128 characters and contain at least one lowercase letter, one uppercase letter, and one number"
  ),
  handleValidationErrors,
];

// ===========================================
//          SUPPORT VALIDATIONS
// ===========================================
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SupportRole,
} from "../generated/prisma";

// VALIDAZIONE TICKET
export const createTicketValidation = [
  body("subject")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Subject must be between 5 and 200 characters"),

  body("description")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters"),

  body("category")
    .isIn(Object.values(TicketCategory))
    .withMessage("Invalid ticket category"),

  body("priority")
    .optional()
    .isIn(Object.values(TicketPriority))
    .withMessage("Invalid ticket priority"),

  body("orderId")
    .optional()
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid order ID format"),

  body("productId")
    .optional()
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid product ID format"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
];

export const updateTicketValidation = [
  param("id")
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid ticket ID format"),

  body("subject")
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Subject must be between 5 and 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters"),

  body("status")
    .optional()
    .isIn(Object.values(TicketStatus))
    .withMessage("Invalid ticket status"),

  body("priority")
    .optional()
    .isIn(Object.values(TicketPriority))
    .withMessage("Invalid ticket priority"),

  body("category")
    .optional()
    .isIn(Object.values(TicketCategory))
    .withMessage("Invalid ticket category"),

  body("assignedToId")
    .optional()
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid assignee ID format"),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be between 1 and 50 characters"),
];

// VALIDAZIONE MESSAGGI
export const createMessageValidation = [
  param("id")
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid ticket ID format"),

  body("content")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Message content must be between 1 and 2000 characters"),

  body("isInternal")
    .optional()
    .isBoolean()
    .withMessage("isInternal must be a boolean"),
];

// VALIDAZIONE ASSIGNMENT
export const assignTicketValidation = [
  param("id")
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid ticket ID format"),

  body("assigneeId")
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid assignee ID format"),
];

// VALIDAZIONE ESCALATION
export const escalateTicketValidation = [
  param("id")
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid ticket ID format"),

  body("reason")
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Escalation reason must be between 10 and 500 characters"),

  body("escalateTo")
    .optional()
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid escalation target ID format"),

  body("priority")
    .optional()
    .isIn(Object.values(TicketPriority))
    .withMessage("Invalid ticket priority"),

  body("addMessage")
    .optional()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Additional message must be between 1 and 1000 characters"),
];

// VALIDAZIONE SATISFACTION
export const submitSatisfactionValidation = [
  param("id")
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid ticket ID format"),

  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be an integer between 1 and 5"),

  body("feedback")
    .optional()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Feedback must be between 1 and 1000 characters"),

  body("detailedRatings.responseTime")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Response time rating must be between 1 and 5"),

  body("detailedRatings.helpfulness")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Helpfulness rating must be between 1 and 5"),

  body("detailedRatings.professionalism")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Professionalism rating must be between 1 and 5"),

  body("detailedRatings.resolution")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Resolution rating must be between 1 and 5"),
];

// VALIDAZIONE AGENT
export const createAgentValidation = [
  body("userId")
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid user ID format"),

  body("role")
    .isIn(Object.values(SupportRole))
    .withMessage("Invalid support role"),

  body("categories")
    .optional()
    .isArray()
    .withMessage("Categories must be an array"),

  body("categories.*")
    .optional()
    .isIn(Object.values(TicketCategory))
    .withMessage("Invalid ticket category"),

  body("maxConcurrentTickets")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Max concurrent tickets must be between 1 and 50"),
];

export const updateAgentValidation = [
  param("id")
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid agent ID format"),

  body("role")
    .optional()
    .isIn(Object.values(SupportRole))
    .withMessage("Invalid support role"),

  body("categories")
    .optional()
    .isArray()
    .withMessage("Categories must be an array"),

  body("categories.*")
    .optional()
    .isIn(Object.values(TicketCategory))
    .withMessage("Invalid ticket category"),

  body("maxConcurrentTickets")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Max concurrent tickets must be between 1 and 50"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  body("isAvailable")
    .optional()
    .isBoolean()
    .withMessage("isAvailable must be a boolean"),
];

// VALIDAZIONE SEARCH & FILTERS
export const searchTicketsValidation = [
  query("q")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),

  query("page")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Page must be between 1 and 1000"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("sortField")
    .optional()
    .isIn(["createdAt", "updatedAt", "priority", "status", "lastResponseAt"])
    .withMessage("Invalid sort field"),

  query("sortDirection")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort direction must be asc or desc"),
];

// VALIDAZIONE ANALYTICS
export const analyticsValidation = [
  query("from")
    .isISO8601()
    .withMessage("From date must be a valid ISO 8601 date"),

  query("to").isISO8601().withMessage("To date must be a valid ISO 8601 date"),

  query("businessModel")
    .optional()
    .isIn(["B2B_SALE", "SAAS_MULTITENANT", "MARKETPLACE_PLATFORM"])
    .withMessage("Invalid business model"),

  query("tenantId")
    .optional()
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid tenant ID format"),

  query("agentId")
    .optional()
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid agent ID format"),

  query("period")
    .optional()
    .isIn(["day", "week", "month"])
    .withMessage("Period must be day, week, or month"),
];

// VALIDAZIONE CONFIGURAZIONE
export const updateConfigValidation = [
  body("businessModel")
    .isIn(["B2B_SALE", "SAAS_MULTITENANT", "MARKETPLACE_PLATFORM"])
    .withMessage("Invalid business model"),

  body("tenantId")
    .optional()
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid tenant ID format"),

  body("mode")
    .optional()
    .isIn(["internal", "vendor", "platform"])
    .withMessage("Mode must be internal, vendor, or platform"),

  body("escalationEnabled")
    .optional()
    .isBoolean()
    .withMessage("escalationEnabled must be a boolean"),

  body("chatEnabled")
    .optional()
    .isBoolean()
    .withMessage("chatEnabled must be a boolean"),

  body("slaTracking")
    .optional()
    .isBoolean()
    .withMessage("slaTracking must be a boolean"),

  body("autoAssignEnabled")
    .optional()
    .isBoolean()
    .withMessage("autoAssignEnabled must be a boolean"),

  body("emailNotifications")
    .optional()
    .isBoolean()
    .withMessage("emailNotifications must be a boolean"),

  body("lowPrioritySLA")
    .optional()
    .isInt({ min: 5, max: 10080 })
    .withMessage("Low priority SLA must be between 5 and 10080 minutes"),

  body("mediumPrioritySLA")
    .optional()
    .isInt({ min: 5, max: 10080 })
    .withMessage("Medium priority SLA must be between 5 and 10080 minutes"),

  body("highPrioritySLA")
    .optional()
    .isInt({ min: 5, max: 10080 })
    .withMessage("High priority SLA must be between 5 and 10080 minutes"),

  body("urgentPrioritySLA")
    .optional()
    .isInt({ min: 5, max: 1440 })
    .withMessage("Urgent priority SLA must be between 5 and 1440 minutes"),

  body("maxTicketsPerHour")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Max tickets per hour must be between 1 and 100"),

  body("maxTicketsPerDay")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Max tickets per day must be between 1 and 1000"),
];

// HELPER PER COMBINARE VALIDAZIONI
export const supportValidationSets = {
  createTicket: [...createTicketValidation, handleValidationErrors],
  updateTicket: [...updateTicketValidation, handleValidationErrors],
  createMessage: [...createMessageValidation, handleValidationErrors],
  assignTicket: [...assignTicketValidation, handleValidationErrors],
  escalateTicket: [...escalateTicketValidation, handleValidationErrors],
  submitSatisfaction: [...submitSatisfactionValidation, handleValidationErrors],
  createAgent: [...createAgentValidation, handleValidationErrors],
  updateAgent: [...updateAgentValidation, handleValidationErrors],
  searchTickets: [...searchTicketsValidation, handleValidationErrors],
  analytics: [...analyticsValidation, handleValidationErrors],
  updateConfig: [...updateConfigValidation, handleValidationErrors],
};
