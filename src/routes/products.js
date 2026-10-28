const express = require("express");
const { asyncRoute, httpError } = require("../errors");

function parseProductInput(body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw httpError(400, "A JSON product object is required.");
  }

  const data = {};
  if (!partial || Object.hasOwn(body, "pname")) {
    if (typeof body.pname !== "string" || body.pname.trim().length < 1 || body.pname.trim().length > 100) {
      throw httpError(400, "pname must contain 1-100 characters.");
    }
    data.pname = body.pname.trim();
  }
  if (!partial || Object.hasOwn(body, "price")) {
    if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price <= 0 || Number(body.price.toFixed(2)) !== body.price) {
      throw httpError(400, "price must be a positive number with at most two decimal places.");
    }
    data.price = body.price;
  }
  if (!partial || Object.hasOwn(body, "quantity")) {
    if (!Number.isSafeInteger(body.quantity) || body.quantity < 0) {
      throw httpError(400, "quantity must be a non-negative integer.");
    }
    data.quantity = body.quantity;
  }
  if (partial && Object.keys(data).length === 0) {
    throw httpError(400, "Provide at least one of pname, price, or quantity.");
  }

  return data;
}

function createProductsRouter(prisma, authenticate, requireAdmin) {
  const router = express.Router();

  router.get("/", asyncRoute(async (req, res) => {
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
        !Number.isSafeInteger(offset) || offset < 0) {
      throw httpError(400, "limit must be 1-100 and offset must be a non-negative integer.");
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({ orderBy: { pid: "asc" }, take: limit, skip: offset }),
      prisma.product.count(),
    ]);
    res.json({ products, pagination: { limit, offset, total } });
  }));

  router.get("/:pid", asyncRoute(async (req, res) => {
    const pid = Number(req.params.pid);
    if (!Number.isSafeInteger(pid) || pid < 1) throw httpError(400, "pid must be a positive integer.");
    const product = await prisma.product.findUnique({ where: { pid } });
    if (!product) throw httpError(404, "Product not found.");
    res.json({ product });
  }));

  router.post("/", authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const product = await prisma.product.create({ data: parseProductInput(req.body) });
    res.status(201).json({ product });
  }));

  router.patch("/:pid", authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const pid = Number(req.params.pid);
    if (!Number.isSafeInteger(pid) || pid < 1) throw httpError(400, "pid must be a positive integer.");
    const product = await prisma.product.update({
      where: { pid },
      data: parseProductInput(req.body, true),
    });
    res.json({ product });
  }));

  return router;
}

module.exports = { createProductsRouter };
