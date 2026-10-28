require("dotenv").config();

const express = require("express");
const { asyncRoute, httpError } = require("./errors");
const { createAuthMiddleware } = require("./middleware/auth");
const { createAuthRouter } = require("./routes/auth");
const { createOrdersRouter, createShipmentsRouter } = require("./routes/orders");
const { createProductsRouter } = require("./routes/products");

function createApp({
  prisma,
  jwtSecret = process.env.JWT_SECRET,
  jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1d",
}) {
  if (!prisma) throw new Error("createApp requires a Prisma client.");
  if (typeof jwtSecret !== "string" || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/healthz", asyncRoute(async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      res.status(503).json({ status: "error", database: "disconnected" });
    }
  }));

  const { authenticate, requireAdmin } = createAuthMiddleware(prisma, jwtSecret);
  app.use("/api/v1/auth", createAuthRouter(prisma, jwtSecret, jwtExpiresIn, authenticate));
  app.use("/api/v1/products", createProductsRouter(prisma, authenticate, requireAdmin));
  app.use("/api/v1/orders", createOrdersRouter(prisma, authenticate, requireAdmin));
  app.use("/api/v1/shipments", createShipmentsRouter(prisma, authenticate, requireAdmin));

  app.use((req, _res, next) => next(httpError(404, `Route ${req.method} ${req.path} was not found.`)));
  app.use((error, _req, res, _next) => {
    let status = Number.isInteger(error.status) ? error.status : 500;
    let message = status >= 500 ? "An unexpected server error occurred." : error.message;

    if (error.type === "entity.parse.failed") {
      status = 400;
      message = "Request body must contain valid JSON.";
    } else if (error.type === "entity.too.large") {
      status = 413;
      message = "Request body exceeds the 32 KB limit.";
    } else if (error.code === "P2002") {
      status = 409;
      message = "A record with that unique value already exists.";
    } else if (error.code === "P2025") {
      status = 404;
      message = "The requested record was not found.";
    }

    if (status >= 500) console.error(error);
    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = { createApp };
