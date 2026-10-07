require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before creating products.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  for (const product of [
    { pname: "X", price: "100.00", quantity: 100 },
    { pname: "Y", price: "200.00", quantity: 100 },
  ]) {
    const existing = await prisma.product.findFirst({
      where: { pname: product.pname },
      orderBy: { pid: "asc" },
    });
    const saved = existing || await prisma.product.create({ data: product });
    console.log(
      `${existing ? "Already exists" : "Created"} product ${saved.pname}: ` +
      `pid=${saved.pid}, price=${saved.price.toFixed(2)}, quantity=${saved.quantity}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Product setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
