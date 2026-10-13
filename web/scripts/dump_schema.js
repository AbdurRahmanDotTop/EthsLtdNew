const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const schemaObjects = await prisma.$queryRawUnsafe(`
    SELECT type, name, sql 
    FROM sqlite_master 
    WHERE sql IS NOT NULL 
      AND name NOT LIKE '_prisma%' 
      AND name NOT LIKE 'sqlite_%'
    ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'index' THEN 2 ELSE 3 END, name;
  `);

  console.log(`Found ${schemaObjects.length} schema definitions`);
  const ddlStatements = schemaObjects.map(obj => {
    let sql = obj.sql.trim();
    if (!sql.endsWith(';')) sql += ';';
    return sql;
  });

  const fullSchemaSql = `-- Complete Production DDL for ethsltd-new
PRAGMA foreign_keys = OFF;

${ddlStatements.join('\n\n')}

PRAGMA foreign_keys = ON;
`;

  const outputPath = path.join(__dirname, '../prisma/schema_complete.sql');
  fs.writeFileSync(outputPath, fullSchemaSql, 'utf8');
  console.log(`Saved complete schema to ${outputPath}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
