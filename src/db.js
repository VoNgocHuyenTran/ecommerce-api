require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before starting the application.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
