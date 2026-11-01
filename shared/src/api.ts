import type { ErrorCode } from "./errors.js";

/** Resposta de sucesso de recurso único. */
export interface ApiResponse<T> {
  data: T;
}

/** Resposta de sucesso de listas (sem paginação por enquanto). */
export interface ApiListResponse<T> {
  data: T[];
}

/** Resposta de erro. */
export interface ApiErrorResponse {
  error: { code: ErrorCode; message: string; details?: unknown };
}

export interface HealthStatus {
  status: "ok";
}
