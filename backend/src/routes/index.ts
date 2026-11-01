import { Router } from "express";
import { bookingRoutes } from "./booking.routes.js";
import { courtRoutes } from "./court.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { healthRoutes } from "./health.routes.js";
import { orderRoutes } from "./order.routes.js";
import { productRoutes } from "./product.routes.js";

export const apiRouter = Router();
apiRouter.use("/health", healthRoutes);
apiRouter.use("/courts", courtRoutes);
apiRouter.use("/bookings", bookingRoutes);
apiRouter.use("/products", productRoutes);
apiRouter.use("/orders", orderRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
