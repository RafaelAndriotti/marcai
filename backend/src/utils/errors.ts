import type { ErrorCode, ValidationIssue } from "@marcai/shared";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static validation(path: string, message: string): AppError {
    const details: ValidationIssue[] = [{ path, message }];
    return new AppError(400, "VALIDATION_ERROR", "Dados inválidos", details);
  }
  static notFound(message: string): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }
  static conflict(message = "Quadra já reservada neste horário"): AppError {
    return new AppError(409, "BOOKING_CONFLICT", message);
  }
}
