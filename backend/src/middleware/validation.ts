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
