require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const [normalRole, adminRole, membership] = await Promise.all([
    prisma.role.upsert({
      where: { rolename: "normal" },
      update: {},
      create: { rolename: "normal" },
    }),
    prisma.role.upsert({
      where: { rolename: "admin" },
      update: {},
      create: { rolename: "admin" },
    }),
    prisma.membership.upsert({
      where: { mname: "normal" },
      update: {},
      create: { mname: "normal", score: 10 },
    }),
  ]);

  if (process.env.ADMIN_USERNAME || process.env.ADMIN_PASSWORD) {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      throw new Error("Set both ADMIN_USERNAME and ADMIN_PASSWORD to create an admin account.");
    }
    if (process.env.ADMIN_PASSWORD.length < 12) {
      throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
    }

    const password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await prisma.user.upsert({
      where: { username: process.env.ADMIN_USERNAME },
      update: { fullname: process.env.ADMIN_FULLNAME || "Store Administrator", roleid: adminRole.roleid },
      create: {
        username: process.env.ADMIN_USERNAME,
        fullname: process.env.ADMIN_FULLNAME || "Store Administrator",
        password,
        roleid: adminRole.roleid,
        mid: membership.mid,
      },
    });
  }

  console.log(`Seeded roles (${normalRole.rolename}, ${adminRole.rolename}) and normal membership (10 points).`);
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
