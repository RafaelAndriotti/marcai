import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiErrorResponse } from "@marcai/shared";
import { AppError } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Rota não encontrada: ${req.method} ${req.path}`));
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
  } else {
    console.error(err);
  }

  res.status(status).json(body);
};
