require("dotenv").config();

const prisma = require("./db");
const { createApp } = require("./app");

const port = Number(process.env.PORT || 3000);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const app = createApp({ prisma });

async function start() {
  await prisma.$connect();
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`E-commerce API listening on port ${port}.`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; shutting down.`);
    server.close(async (error) => {
      if (error) {
        console.error("HTTP server shutdown failed:", error);
        process.exitCode = 1;
      }
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.error("Database disconnect failed:", disconnectError);
        process.exitCode = 1;
      }
    });
  }

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch(async (error) => {
  console.error("Application startup failed:", error);
  try {
    await prisma.$disconnect();
  } catch (disconnectError) {
    console.error("Database disconnect failed:", disconnectError);
  }
  process.exitCode = 1;
});
