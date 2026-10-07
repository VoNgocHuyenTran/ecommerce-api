const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");

const jwtSecret = "unit-test-secret-that-is-at-least-32-characters";
let createdOrderData;

const prisma = {
  $queryRaw: async () => [{ "?column?": 1 }],
  $transaction: async (callback) => callback({
    product: {
      findMany: async () => [{ pid: 1, pname: "Tea", price: "4.50", quantity: 8 }],
      updateMany: async () => ({ count: 1 }),
    },
    order: {
      create: async ({ data }) => {
        createdOrderData = data;
        return {
          oid: 23,
          uid: data.uid,
          createat: new Date("2026-01-01T00:00:00.000Z"),
          orderDetails: [{
            oid: 23,
            pid: 1,
            qty: data.orderDetails.create[0].qty,
            unit_price: "4.50",
            product: { pid: 1, pname: "Tea", price: "4.50", quantity: 6 },
          }],
          shipments: [{ shipid: 45, oid: 23, status: data.shipments.create.status }],
        };
      },
    },
  }),
  role: {
    findUnique: async ({ where }) => ({ roleid: 1, rolename: where.rolename }),
  },
  membership: {
    findUnique: async ({ where }) => ({ mid: 1, mname: where.mname, score: 10 }),
  },
  product: {
    findMany: async () => [{ pid: 1, pname: "Tea", price: "4.50", quantity: 8 }],
    count: async () => 1,
  },
  user: {
    create: async ({ data }) => ({
      uid: 8,
      username: data.username,
      fullname: data.fullname,
      role: { rolename: "normal" },
      membership: { mname: "normal", score: 10 },
    }),
    findUnique: async () => ({
      uid: 7,
      username: "customer",
      fullname: "Test Customer",
      role: { rolename: "normal" },
      membership: { mname: "normal", score: 10 },
    }),
  },
};

let server;
let baseUrl;

before(async () => {
  server = createApp({ prisma, jwtSecret })
    .listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("health endpoint verifies the database and returns its status", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", database: "connected" });
});

test("product list returns products and pagination metadata", async () => {
  const response = await fetch(`${baseUrl}/api/v1/products?limit=5&offset=0`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    products: [{ pid: 1, pname: "Tea", price: "4.50", quantity: 8 }],
    pagination: { limit: 5, offset: 0, total: 1 },
  });
});

test("product list rejects invalid pagination", async () => {
  const response = await fetch(`${baseUrl}/api/v1/products?limit=101`);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /limit must be/);
});

test("protected endpoints reject missing and invalid bearer tokens", async () => {
  const missing = await fetch(`${baseUrl}/api/v1/auth/me`);
  assert.equal(missing.status, 401);

  const invalid = await fetch(`${baseUrl}/api/v1/orders`, {
    headers: { Authorization: "Bearer not-a-valid-token" },
  });
  assert.equal(invalid.status, 401);
});

test("registration assigns normal role and membership score 10 without returning password", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "new-rubric-user",
      fullname: "Rubric User",
      password: "a-secure-test-password",
    }),
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.user.role.rolename, "normal");
  assert.deepEqual(result.user.membership, { mname: "normal", score: 10 });
  assert.equal(Object.hasOwn(result.user, "password"), false);
  assert.equal(typeof result.token, "string");
});

test("authorized order creates a pending shipment in the same transaction", async () => {
  const token = jwt.sign(
    { uid: 7 },
    jwtSecret,
    { algorithm: "HS256", issuer: "ecommerce-api" },
  );
  const response = await fetch(`${baseUrl}/api/v1/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items: [{ pid: 1, qty: 2 }] }),
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.order.orderDetails[0].qty, 2);
  assert.deepEqual(result.order.shipments, [{ shipid: 45, oid: 23, status: "pending" }]);
  assert.deepEqual(createdOrderData.shipments, { create: { status: "pending" } });
});

test("unknown routes return a JSON 404", async () => {
  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /was not found/);
});
