import { randomBytes } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiErrorResponse } from "@marcai/shared";
import { AppError } from "../utils/errors.js";

function isNumericOverflow(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as {
    code?: unknown;
    cause?: { originalCode?: unknown; code?: unknown };
    meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } };
  };
  return (
    e.code === "22003" ||
    e.cause?.originalCode === "22003" ||
    e.cause?.code === "22003" ||
    e.meta?.driverAdapterError?.cause?.originalCode === "22003"
  );
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound("Rota não encontrada"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  let status = 500;
  let body: ApiErrorResponse = {
    error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
  };

  if (err instanceof AppError) {
    status = err.status;
    body = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
  } else if (err instanceof SyntaxError && "body" in err) {
    // JSON malformado (body-parser)
    status = 400;
    body = {
      error: {
        code: "VALIDATION_ERROR",
        message: "JSON inválido",
        details: [{ path: "", message: "malformed JSON body" }],
      },
    };
  } else if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status < 500
  ) {
    // outros erros 4xx do body-parser (ex. payload grande, charset)
    status = 400;
    body = { error: { code: "VALIDATION_ERROR", message: "Requisição inválida" } };
  } else if (isNumericOverflow(err)) {
    // Postgres 22003 (numeric_value_out_of_range)
    status = 400;
    body = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        details: [{ path: "", message: "numeric value out of range" }],
      },
    };
  } else {
    const requestId = randomBytes(4).toString("hex");
    // stack completo só no log do servidor; a resposta fica sanitizada
    const detail =
      err instanceof Error
        ? `${err.stack ?? `${err.name}: ${err.message}`}${"code" in err ? ` (code=${String(err.code)})` : ""}`
        : String(err);
    console.error(`[${requestId}] ${detail}`);
    body = {
      error: { ...body.error, details: { requestId } },
    };
  }

  res.status(status).json(body);
};
