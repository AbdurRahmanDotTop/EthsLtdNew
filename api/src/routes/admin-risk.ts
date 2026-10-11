import { Hono } from 'hono';
import { Bindings, Variables } from '../db';
import { sql, eq, and, desc } from 'drizzle-orm';
import { riskAlerts, users, walletTransactions, auditLogs, wallets } from 'database';
import { jwtMiddleware as requireAuth, adminMiddleware } from '../middleware/jwt';

const adminRiskRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminRiskRouter.use('*', requireAuth);
adminRiskRouter.use('*', adminMiddleware);

adminRiskRouter.get('/summary', async (c) => {
  try {
    const db = c.get('db');
    
    // 1. Fetch live alerts
    const alerts = await db.select().from(riskAlerts)
      .where(eq(riskAlerts.resolved, false))
      .orderBy(desc(riskAlerts.createdAt))
      .limit(20);

    // 2. Compute KPIs
    // Flagged Withdrawals (Amount in USD roughly, or just sum of pending)
    const pendingWithdrawals = await db.select({ total: sql<number>`sum(amount)` })
      .from(walletTransactions)
      .where(and(eq(walletTransactions.type, 'WITHDRAWAL'), eq(walletTransactions.status, 'PENDING')));
    const flaggedWithdrawalsTotal = pendingWithdrawals[0]?.total || 0;

    // Suspicious Logins (Last 24h FAILED_LOGIN from auditLogs)
    const oneDayAgo = new Date(Date.now() - 86400000);
    const suspiciousLogins = await db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'FAILED_LOGIN'), sql`created_at >= ${oneDayAgo.getTime()}`));
    const suspiciousLoginsCount = suspiciousLogins[0]?.count || 0;

    // Platform Exposure (Ratio of locked balance vs total balance, simplified)
    const platformBalances = await db.select({
      total: sql<number>`sum(CAST(balance AS REAL))`,
      locked: sql<number>`sum(CAST(locked_balance AS REAL))`
    }).from(wallets);
    const totalBal = platformBalances[0]?.total || 0;
    const lockedBal = platformBalances[0]?.locked || 0;
    let exposureStatus = "Safe";
    if (totalBal > 0 && lockedBal / totalBal > 0.8) {
      exposureStatus = "High Risk";
    }

    // 3. Flagged Users (Users who have unresolved risk alerts)
    const flaggedUsersRaw = await db.select({
      id: users.id,
      email: users.email,
      status: users.status,
      alertCount: sql<number>`count(${riskAlerts.id})`,
      maxSeverity: sql<string>`max(${riskAlerts.severity})`
    })
    .from(users)
    .innerJoin(riskAlerts, eq(users.id, riskAlerts.userId))
    .where(eq(riskAlerts.resolved, false))
    .groupBy(users.id);

    const flaggedUsers = flaggedUsersRaw.map(u => {
      let score = 50;
      if (u.maxSeverity === 'CRITICAL') score = 95;
      else if (u.maxSeverity === 'HIGH') score = 80;
      else if (u.maxSeverity === 'MEDIUM') score = 65;
      
      score += Math.min(u.alertCount * 2, 20); // Add points for multiple alerts
      
      return {
        id: u.id,
        email: u.email,
        score: Math.min(score, 100),
        reason: `${u.alertCount} Active Alert(s) (Max: ${u.maxSeverity})`,
        status: u.status.toLowerCase(), // 'active', 'frozen', etc.
        exposure: "Pending Calc" // Can be enhanced later
      };
    });

    return c.json({
      success: true,
      data: {
        kpis: {
          activeLiquidations: 0, // 0 as futures module is separate
          flaggedWithdrawals: flaggedWithdrawalsTotal,
          suspiciousLogins: suspiciousLoginsCount,
          platformExposure: exposureStatus
        },
        flaggedUsers,
        alerts: alerts.map(a => ({
          id: a.id,
          message: a.details, // Using details as message
          severity: a.severity.toLowerCase(),
          createdAt: a.createdAt
        }))
      }
    });
  } catch (error: any) {
    console.error("Risk summary error:", error);
    return c.json({ success: false, error: 'Failed to fetch risk summary', details: error.message, stack: error.stack }, 500);
  }
});

export default adminRiskRouter;
