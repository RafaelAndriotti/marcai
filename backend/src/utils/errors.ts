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
  static notFound(message: string, details?: unknown): AppError {
    return new AppError(404, "NOT_FOUND", message, details);
  }
  static conflict(message = "Quadra já reservada neste horário"): AppError {
    return new AppError(409, "BOOKING_CONFLICT", message);
  }
}

/** Código SQLSTATE do Postgres, onde quer que o Prisma/adapter-pg o coloque no erro. */
export function pgCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as {
    code?: unknown;
    cause?: { originalCode?: unknown; code?: unknown };
    meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } };
  };
  const code = e.meta?.driverAdapterError?.cause?.originalCode ?? e.cause?.originalCode ?? e.cause?.code ?? e.code;
  return typeof code === "string" ? code : undefined;
}
