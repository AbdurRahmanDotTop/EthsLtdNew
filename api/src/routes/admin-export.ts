import { Hono } from 'hono';
import { Bindings, Variables } from '../db';
import { jwtMiddleware } from '../middleware/jwt';
import { users, kycProfiles, wallets, ledgerEntries, bankTransfers, real_manual_deposits, trades } from 'database';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

const adminExportRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminExportRouter.use('*', jwtMiddleware);

// Export Users
adminExportRouter.get('/users', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'COMPLIANCE_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const allUsers = await db.select().from(users).all();
    const allKyc = await db.select().from(kycProfiles).all();
    const allWallets = await db.select().from(wallets).all();

    // Map data
    const exportData = allUsers.map(u => {
      const kyc = allKyc.find(k => k.userId === u.id);
      const userWallets = allWallets.filter(w => w.userId === u.id);

      return {
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        status: u.status,
        // Removed riskLevel as it doesn't exist on users
        kycStatus: kyc?.status || 'PENDING',
        mfaEnabled: u.mfaEnabled,
        emailVerified: u.emailVerified,
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
        createdAt: new Date(u.createdAt).toISOString(),
        
        // KYC Details
        kycFirstName: kyc?.firstName || '',
        kycLastName: kyc?.lastName || '',
        kycCountry: kyc?.country || '',
        kycDocumentType: kyc?.documentType || '',
        
        // Balances
        realBalance: userWallets.find(w => w.assetSymbol === 'USDT')?.balance || 0,
      };
    });

    return c.json({ success: true, data: exportData });
  } catch (error: any) {
    console.error('User export error:', error);
    return c.json({ success: false, error: 'Failed to export users' }, 500);
  }
});

// Export Transactions
adminExportRouter.get('/transactions', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'COMPLIANCE_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    // Fetch ledger entries for a generalized view, or specific tables
    const ledger = await db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt)).limit(5000);
    
    const exportData = ledger.map(l => ({
      id: l.id,
      transactionId: l.transactionId,
      direction: l.direction,
      amount: l.amount,
      assetSymbol: l.assetSymbol,
      createdAt: new Date(l.createdAt).toISOString(),
    }));

    return c.json({ success: true, data: exportData });
  } catch (error: any) {
    console.error('Transaction export error:', error);
    return c.json({ success: false, error: 'Failed to export transactions' }, 500);
  }
});

export default adminExportRouter;
