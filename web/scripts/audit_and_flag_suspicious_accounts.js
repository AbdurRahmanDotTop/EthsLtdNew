/**
 * Suspicious User Account Audit & Safe Flagging Utility
 * ETHSLTD Security Suite
 *
 * Usage:
 *   node scripts/audit_and_flag_suspicious_accounts.js           (Dry run audit report)
 *   node scripts/audit_and_flag_suspicious_accounts.js --flag   (Apply safe status updates with audit trail)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'sharklasers.com',
  'tempmail.com',
  '10minutemail.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
  'nada.ltd',
  'getnada.com',
  'fakemailgenerator.com',
  'mohmal.com',
  'emailondeck.com',
]);

const DUMMY_TEST_DOMAINS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'test.com',
  'test.net',
  'invalid',
  'localhost',
]);

async function runAudit() {
  const shouldApplyFlags = process.argv.includes('--flag');

  console.log('========================================================================');
  console.log('           ETHSLTD SECURITY AUDIT: USER ACCOUNTS INVESTIGATION           ');
  console.log('========================================================================\n');
  console.log(`Execution Mode: ${shouldApplyFlags ? 'LIVE UPDATE (Audit logged)' : 'DRY RUN (Read only)'}\n`);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      uid: true,
      email: true,
      name: true,
      role: true,
      status: true,
      isKycVerified: true,
      isEmailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const legitimateAccounts = [];
  const suspiciousAccounts = [];

  for (const user of users) {
    const domain = (user.email.split('@')[1] || '').toLowerCase();
    const isDisposable = DISPOSABLE_DOMAINS.has(domain);
    const isDummy = DUMMY_TEST_DOMAINS.has(domain);
    const isTestBatch = /^test_recovery_\d+@/.test(user.email) || user.email === 'concurrency_tester@example.com' || /^test\d+@test\.com/.test(user.email);
    const isSystemStaff = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'RM' || domain === 'ethsltd.com';

    let riskLevel = 'LOW';
    let riskReason = 'Legitimate user registration';
    let suggestedStatus = user.status;

    if (isSystemStaff) {
      riskLevel = 'SAFE (STAFF)';
      riskReason = 'Verified institutional staff / administrator';
      suggestedStatus = user.status;
    } else if (isDisposable) {
      riskLevel = 'HIGH (DISPOSABLE)';
      riskReason = `Registered with confirmed disposable email provider: @${domain}`;
      suggestedStatus = 'FLAGGED_SPAM';
    } else if (isTestBatch) {
      riskLevel = 'HIGH (AUTOMATED BATCH)';
      riskReason = `Automated script test pattern with non-routable domain: @${domain}`;
      suggestedStatus = 'FLAGGED_SPAM';
    } else if (isDummy) {
      riskLevel = 'MEDIUM (DUMMY DOMAIN)';
      riskReason = `Registered with unverified test domain: @${domain}`;
      suggestedStatus = 'PENDING_VERIFICATION';
    } else if (!user.isEmailVerified && user.status === 'ACTIVE') {
      riskLevel = 'LOW (UNVERIFIED EMAIL)';
      riskReason = 'Legacy active status before mandatory email verification was enforced';
      suggestedStatus = user.status; // Keep active for existing users to prevent disruption
    }

    const reportItem = {
      ...user,
      domain,
      riskLevel,
      riskReason,
      suggestedStatus,
    };

    if (riskLevel.startsWith('HIGH') || riskLevel.startsWith('MEDIUM')) {
      suspiciousAccounts.push(reportItem);
    } else {
      legitimateAccounts.push(reportItem);
    }
  }

  console.log(`TOTAL ACCOUNTS ANALYZED: ${users.length}`);
  console.log(`- Legitimate / Staff Accounts: ${legitimateAccounts.length}`);
  console.log(`- Suspicious / Automated Accounts: ${suspiciousAccounts.length}\n`);

  console.log('------------------------------------------------------------------------');
  console.log(' SUSPICIOUS & AUTOMATED ACCOUNTS FOUND:');
  console.log('------------------------------------------------------------------------');
  suspiciousAccounts.forEach((acc, idx) => {
    console.log(`[${idx + 1}] UID #${acc.uid} | Current: ${acc.status} -> Action: ${acc.suggestedStatus}`);
    console.log(`    Email: ${acc.email} | Name: ${acc.name || 'N/A'}`);
    console.log(`    Risk: [${acc.riskLevel}] ${acc.riskReason}`);
    console.log(`    Created: ${acc.createdAt.toISOString()}`);
    console.log('');
  });

  if (shouldApplyFlags) {
    console.log('Applying safe status updates and recording security audit trail...');
    const adminUser = (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } })) || users[0];

    for (const acc of suspiciousAccounts) {
      if (acc.status !== acc.suggestedStatus) {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: acc.id },
            data: { status: acc.suggestedStatus },
          });

          await tx.auditLog.create({
            data: {
              adminId: adminUser.id,
              adminEmail: adminUser.email,
              action: 'ACCOUNT_FLAGGED_BY_SECURITY_AUDIT',
              targetType: 'USER',
              targetId: acc.id,
              details: `Account #${acc.uid} (${acc.email}) status changed from ${acc.status} to ${acc.suggestedStatus}. Reason: ${acc.riskReason}`,
            },
          });
        });
        console.log(`  ✓ Updated UID #${acc.uid} (${acc.email}) -> ${acc.suggestedStatus}`);
      }
    }
    console.log('\nAll updates applied safely without deleting any records or history.');
  } else {
    console.log('NOTE: This was a dry run. To apply these safe status flags, run:');
    console.log('  node scripts/audit_and_flag_suspicious_accounts.js --flag\n');
  }
}

runAudit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
