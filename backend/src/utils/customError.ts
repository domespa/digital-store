export class CustomError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// HELPER ERRORI COMUNI
export const createError = {
  badRequest: (message: string = "Bad Request") =>
    new CustomError(message, 400),
  unauthorized: (message: string = "Unauthorized") =>
    new CustomError(message, 401),
  forbidden: (message: string = "Forbidden") => new CustomError(message, 403),
  notFound: (message: string = "Not Found") => new CustomError(message, 404),
  conflict: (message: string = "Conflict") => new CustomError(message, 409),
  tooManyRequests: (message: string = "Too Many Requests") =>
    new CustomError(message, 429),
  internal: (message: string = "Internal Server Error") =>
    new CustomError(message, 500),
};

export const isOperationalError = (error: Error): boolean => {
  if (error instanceof CustomError) {
    return error.isOperational;
  }
  return false;
};
