import express from "express";
import { AppError } from "./utils/errors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
// API sem login em 127.0.0.1: bloqueia DNS rebinding (só valida o hostname, não a porta)
app.use("/api", (req, _res, next) => {
  if (/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(req.headers.host ?? "")) next();
  else next(new AppError(403, "FORBIDDEN", "Host não permitido"));
});
app.use(express.json({ limit: "16kb" }));
app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
