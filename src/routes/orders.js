const express = require("express");
const { asyncRoute, httpError } = require("../errors");

function parseId(value, name) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw httpError(400, `${name} must be a positive integer.`);
  }
  return id;
}

function parseItems(body) {
  if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    throw httpError(400, "items must contain between 1 and 50 products.");
  }

  const seen = new Set();
  return body.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw httpError(400, "Each item must contain pid and qty.");
    }
    const { pid, qty } = item;
    if (!Number.isSafeInteger(pid) || pid < 1 || !Number.isSafeInteger(qty) || qty < 1) {
      throw httpError(400, "Each pid and qty must be a positive integer.");
    }
    if (seen.has(pid)) throw httpError(400, "Each product can appear only once in an order.");
    seen.add(pid);
    return { pid, qty };
  });
}

function createOrdersRouter(prisma, authenticate, requireAdmin) {
  const router = express.Router();

  router.use(authenticate);

  router.post("/", asyncRoute(async (req, res) => {
    const items = parseItems(req.body);
    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { pid: { in: items.map((item) => item.pid) } },
      });
      const productsById = new Map(products.map((product) => [product.pid, product]));

      for (const item of items) {
        const product = productsById.get(item.pid);
        if (!product) throw httpError(404, `Product ${item.pid} was not found.`);
        if (product.quantity < item.qty) {
          throw httpError(409, `Insufficient stock for product ${item.pid}.`);
        }
        const updated = await tx.product.updateMany({
          where: { pid: item.pid, quantity: { gte: item.qty } },
          data: { quantity: { decrement: item.qty } },
        });
        if (updated.count !== 1) {
          throw httpError(409, `Insufficient stock for product ${item.pid}.`);
        }
      }

      return tx.order.create({
        data: {
          uid: req.user.uid,
          orderDetails: {
            create: items.map((item) => ({
              pid: item.pid,
              qty: item.qty,
              unit_price: productsById.get(item.pid).price,
            })),
          },
          shipments: {
            create: { status: "pending" },
          },
        },
        include: {
          orderDetails: { include: { product: true } },
          shipments: true,
        },
      });
    });

    res.status(201).json({ order });
  }));

  router.get("/", asyncRoute(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: req.user.role.rolename === "admin" ? {} : { uid: req.user.uid },
      orderBy: { createat: "desc" },
      take: 100,
      include: { orderDetails: { include: { product: true } }, shipments: true },
    });
    res.json({ orders });
  }));

  router.get("/:oid/shipments", asyncRoute(async (req, res) => {
    const oid = parseId(req.params.oid, "oid");
    const order = await prisma.order.findFirst({
      where: req.user.role.rolename === "admin" ? { oid } : { oid, uid: req.user.uid },
      select: { oid: true },
    });
    if (!order) throw httpError(404, "Order not found.");
    const shipments = await prisma.shipment.findMany({
      where: { oid },
      orderBy: { shipid: "asc" },
    });
    res.json({ shipments });
  }));

  router.post("/:oid/shipments", requireAdmin, asyncRoute(async (req, res) => {
    const oid = parseId(req.params.oid, "oid");
    const order = await prisma.order.findUnique({ where: { oid }, select: { oid: true } });
    if (!order) throw httpError(404, "Order not found.");
    const shipment = await prisma.shipment.create({ data: { oid, status: "pending" } });
    res.status(201).json({ shipment });
  }));

  router.get("/:oid", asyncRoute(async (req, res) => {
    const oid = parseId(req.params.oid, "oid");
    const order = await prisma.order.findFirst({
      where: req.user.role.rolename === "admin" ? { oid } : { oid, uid: req.user.uid },
      include: { orderDetails: { include: { product: true } }, shipments: true },
    });
    if (!order) throw httpError(404, "Order not found.");
    res.json({ order });
  }));

  return router;
}

function createShipmentsRouter(prisma, authenticate, requireAdmin) {
  const router = express.Router();
  const allowedStatuses = new Set(["pending", "shipped", "delivered", "cancelled"]);

  router.patch("/:shipid", authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const shipid = parseId(req.params.shipid, "shipid");
    const { status } = req.body || {};
    if (typeof status !== "string" || !allowedStatuses.has(status)) {
      throw httpError(400, "status must be pending, shipped, delivered, or cancelled.");
    }

    const shipment = await prisma.shipment.update({
      where: { shipid },
      data: { status },
    });
    res.json({ shipment });
  }));

  return router;
}

module.exports = { createOrdersRouter, createShipmentsRouter };
