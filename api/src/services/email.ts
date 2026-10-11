import { Bindings } from '../db';
import { platformSettings, emailDeliveryLogs } from 'database';
import { eq } from 'drizzle-orm';
import { renderVerificationEmail, renderAdminNotificationEmail, renderUserTransactionEmail, renderAdminTransactionEmail } from './email-templates';

// In-memory cache for settings
let settingsCache: Record<string, string> = {};
let lastCacheUpdate = 0;

async function getSetting(dbInstance: any, key: string, defaultValue: string = ''): Promise<string> {
  const now = Date.now();
  if (now - lastCacheUpdate > 60000 || !(key in settingsCache)) {
    // Refresh cache
    try {
      const settings = await dbInstance.select().from(platformSettings).all();
      settingsCache = {};
      for (const s of settings) {
        settingsCache[s.key] = s.value;
      }
      lastCacheUpdate = now;
    } catch (error) {
      console.error("Failed to fetch platformSettings for emails:", error);
      // Do not update lastCacheUpdate so it tries again next time,
      // but return defaultValue for now to prevent complete failure.
      return settingsCache[key] ?? defaultValue;
    }
  }
  return settingsCache[key] ?? defaultValue;
}

export class EmailService {
  private apiKey: string | null = null;
  private dbInstance: any;

  constructor(private env: Bindings, dbInstance: any) {
    this.dbInstance = dbInstance;
    if (env.BREVO_API_KEY) {
      this.apiKey = env.BREVO_API_KEY;
    } else {
      console.warn("BREVO_API_KEY not configured in environment variables.");
    }
  }

