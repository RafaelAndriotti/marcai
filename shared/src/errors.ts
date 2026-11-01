export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  BOOKING_CONFLICT: "BOOKING_CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** @deprecated use ApiErrorResponse de ./api.js */
export type ApiErrorBody = {
  error: { code: ErrorCode; message: string; details?: unknown };
};

/** Item de `error.details` em VALIDATION_ERROR. */
export interface ValidationIssue {
  path: string;
  message: string;
}
