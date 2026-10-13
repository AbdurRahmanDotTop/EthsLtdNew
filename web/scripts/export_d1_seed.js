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
    'EmailLog',
    'RmProfile',
    'RmConnection',
    'InvestmentContract',
    'RmConversation',
    'RmMessage',
    'RmNotification',
    'CryptoAsset',
    'FiatCurrency',
    'P2pChannelType',
    'P2pChannelField',
    'P2pSystemPaymentMethod',
    'P2pPaymentMethod',
    'P2pAd',
    'P2pOrder',
    'P2pMessage',
    'P2pDispute',
    'P2pFeedback'
  ];

  let sqlStatements = [];
  sqlStatements.push('-- ETHSLTD-NEW Complete Production Baseline Seed Data');
  sqlStatements.push('PRAGMA foreign_keys = OFF;');

  let totalRows = 0;
  for (const model of models) {
    const delegate = prisma[model.charAt(0).toLowerCase() + model.slice(1)];
    if (!delegate) {
      console.warn(`Delegate not found for model: ${model}`);
      continue;
    }

    const rows = await delegate.findMany();
    if (rows.length === 0) continue;

    for (const row of rows) {
      const keys = Object.keys(row);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const values = keys.map(k => escapeSql(row[k])).join(', ');
      sqlStatements.push(`INSERT OR IGNORE INTO "${model}" (${cols}) VALUES (${values});`);
    }
    console.log(`Exported ${rows.length} rows for ${model}`);
    totalRows += rows.length;
  }

  sqlStatements.push('PRAGMA foreign_keys = ON;');

  const outputPath = path.join(__dirname, '../prisma/seed_remote_d1_complete.sql');
  fs.writeFileSync(outputPath, sqlStatements.join('\n'), 'utf8');
  console.log(`Generated complete seed SQL (${totalRows} rows) at ${outputPath}`);
  await prisma.$disconnect();
}

exportData().catch(err => {
  console.error(err);
  process.exit(1);
});