  private async sendMailWithLog(options: { to: string; subject: string; html: string; eventType: string }) {
    if (!this.apiKey) {
      console.log(`[Email Required (Key Missing)] To: ${options.to} | Subject: ${options.subject}`);
      return;
    }

    const logId = crypto.randomUUID();
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: "ETHSLTD", email: "support@ethsltd.com" },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Brevo API Error: ${response.status} ${errText}`);
      }

      await this.dbInstance.insert(emailDeliveryLogs).values({
        id: logId,
        recipient: options.to,
        subject: options.subject,
        eventType: options.eventType,
        status: 'SUCCESS',
        createdAt: new Date(),
      });
    } catch (error: any) {
      console.error(`Failed to send email [${options.eventType}] to ${options.to}:`, error);
      try {
        await this.dbInstance.insert(emailDeliveryLogs).values({
          id: logId,
          recipient: options.to,
          subject: options.subject,
          eventType: options.eventType,
          status: 'FAILED',
          errorMessage: error.message || String(error),
          createdAt: new Date(),
        });
      } catch(dbErr) {
        console.error("Failed to write email error log to database (ensure emailDeliveryLogs table exists):", dbErr);
      }
      
      // We must throw the error here so the caller knows the email failed to send
      throw error;
    }
  }

  // EVENT: New User Registration
  async sendAdminNewUserAlert(user: any, baseUrl: string = 'https://ethsltd.com') {
    const notifyEnabled = await getSetting(this.dbInstance, 'EMAIL_NOTIFY_NEW_USER', 'true');
    if (notifyEnabled !== 'true') return;

    const adminEmail = await getSetting(this.dbInstance, 'EMAIL_ADMIN', 'admin@ethsltd.com');
    const html = renderAdminNotificationEmail('New User Registration', {
      'Name': user.displayName || 'N/A',
      'Email': user.email,
      'User ID': user.id,
      'Timestamp': new Date().toISOString()
    }, `${baseUrl}/admin/users`, 'View Users');

    await this.sendMailWithLog({
      to: adminEmail,
      subject: 'System Alert: New User Registration',
      html,
      eventType: 'ADMIN_NEW_USER',
    });
  }

  // EVENT: Email Verification
  async sendVerificationEmail(email: string, token: string, baseUrl: string) {
    const notifyEnabled = await getSetting(this.dbInstance, 'NOTIFY_USER_VERIFY_EMAIL', 'true');
    if (notifyEnabled !== 'true') return;

    const verifyLink = `${baseUrl}/verify-email?token=${token}`;
    const html = renderVerificationEmail(verifyLink);

    await this.sendMailWithLog({
      to: email,
      subject: 'Verify your ETHSLTD Email Address',
      html,
      eventType: 'USER_VERIFY_EMAIL_LINK',
    });
  }

  // EVENT: Email Verification OTP
  async sendVerificationOTP(email: string, otp: string, baseUrl: string = 'https://ethsltd.com') {
    const html = renderUserTransactionEmail('Email Verification Code', `Your email verification code is <b>${otp}</b>. It expires in 15 minutes.`, [], `${baseUrl}/verify-email`, 'Enter Code Now');

    await this.sendMailWithLog({
      to: email,
      subject: `Your ETHSLTD Verification Code: ${otp}`,
      html,
      eventType: 'USER_VERIFY_EMAIL_OTP',
    });
  }

  // EVENT: Password Reset
  async sendPasswordResetEmail(email: string, token: string, baseUrl: string) {
    const resetLink = `${baseUrl}/reset-password?token=${token}`;
    const html = renderUserTransactionEmail('Password Reset Request', `You requested to reset your password. Click the link below. If you did not request this, please secure your account immediately.`, [
      { key: 'Action Required', value: `<a href="${resetLink}">Reset Password</a>` }
    ]);

    await this.sendMailWithLog({
      to: email,
      subject: 'ETHSLTD Password Reset',
      html,
      eventType: 'USER_PASSWORD_RESET',
    });
  }

  // EVENT: Real Deposit (Admin)
  async sendAdminDepositAlert(depositInfo: any, baseUrl: string = 'https://ethsltd.com') {
    const notifyEnabled = await getSetting(this.dbInstance, 'EMAIL_NOTIFY_DEPOSIT', 'true');
    if (notifyEnabled !== 'true') return;

    const adminEmail = await getSetting(this.dbInstance, 'EMAIL_ADMIN', 'admin@ethsltd.com');
    const html = renderAdminTransactionEmail('New Deposit Initiated', depositInfo, `${baseUrl}/admin/deposits`, 'View Deposits');

    await this.sendMailWithLog({
      to: adminEmail,
      subject: `Deposit Alert: ${depositInfo.amount} ${depositInfo.asset}`,
      html,
      eventType: 'ADMIN_DEPOSIT',
    });
  }

  // EVENT: Real Withdrawal (Admin)
  async sendAdminWithdrawalAlert(withdrawalInfo: any, baseUrl: string = 'https://ethsltd.com') {
    const notifyEnabled = await getSetting(this.dbInstance, 'EMAIL_NOTIFY_WITHDRAWAL', 'true');
    if (notifyEnabled !== 'true') return;

    const adminEmail = await getSetting(this.dbInstance, 'EMAIL_ADMIN', 'admin@ethsltd.com');
    const html = renderAdminTransactionEmail('New Withdrawal Requested', withdrawalInfo, `${baseUrl}/admin/withdrawals`, 'View Withdrawals');

    await this.sendMailWithLog({
      to: adminEmail,
      subject: `Withdrawal Alert: ${withdrawalInfo.amount} ${withdrawalInfo.asset}`,
      html,
      eventType: 'ADMIN_WITHDRAWAL',
    });
  }

  // EVENT: User Transaction (Generic)
  async sendUserTransactionAlert(email: string, title: string, message: string, details: {key: string, value: string}[], actionUrl?: string, actionText?: string) {
    const html = renderUserTransactionEmail(title, message, details, actionUrl, actionText);
    await this.sendMailWithLog({
      to: email,
      subject: title,
      html,
      eventType: 'USER_TRANSACTION',
    });
  }

  // EVENT: P2P Order (Admin)
  async sendAdminP2PAlert(orderInfo: any, baseUrl: string = 'https://ethsltd.com') {
    const notifyEnabled = await getSetting(this.dbInstance, 'EMAIL_NOTIFY_P2P', 'true');
    if (notifyEnabled !== 'true') return;
    const adminEmail = await getSetting(this.dbInstance, 'EMAIL_ADMIN', 'admin@ethsltd.com');
    
    const mappedInfo = {
      id: orderInfo.displayId || orderInfo.id,
      userId: orderInfo.buyerId || 'N/A',
      type: 'P2P Order',
      asset: orderInfo.asset || 'Crypto/Fiat',
      amount: `${orderInfo.cryptoAmount} (Fiat: ${orderInfo.fiatAmount})`,
      status: orderInfo.status
    };
    
    const html = renderAdminTransactionEmail('New P2P Order Activity', mappedInfo, `${baseUrl}/admin/p2p`, 'View P2P Orders');
    await this.sendMailWithLog({
      to: adminEmail,
      subject: `P2P Alert: Order ${mappedInfo.id}`,
      html,
      eventType: 'ADMIN_P2P',
    });
  }

  // EVENT: Trade (Admin)
  async sendAdminTradeAlert(tradeInfo: any, baseUrl: string = 'https://ethsltd.com') {
    const notifyEnabled = await getSetting(this.dbInstance, 'EMAIL_NOTIFY_TRADE', 'true');
    if (notifyEnabled !== 'true') return;
    const adminEmail = await getSetting(this.dbInstance, 'EMAIL_ADMIN', 'admin@ethsltd.com');
    
    const mappedTradeInfo = {
      id: tradeInfo.displayId || tradeInfo.id,
      userId: 'System Matched',
      type: 'Trade Execution',
      asset: tradeInfo.marketSymbol || tradeInfo.asset,
      amount: tradeInfo.amount,
      status: tradeInfo.status || 'FILLED'
    };
    
    const html = renderAdminTransactionEmail('New Trade Executed', mappedTradeInfo, `${baseUrl}/admin/orders`, 'View Trades');
    await this.sendMailWithLog({
      to: adminEmail,
      subject: `Trade Alert: ${mappedTradeInfo.amount} ${mappedTradeInfo.asset}`,
      html,
      eventType: 'ADMIN_TRADE',
    });
  }

  // EVENT: Transfer (Admin)
  async sendAdminTransferAlert(transferInfo: any, baseUrl: string = 'https://ethsltd.com') {
    const notifyEnabled = await getSetting(this.dbInstance, 'EMAIL_NOTIFY_TRANSFER', 'true');
    if (notifyEnabled !== 'true') return;
    const adminEmail = await getSetting(this.dbInstance, 'EMAIL_ADMIN', 'admin@ethsltd.com');
    const html = renderAdminTransactionEmail('New Internal Transfer', transferInfo, `${baseUrl}/admin/transactions`, 'View Transfers');
    await this.sendMailWithLog({
      to: adminEmail,
      subject: `Transfer Alert: ${transferInfo.amount} ${transferInfo.assetSymbol || transferInfo.asset}`,
      html,
      eventType: 'ADMIN_TRANSFER',
    });
  }
}
