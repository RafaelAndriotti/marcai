import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import type { ValidationIssue } from "@marcai/shared";
import { AppError } from "../utils/errors.js";

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === "number") return `${acc}[${seg}]`;
    return acc ? `${acc}.${String(seg)}` : String(seg);
  }, "");
}

function validate(source: "body" | "query"): <T>(schema: ZodType<T>) => RequestHandler {
  return (schema) => (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details: ValidationIssue[] = result.error.issues.map((i) => ({
        path: formatPath(i.path),
        message: i.message,
      }));
      return next(new AppError(400, "VALIDATION_ERROR", "Dados inválidos", details));
    }
    // Express 5: req.query é getter somente leitura; guarda o resultado em res.locals
    _res.locals[source] = result.data;
    next();
  };
}

export const validateBody = validate("body");
export const validateQuery = validate("query");
