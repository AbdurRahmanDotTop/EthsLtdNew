const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function exportData() {
  const models = [
    'User',
    'Wallet',
    'BankCard',
    'UserCryptoWallet',
    'Order',
    'Transaction',
    'KycApplication',
    'DepositRequest',
    'WithdrawalRequest',
    'PaymentMethod',
    'AuditLog',
    'HeroSlide',
    'Market',
    'VerificationToken',
    'EmailConfig',
    'RmProfile',
    'RmConnection',
    'InvestmentContract',
    'RmConversation',
    'RmMessage',
    'RmNotification'
  ];

  let sqlStatements = [];
  sqlStatements.push('-- ETHSLTD-NEW Baseline Production Seed Data');
  sqlStatements.push('PRAGMA foreign_keys = OFF;');

  for (const model of models) {
    const delegate = prisma[model.charAt(0).toLowerCase() + model.slice(1)];
    if (!delegate) continue;

    const rows = await delegate.findMany();
    if (rows.length === 0) continue;

    for (const row of rows) {
      const keys = Object.keys(row);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const values = keys.map(k => escapeSql(row[k])).join(', ');
      sqlStatements.push(`INSERT OR IGNORE INTO "${model}" (${cols}) VALUES (${values});`);
    }
    console.log(`Exported ${rows.length} rows for ${model}`);
  }

  sqlStatements.push('PRAGMA foreign_keys = ON;');

  const outputPath = path.join(__dirname, '../prisma/seed_remote_d1.sql');
  fs.writeFileSync(outputPath, sqlStatements.join('\n'), 'utf8');
  console.log(`Generated SQL at ${outputPath}`);
  await prisma.$disconnect();
}

exportData().catch(err => {
  console.error(err);
  process.exit(1);
});
