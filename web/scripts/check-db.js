const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' ORDER BY name;");
  console.log("TABLES COUNT:", tables.length);
  console.log("TABLES:", tables.map(t => t.name));

  for (const t of tables) {
    try {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${t.name}"`);
      console.log(`Table ${t.name}: ${count[0].c} rows`);
    } catch (e) {
      console.log(`Table ${t.name}: error counting rows`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
