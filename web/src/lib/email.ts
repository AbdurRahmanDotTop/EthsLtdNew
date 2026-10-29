import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  EmailCategory,
  resolveEmailSenderName,
  getCategoryForEventType,
  FIAT_CURRENCIES,
  formatFromHeader,
} from "./email-categories";
import { getAppUrlSync, sanitizeEmailUrl } from "./app-url";

export { EmailCategory, resolveEmailSenderName, getCategoryForEventType, formatFromHeader };

export interface SendEmailOptions {
  to: string;
  subject: string;
  category?: EmailCategory;
  eventType:
    | "WELCOME"
    | "RESET_PASSWORD"
    | "RESET_PIN"
    | "PASSWORD_CHANGED"
    | "PIN_CHANGED"
    | "LOGIN_ALERT"
    | "DEPOSIT_STATUS"
    | "WITHDRAWAL_STATUS"
    | "KYC_STATUS"
    | "ORDER_EXECUTION"
    | "P2P_ORDER_STATUS"
    | "ADMIN_ALERT"
    | "TEST_EMAIL"
    | string;
  html: string;
  text?: string;
  providerOverrideId?: string;
  metadata?: {
    asset?: string;
    isFiat?: boolean;
    role?: string;
    [key: string]: any;
  };
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerUsed?: string;
}

/**
 * Fetch the active EmailConfig (DB priority, followed by ENV variables and Cloudflare Workers secrets)
 */
export async function getActiveEmailConfig(configId?: string) {
  try {
    let cfEnv: any = {};
    try {
      const cf = getCloudflareContext({ async: false });
      if (cf?.env) cfEnv = cf.env;
    } catch {}

    const envBrevoKey = (process.env.BREVO_API_KEY || cfEnv.BREVO_API_KEY || "").trim();
    const envFromEmail = process.env.EMAIL_FROM || cfEnv.EMAIL_FROM || "support@ethsltd.com";
    const envFromName = process.env.EMAIL_FROM_NAME || cfEnv.EMAIL_FROM_NAME || "ETHSLTD Security";
    const envReplyTo = process.env.EMAIL_REPLY_TO || cfEnv.EMAIL_REPLY_TO || null;

    if (configId) {
      const explicit = await prisma.emailConfig.findUnique({ where: { id: configId } });
      if (explicit) {
        if (explicit.provider === "BREVO" && !explicit.apiKey && envBrevoKey) {
          explicit.apiKey = envBrevoKey;
        }
        return explicit;
      }
    }

    // Default enabled provider from DB
    const dbDefault = await prisma.emailConfig.findFirst({
      where: { isDefault: true, enabled: true },
    });
    if (dbDefault) {
      if (dbDefault.provider === "BREVO" && !dbDefault.apiKey && envBrevoKey) {
        dbDefault.apiKey = envBrevoKey;
      }
      return dbDefault;
    }

    // Any enabled provider from DB
    const anyEnabled = await prisma.emailConfig.findFirst({
      where: { enabled: true },
      orderBy: { updatedAt: "desc" },
    });
    if (anyEnabled) {
      if (anyEnabled.provider === "BREVO" && !anyEnabled.apiKey && envBrevoKey) {
        anyEnabled.apiKey = envBrevoKey;
      }
      return anyEnabled;
    }

    // Check environment / Cloudflare Workers secrets as fallback
    if (envBrevoKey) {
      return {
        id: "env-brevo",
        provider: "BREVO",
        name: "Brevo API (Environment)",
        apiKey: envBrevoKey,
        fromEmail: envFromEmail,
        fromName: envFromName,
        replyTo: envReplyTo,
        enabled: true,
        isDefault: true,
      };
    }

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      return {
        id: "env-smtp",
        provider: "SMTP",
        name: "SMTP Relay (Environment)",
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        encryption: process.env.SMTP_SECURE === "true" ? "SSL" : "TLS",
        username: process.env.SMTP_USER,
        password: process.env.SMTP_PASS || "",
        fromEmail: envFromEmail,
        fromName: envFromName,
        replyTo: envReplyTo,
        enabled: true,
        isDefault: true,
      };
    }

    return null;
  } catch (err) {
    console.error("Error fetching email configuration:", err);
    return null;
  }
}

/**
 * Send email via Brevo REST API v3
 */
async function sendViaBrevoApi(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  to: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  replyTo?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    };
    if (textContent) payload.textContent = textContent;
    if (replyTo) payload.replyTo = { email: replyTo };

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey.trim(),
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const errMsg = String(data.message || `Brevo API error ${res.status}: ${res.statusText}`);
      console.error(`[ETHSLTD Email] Brevo API error (${res.status}):`, errMsg);
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      messageId: String(data.messageId || `brevo-${Date.now()}`),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[ETHSLTD Email] Brevo transmission error:", errorMsg);
    return { success: false, error: errorMsg || "Network error contacting Brevo API" };
  }
}

/**
 * Send email via Nodemailer (Custom SMTP / Hostinger / Brevo SMTP Relay)
 */
async function sendViaSmtp(
  host: string,
  port: number,
  encryption: string,
  username?: string | null,
  password?: string | null,
  fromEmail: string = "support@ethsltd.com",
  fromName: string = "ETHSLTD Security",
  to: string = "",
  subject: string = "",
  html: string = "",
  text?: string,
  replyTo?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const isSecure = encryption === "SSL" || port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure, // true for 465, false for other ports (587, 25)
      auth:
        username && password
          ? {
              user: username.trim(),
              pass: password.trim(),
            }
          : undefined,
      tls: {
        rejectUnauthorized: false, // Prevents self-signed cert blocks on custom hostings
      },
      connectionTimeout: 10000, // 10s timeout
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ""),
      replyTo: replyTo || undefined,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg || "SMTP transmission error" };
  }
}

/**
 * Core sendEmail dispatcher with database logging and error protection
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
  const { to, subject, eventType, html, text, providerOverrideId, category, metadata } = options;

  // Resolve institutional email category and consistent display sender name
  const effectiveCategory = category || getCategoryForEventType(eventType, metadata);
  const fromName = resolveEmailSenderName(effectiveCategory);

  let config: Awaited<ReturnType<typeof getActiveEmailConfig>> = null;
  try {
    config = await getActiveEmailConfig(providerOverrideId);
  } catch (err) {
    console.error("Failed to read email config:", err);
  }

  if (!config) {
    const errorMsg = "No active email provider configured in Admin Email Settings or ENV.";
    console.warn(`[ETHSLTD Email] Skipped '${eventType}' [Category: ${effectiveCategory}, Sender: "${fromName}"] to ${to}: ${errorMsg}`);
    
    // Log failure
    try {
      await prisma.emailLog.create({
        data: {
          recipient: to,
          subject,
          eventType,
          provider: `NONE [${fromName}]`,
          status: "FAILED",
          errorMessage: errorMsg,
        },
      });
    } catch {}

    return { success: false, error: errorMsg, providerUsed: `NONE [${fromName}]` };
  }

  let result: { success: boolean; messageId?: string; error?: string } = {
    success: false,
    error: "Provider unknown",
  };

  const providerType = config.provider || "SMTP";
  const fromEmail = config.fromEmail || process.env.EMAIL_FROM || "support@ethsltd.com";

  try {
    if (providerType === "BREVO" && config.apiKey) {
      result = await sendViaBrevoApi(
        config.apiKey,
        fromEmail,
        fromName,
        to,
        subject,
        html,
        text,
        config.replyTo
      );
    } else {
      // SMTP (Hostinger, Brevo SMTP relay, or custom)
      const host = config.host || (providerType === "BREVO" ? "smtp-relay.brevo.com" : "smtp.hostinger.com");
      const port = config.port || 587;
      const encryption = config.encryption || "TLS";

      result = await sendViaSmtp(
        host,
        port,
        encryption,
        config.username,
        config.password,
        fromEmail,
        fromName,
        to,
        subject,
        html,
        text,
        config.replyTo
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result = { success: false, error: errorMsg || "Unknown dispatch failure" };
  }

  // Record audit log to DB
  try {
    await prisma.emailLog.create({
      data: {
        recipient: to,
        subject,
        eventType,
        provider: `${providerType} [${fromName}] (${config.name || "Default"})`,
        status: result.success ? "SENT" : "FAILED",
        errorMessage: result.error || null,
        messageId: result.messageId || null,
      },
    });
  } catch (logErr) {
    console.error("Failed to write to EmailLog:", logErr);
  }

  return {
    ...result,
    providerUsed: `${providerType} [${fromName}] - ${config.name || "Default"}`,
  };
}

/**
 * Branded HTML Email Template Builder
 */
export function buildEmailTemplate({
  title,
  preheader,
  contentHtml,
  callToAction,
  noteText,
}: {
  title: string;
  preheader?: string;
  contentHtml: string;
  callToAction?: { text: string; url: string };
  noteText?: string;
}) {
  const currentYear = new Date().getFullYear();
  const ctaUrl = callToAction?.url ? sanitizeEmailUrl(callToAction.url) : "";
  const ctaBlock = callToAction && ctaUrl
    ? `
      <div style="margin: 28px 0; text-align: center;">
        <a href="${ctaUrl}" style="background: linear-gradient(135deg, #00A070 0%, #10B981 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(0, 160, 112, 0.35);">
          ${callToAction.text}
        </a>
      </div>
    `
    : "";

  const noteBlock = noteText
    ? `
      <div style="margin-top: 24px; padding: 14px 16px; background-color: #12141C; border-left: 3px solid #F59E0B; border-radius: 6px; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
        ${noteText}
      </div>
    `
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0B0E14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E5E7EB; }
    .email-container { max-width: 580px; margin: 30px auto; background-color: #161822; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); }
    .header { padding: 32px 32px 24px 32px; text-align: center; background-color: #1A1D2B; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    .logo-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: 1.5px; }
    .content { padding: 32px; }
    .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #00A070; background-color: #0E1017; padding: 16px 24px; border-radius: 10px; display: inline-block; border: 1px dashed rgba(0, 160, 112, 0.4); margin: 16px 0; }
    .footer { padding: 24px 32px; text-align: center; font-size: 11px; color: #6B7280; background-color: #12141C; border-top: 1px solid rgba(255, 255, 255, 0.05); line-height: 1.6; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
  <div class="email-container">
    <div class="header">
      <div class="logo-badge">
        <span style="color: #00A070;">◆</span> ETHSLTD CRYPTO
      </div>
      <p style="margin: 6px 0 0 0; font-size: 11px; color: #9CA3AF; letter-spacing: 1px; text-transform: uppercase;">Institutional Grade Crypto Trading</p>
    </div>
    
    <div class="content">
      <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #FFFFFF;">${title}</h1>
      <div style="font-size: 14px; line-height: 1.6; color: #D1D5DB;">
        ${contentHtml}
      </div>
      ${ctaBlock}
      ${noteBlock}
    </div>

    <div class="footer">
      <p style="margin: 0 0 8px 0;">This is an automated system notification from ETHSLTD Trading Platform. Please do not share verification codes or passwords with anyone.</p>
      <p style="margin: 0;">&copy; ${currentYear} ETHSLTD Inc. All rights reserved. • High-Security Financial Protocol</p>
    </div>
  </div>
</body>
</html>
  `;
}

// -------------------------------------------------------------
// High-Level Notification Dispatchers
// -------------------------------------------------------------

export async function sendWelcomeNotification(user: { email: string; name?: string | null; uid: number }) {
  const html = buildEmailTemplate({
    title: `Welcome to ETHSLTD Trading`,
    preheader: `Your account is ready. UID: ${user.uid}`,
    contentHtml: `
      <p>Hello <strong>${user.name || user.email}</strong>,</p>
      <p>Welcome to <strong>ETHSLTD</strong>, your institutional-grade crypto trading and options platform. Your account has been registered with UID <strong>#${user.uid}</strong>.</p>
      <div style="background-color: #12141C; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #9CA3AF;"><strong>Your UID:</strong> #${user.uid}</p>
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #9CA3AF;"><strong>Security Status:</strong> Initialized</p>
        <p style="margin: 0; font-size: 13px; color: #9CA3AF;"><strong>Next Step:</strong> Complete KYC verification and deposit funds to start trading.</p>
      </div>
    `,
    callToAction: {
      text: "Go to Trader Dashboard",
      url: `${getAppUrlSync()}/assets`,
    },
    noteText: "Security Reminder: ETHSLTD staff will never ask for your password, PIN, or private keys.",
  });

  return sendEmail({
    to: user.email,
    subject: `Welcome to ETHSLTD [UID: #${user.uid}]`,
    eventType: "WELCOME",
    category: EmailCategory.SECURITY,
    html,
  });
}

export async function sendEmailVerificationOtpNotification(data: { email: string; otpCode: string; verifyUrl?: string }) {
  const effectiveVerifyUrl = data.verifyUrl
    ? sanitizeEmailUrl(data.verifyUrl)
    : `${getAppUrlSync()}/verify-email?email=${encodeURIComponent(data.email)}&code=${data.otpCode}`;

  const html = buildEmailTemplate({
    title: `Verify Your Email Address`,
    preheader: `Your 6-digit email verification code is ${data.otpCode}`,
    contentHtml: `
      <p>Thank you for registering with <strong>ETHSLTD</strong>. To complete your account security setup and activate full trading access, please verify your email address.</p>
      <p>Use your 6-digit confirmation code below:</p>
      <div style="text-align: center; margin: 24px 0;">
        <div class="otp-code">${data.otpCode}</div>
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">This verification code expires in <strong>15 minutes</strong>. If you did not create an ETHSLTD account, please disregard this email.</p>
    `,
    callToAction: {
      text: "Verify Account Now",
      url: effectiveVerifyUrl,
    },
    noteText: "ETHSLTD Security: Never disclose your OTP code or credentials to anyone.",
  });

  return sendEmail({
    to: data.email,
    subject: `Confirm Your Email: ${data.otpCode} - ETHSLTD Verification`,
    eventType: "EMAIL_VERIFICATION",
    category: EmailCategory.VERIFICATION,
    html,
  });
}

export async function sendPasswordResetNotification(data: { email: string; otpCode: string; resetUrl: string }) {
  const html = buildEmailTemplate({
    title: `Password Reset Request`,
    preheader: `Your password reset verification code is ${data.otpCode}`,
    contentHtml: `
      <p>We received a request to reset the login password for your ETHSLTD account.</p>
      <p>Use the 6-digit verification code below or click the button to proceed:</p>
      <div style="text-align: center; margin: 20px 0;">
        <div class="otp-code">${data.otpCode}</div>
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">This verification code and link will expire in <strong>15 minutes</strong>. If you did not initiate this request, your account is still secure and you can safely ignore this email.</p>
    `,
    callToAction: {
      text: "Reset My Password",
      url: sanitizeEmailUrl(data.resetUrl),
    },
    noteText: "Do not forward or share this code with anyone. ETHSLTD will never call or message asking for your code.",
  });

  return sendEmail({
    to: data.email,
    subject: `Password Reset Code: ${data.otpCode} - ETHSLTD Security`,
    eventType: "RESET_PASSWORD",
    category: EmailCategory.SECURITY,
    html,
  });
}

export async function sendPinResetNotification(data: { email: string; otpCode: string; resetUrl: string }) {
  const html = buildEmailTemplate({
    title: `Transaction PIN Recovery`,
    preheader: `Your Transaction PIN recovery code is ${data.otpCode}`,
    contentHtml: `
      <p>We received a request to recover or reset your <strong>Security Transaction PIN</strong>.</p>
      <p>Use the 6-digit verification code below to authorize your new Transaction PIN:</p>
      <div style="text-align: center; margin: 20px 0;">
        <div class="otp-code">${data.otpCode}</div>
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">This recovery code expires in <strong>15 minutes</strong> and can only be used once. If you did not request this, please change your login password immediately.</p>
    `,
    callToAction: {
      text: "Reset Transaction PIN",
      url: sanitizeEmailUrl(data.resetUrl),
    },
    noteText: "Your Transaction PIN protects all withdrawals and asset transfers.",
  });

  return sendEmail({
    to: data.email,
    subject: `Transaction PIN Recovery Code: ${data.otpCode} - ETHSLTD`,
    eventType: "RESET_PIN",
    category: EmailCategory.SECURITY,
    html,
  });
}

export async function sendPasswordChangedNotification(data: { email: string }) {
  const html = buildEmailTemplate({
    title: `Security Alert: Password Changed`,
    preheader: `Your ETHSLTD account password was recently updated`,
    contentHtml: `
      <p>This is a confirmation that your account login password was successfully changed on <strong>${new Date().toUTCString()}</strong>.</p>
      <p>If you made this change, no further action is required.</p>
    `,
    callToAction: {
      text: "Review Account Security",
      url: `${getAppUrlSync()}/security/password`,
    },
    noteText: "CRITICAL: If you did not make this change, please contact our emergency security desk immediately.",
  });

  return sendEmail({
    to: data.email,
    subject: `Security Alert: Login Password Changed - ETHSLTD`,
    eventType: "PASSWORD_CHANGED",
    category: EmailCategory.SECURITY,
    html,
  });
}

export async function sendPinChangedNotification(data: { email: string }) {
  const html = buildEmailTemplate({
    title: `Security Alert: Transaction PIN Updated`,
    preheader: `Your withdrawal transaction PIN was changed`,
    contentHtml: `
      <p>This is a confirmation that your <strong>Security Transaction PIN</strong> was successfully reset on <strong>${new Date().toUTCString()}</strong>.</p>
      <p>Your new PIN is now active for authorizing withdrawals and transfers.</p>
    `,
    callToAction: {
      text: "Check Assets & Security",
      url: `${getAppUrlSync()}/assets`,
    },
    noteText: "If you did not authorize this change, please report it to support immediately.",
  });

  return sendEmail({
    to: data.email,
    subject: `Security Alert: Transaction PIN Changed - ETHSLTD`,
    eventType: "PIN_CHANGED",
    category: EmailCategory.SECURITY,
    html,
  });
}

export async function sendDepositNotification(data: {
  email: string;
  amount: number;
  asset: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  referenceNumber?: string;
  reason?: string;
  category?: EmailCategory;
}) {
  const isApproved = data.status === "APPROVED";
  const isRejected = data.status === "REJECTED";
  const statusColor = isApproved ? "#10B981" : isRejected ? "#EF4444" : "#F59E0B";
  const isFiat = FIAT_CURRENCIES.has((data.asset || "").toUpperCase());
  const category = data.category || (isFiat ? EmailCategory.PAYMENTS : EmailCategory.WALLET);

  const html = buildEmailTemplate({
    title: `Deposit Update: ${data.status}`,
    preheader: `Your deposit of ${data.amount} ${data.asset} is ${data.status.toLowerCase()}`,
    contentHtml: `
      <p>Your deposit request has an updated status:</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${statusColor};">
        <p style="margin: 0 0 6px 0;"><strong>Amount:</strong> ${data.amount} ${data.asset}</p>
        <p style="margin: 0 0 6px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 700;">${data.status}</span></p>
        ${data.referenceNumber ? `<p style="margin: 0 0 6px 0; font-size: 12px; color: #9CA3AF;"><strong>Ref #:</strong> ${data.referenceNumber}</p>` : ""}
        ${data.reason ? `<p style="margin: 0; font-size: 13px; color: #EF4444;"><strong>Reason:</strong> ${data.reason}</p>` : ""}
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">${isApproved ? "The funds have been credited to your Currency Wallet balance." : isRejected ? "The deposit could not be verified. Please check the rejection reason." : "Our treasury team is verifying your payment submission."}</p>
    `,
    callToAction: {
      text: "View Assets & Records",
      url: `${getAppUrlSync()}/assets/records`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `Deposit ${data.status}: ${data.amount} ${data.asset} - ETHSLTD`,
    eventType: "DEPOSIT_STATUS",
    category,
    metadata: { asset: data.asset, isFiat },
    html,
  });
}

export async function sendWithdrawalNotification(data: {
  email: string;
  amount: number;
  asset: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  receiveAmount?: number;
  reason?: string;
  category?: EmailCategory;
}) {
  const isApproved = data.status === "APPROVED";
  const isRejected = data.status === "REJECTED";
  const statusColor = isApproved ? "#10B981" : isRejected ? "#EF4444" : "#F59E0B";
  const isFiat = FIAT_CURRENCIES.has((data.asset || "").toUpperCase()) || Boolean(data.receiveAmount);
  const category = data.category || (isFiat ? EmailCategory.PAYMENTS : EmailCategory.WALLET);

  const html = buildEmailTemplate({
    title: `Withdrawal Update: ${data.status}`,
    preheader: `Your withdrawal of ${data.amount} ${data.asset} is ${data.status.toLowerCase()}`,
    contentHtml: `
      <p>Your withdrawal request status has changed:</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${statusColor};">
        <p style="margin: 0 0 6px 0;"><strong>Gross Amount:</strong> ${data.amount} ${data.asset}</p>
        ${data.receiveAmount ? `<p style="margin: 0 0 6px 0;"><strong>Net Payout:</strong> ${data.receiveAmount} ${data.asset}</p>` : ""}
        <p style="margin: 0 0 6px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 700;">${data.status}</span></p>
        ${data.reason ? `<p style="margin: 0; font-size: 13px; color: #EF4444;"><strong>Reason:</strong> ${data.reason}</p>` : ""}
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">${isApproved ? "Funds have been dispatched to your destination." : isRejected ? "The withdrawal request was rejected and funds have been released back to your available balance." : "Your request is currently awaiting admin authorization."}</p>
    `,
    callToAction: {
      text: "View Transaction History",
      url: `${getAppUrlSync()}/assets/records`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `Withdrawal ${data.status}: ${data.amount} ${data.asset} - ETHSLTD`,
    eventType: "WITHDRAWAL_STATUS",
    category,
    metadata: { asset: data.asset, isFiat },
    html,
  });
}

export async function sendKycNotification(data: {
  email: string;
  status: "APPROVED" | "REJECTED" | "ADDITIONAL_INFO_REQUIRED";
  reason?: string;
}) {
  const isApproved = data.status === "APPROVED";
  const isPendingInfo = data.status === "ADDITIONAL_INFO_REQUIRED";
  const statusColor = isApproved ? "#10B981" : isPendingInfo ? "#F59E0B" : "#EF4444";
  const displayStatus = isApproved
    ? "APPROVED"
    : isPendingInfo
    ? "ADDITIONAL INFO REQUIRED"
    : "REJECTED";

  const html = buildEmailTemplate({
    title: `KYC Verification: ${displayStatus}`,
    preheader: `Your Identity Verification status has been updated: ${displayStatus}`,
    contentHtml: `
      <p>Your KYC (Know Your Customer) verification application has been reviewed by compliance.</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${statusColor};">
        <p style="margin: 0 0 6px 0;"><strong>Result:</strong> <span style="color: ${statusColor}; font-weight: 700;">${displayStatus}</span></p>
        ${data.reason ? `<p style="margin: 0; font-size: 13px; color: ${statusColor};"><strong>Notes / Instructions:</strong> ${data.reason}</p>` : ""}
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">${
        isApproved
          ? "Your account now has verified trader status with unlocked trading and withdrawal limits."
          : isPendingInfo
          ? "Please review compliance remarks and provide the requested document or detail to complete your verification."
          : "You may resubmit your identity documents with clearer photos and matching information."
      }</p>
    `,
    callToAction: {
      text: isApproved ? "Start Trading" : isPendingInfo ? "Provide Documents" : "Resubmit KYC",
      url: `${getAppUrlSync()}/profile/kyc`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `KYC Identity Verification ${displayStatus} - ETHSLTD`,
    eventType: "KYC_STATUS",
    category: EmailCategory.VERIFICATION,
    html,
  });
}

export async function sendKycSubmissionConfirmation(data: {
  email: string;
  name?: string | null;
  uid?: number | null;
  documentType: string;
  attemptCount?: number;
}) {
  const html = buildEmailTemplate({
    title: `Identity Verification Submitted`,
    preheader: `Your ${data.documentType} verification has been received and is under review`,
    contentHtml: `
      <p>Hello <strong>${data.name || data.email}</strong>,</p>
      <p>We have successfully received your <strong>${data.documentType}</strong> documents for KYC (Know Your Customer) identity verification.</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #3B82F6;">
        ${data.uid ? `<p style="margin: 0 0 6px 0;"><strong>UID:</strong> #${data.uid}</p>` : ""}
        <p style="margin: 0 0 6px 0;"><strong>Document Type:</strong> ${data.documentType}</p>
        <p style="margin: 0 0 6px 0;"><strong>Status:</strong> <span style="color: #3B82F6; font-weight: 700;">UNDER REVIEW</span></p>
        ${data.attemptCount ? `<p style="margin: 0; font-size: 12px; color: #9CA3AF;"><strong>Submission Attempt:</strong> #${data.attemptCount}</p>` : ""}
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">Our compliance and risk team is reviewing your documents. Reviews typically take between 15 minutes to a few hours during business hours. You will receive an email as soon as your verification status is updated.</p>
    `,
    callToAction: {
      text: "View Verification Status",
      url: `${getAppUrlSync()}/profile/kyc`,
    },
    noteText: "Notice: You do not need to resubmit while your verification is pending review.",
  });

  return sendEmail({
    to: data.email,
    subject: `KYC Documents Received (Under Review) - ETHSLTD`,
    eventType: "KYC_STATUS",
    category: EmailCategory.VERIFICATION,
    html,
  });
}

export async function sendLoginAlertNotification(data: {
  email: string;
  ip?: string;
  userAgent?: string;
  time?: string;
}) {
  const html = buildEmailTemplate({
    title: `Security Alert: New Sign-in Detected`,
    preheader: `A new login to your ETHSLTD account was detected`,
    contentHtml: `
      <p>A new sign-in to your <strong>ETHSLTD</strong> trading account was recorded.</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #10B981;">
        <p style="margin: 0 0 6px 0;"><strong>Time:</strong> ${data.time || new Date().toUTCString()}</p>
        ${data.ip ? `<p style="margin: 0 0 6px 0;"><strong>IP Address:</strong> ${data.ip}</p>` : ""}
        ${data.userAgent ? `<p style="margin: 0; font-size: 12px; color: #9CA3AF;"><strong>Device / Browser:</strong> ${data.userAgent}</p>` : ""}
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">If this was you, you can safely ignore this notification. If you did not sign in recently, change your password immediately and contact security support.</p>
    `,
    callToAction: {
      text: "Security Dashboard",
      url: `${getAppUrlSync()}/profile`,
    },
    noteText: "Never share your credentials with anyone. ETHSLTD support will never ask for your password.",
  });

  return sendEmail({
    to: data.email,
    subject: `Security Alert: New Login to ETHSLTD`,
    eventType: "LOGIN_ALERT",
    category: EmailCategory.SECURITY,
    html,
  });
}

export type AdminEventType = "REGISTRATION" | "REGISTRATION_VERIFIED" | "DEPOSIT" | "WITHDRAWAL" | "KYC" | "P2P_DISPUTE";

export async function sendAdminEventNotification(data: {
  eventType: AdminEventType;
  title: string;
  message: string;
  details?: Record<string, string | number | boolean>;
}) {
  try {
    const config = await prisma.emailConfig.findFirst({
      where: { enabled: true },
      orderBy: { isDefault: "desc" },
    });

    const adminEmailsStr = (config?.adminEmails || process.env.ADMIN_EMAIL || "admin@ethsltd.com").trim();

    // Check preference flags if config exists
    if (config) {
      if ((data.eventType === "REGISTRATION" || data.eventType === "REGISTRATION_VERIFIED") && config.notifyOnRegistration === false) return { success: true };
      if (data.eventType === "DEPOSIT" && config.notifyOnDeposit === false) return { success: true };
      if (data.eventType === "WITHDRAWAL" && config.notifyOnWithdrawal === false) return { success: true };
      if (data.eventType === "KYC" && config.notifyOnKyc === false) return { success: true };
    }

    const recipients: string[] = adminEmailsStr
      .split(",")
      .map((e: string) => e.trim())
      .filter((e: string) => e.includes("@"));

    if (recipients.length === 0) return { success: false, error: "No valid admin email recipients" };

    const detailHtml = data.details
      ? Object.entries(data.details)
          .map(([k, v]) => `<p style="margin: 4px 0; font-size: 12px; color: #9CA3AF;"><strong>${k}:</strong> ${String(v)}</p>`)
          .join("")
      : "";

    const html = buildEmailTemplate({
      title: `[ADMIN ALERT] ${data.title}`,
      preheader: data.message,
      contentHtml: `
        <p style="color: #F59E0B; font-weight: 700;">Administrative Action Required / Notice</p>
        <p>${data.message}</p>
        ${detailHtml ? `<div style="background-color: #12141C; padding: 14px; border-radius: 8px; margin: 14px 0;">${detailHtml}</div>` : ""}
      `,
      callToAction: {
        text: "Open Admin Console",
        url: `${getAppUrlSync()}/admin`,
      },
    });

    const results = await Promise.all(
      recipients.map((to: string) =>
        sendEmail({
          to,
          subject: `[ADMIN] ${data.title} - ETHSLTD`,
          eventType: "ADMIN_ALERT",
          category: EmailCategory.ADMIN_ALERTS,
          html,
        })
      )
    );

    return { success: results.some((r) => r.success) };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("sendAdminEventNotification failed:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function sendTestEmail(toEmail: string, configId?: string) {
  const html = buildEmailTemplate({
    title: `ETHSLTD SMTP & Email Service Test`,
    preheader: `Verification of outbound email delivery connection`,
    contentHtml: `
      <p>Congratulations! If you are reading this email, your <strong>ETHSLTD Email Delivery System</strong> is functioning properly.</p>
      <div style="background-color: #12141C; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p style="margin: 0 0 6px 0;"><strong>Recipient:</strong> ${toEmail}</p>
        <p style="margin: 0; color: #00A070; font-weight: 700;">Status: Outbound Connection Verified</p>
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">Transactional notifications for user registrations, password resets, PIN recoveries, deposits, and withdrawals are ready to be dispatched.</p>
    `,
    callToAction: {
      text: "Open Admin Settings",
      url: `${getAppUrlSync()}/admin/email-settings`,
    },
  });

  return sendEmail({
    to: toEmail,
    subject: `[TEST EMAIL] Outbound Delivery Verification - ETHSLTD`,
    eventType: "TEST_EMAIL",
    category: EmailCategory.ADMIN_ALERTS,
    html,
    providerOverrideId: configId,
  });
}

export async function sendOrderExecutionNotification(data: {
  email: string;
  orderId: string;
  symbol: string;
  category?: string;
  type: string;
  amount: number;
  price: number;
  status: string;
}) {
  const isBuy = data.type.toUpperCase().includes("BUY") || data.type.toUpperCase().includes("CALL");
  const typeColor = isBuy ? "#10B981" : "#EF4444";

  const html = buildEmailTemplate({
    title: `Order Executed: ${data.symbol}`,
    preheader: `${data.type} ${data.amount} ${data.symbol} @ ${data.price} has been executed`,
    contentHtml: `
      <p>Your trading order has been successfully executed on ETHSLTD platform.</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${typeColor};">
        <p style="margin: 0 0 6px 0;"><strong>Symbol:</strong> ${data.symbol}</p>
        <p style="margin: 0 0 6px 0;"><strong>Type:</strong> <span style="color: ${typeColor}; font-weight: 700;">${data.type}</span> (${data.category || "Perpetual"})</p>
        <p style="margin: 0 0 6px 0;"><strong>Amount / Lot:</strong> ${data.amount}</p>
        <p style="margin: 0 0 6px 0;"><strong>Execution Price:</strong> $${data.price.toLocaleString()}</p>
        <p style="margin: 0 0 6px 0;"><strong>Order ID:</strong> #${data.orderId}</p>
        <p style="margin: 0;"><strong>Status:</strong> <span style="color: #10B981; font-weight: 700;">${data.status}</span></p>
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">You can monitor your open positions and trade history in real time on the trading terminal.</p>
    `,
    callToAction: {
      text: "View Positions & Trades",
      url: `${getAppUrlSync()}/trade`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `Order Executed: ${data.type} ${data.symbol} [ID: #${data.orderId}] - ETHSLTD`,
    eventType: "ORDER_EXECUTION",
    category: EmailCategory.ORDERS,
    html,
  });
}

export async function sendP2pOrderNotification(data: {
  email: string;
  role: "BUYER" | "SELLER";
  orderNumber: string;
  asset: string;
  cryptoAmount: number;
  fiatAmount: number;
  fiatCurrency: string;
  status: "CREATED" | "PAYMENT_MARKED" | "COMPLETED" | "CANCELLED" | "DISPUTED";
  counterpartyName?: string;
}) {
  let title = `P2P Order ${data.orderNumber} Update`;
  let preheader = `Status update on your P2P order`;
  let message = "";
  let statusColor = "#F59E0B";

  switch (data.status) {
    case "CREATED":
      statusColor = "#3B82F6";
      title = `P2P Order Created: ${data.orderNumber}`;
      preheader = `Escrow locked for ${data.cryptoAmount} ${data.asset}`;
      message = data.role === "BUYER"
        ? `You created a P2P order to buy ${data.cryptoAmount} ${data.asset} for ${data.fiatAmount} ${data.fiatCurrency}. Please complete the fiat payment to the seller before the time window expires.`
        : `A buyer initiated an order to purchase ${data.cryptoAmount} ${data.asset} for ${data.fiatAmount} ${data.fiatCurrency}. Your crypto is securely held in escrow until you confirm payment receipt.`;
      break;
    case "PAYMENT_MARKED":
      statusColor = "#F59E0B";
      title = `P2P Payment Marked: ${data.orderNumber}`;
      preheader = `Buyer marked payment as sent`;
      message = data.role === "SELLER"
        ? `The buyer has marked payment as completed for ${data.fiatAmount} ${data.fiatCurrency}. Please verify your bank/wallet receipt before releasing the escrowed crypto.`
        : `You marked payment as completed for order ${data.orderNumber}. The seller is verifying receipt.`;
      break;
    case "COMPLETED":
      statusColor = "#10B981";
      title = `P2P Order Completed: ${data.orderNumber}`;
      preheader = `Escrow released successfully`;
      message = data.role === "BUYER"
        ? `Congratulations! The seller has released ${data.cryptoAmount} ${data.asset} to your Currency Wallet balance.`
        : `Your P2P order has finished successfully. Escrow has been transferred to the buyer.`;
      break;
    case "CANCELLED":
      statusColor = "#EF4444";
      title = `P2P Order Cancelled: ${data.orderNumber}`;
      preheader = `Order ${data.orderNumber} was cancelled`;
      message = `The P2P order ${data.orderNumber} has been cancelled. Any escrowed assets have been returned to the seller.`;
      break;
    case "DISPUTED":
      statusColor = "#EF4444";
      title = `P2P Order Disputed: ${data.orderNumber}`;
      preheader = `A dispute has been raised for order ${data.orderNumber}`;
      message = `A dispute has been filed. An ETHSLTD dispute specialist is reviewing evidence from both parties.`;
      break;
  }

  const html = buildEmailTemplate({
    title,
    preheader,
    contentHtml: `
      <p>${message}</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${statusColor};">
        <p style="margin: 0 0 6px 0;"><strong>Order Number:</strong> ${data.orderNumber}</p>
        <p style="margin: 0 0 6px 0;"><strong>Crypto Amount:</strong> ${data.cryptoAmount} ${data.asset}</p>
        <p style="margin: 0 0 6px 0;"><strong>Fiat Amount:</strong> ${data.fiatAmount.toLocaleString()} ${data.fiatCurrency}</p>
        <p style="margin: 0 0 6px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 700;">${data.status}</span></p>
        <p style="margin: 0;"><strong>Your Role:</strong> ${data.role}</p>
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">Institutional Escrow Protection guarantees that trades remain secure until confirmed by both parties.</p>
    `,
    callToAction: {
      text: "View P2P Order Details",
      url: `${getAppUrlSync()}/p2p/orders`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `[P2P] ${title} - ETHSLTD`,
    eventType: "P2P_ORDER_STATUS",
    category: EmailCategory.P2P,
    html,
  });
}

// ==========================================
// Institutional Global Category Dispatchers
// ==========================================

export async function sendSupportNotification(data: {
  email: string;
  ticketId: string;
  subject: string;
  message: string;
}) {
  const html = buildEmailTemplate({
    title: `Support Ticket #${data.ticketId}`,
    preheader: `Update regarding your support inquiry`,
    contentHtml: `
      <p>An update has been posted to your support case <strong>#${data.ticketId}</strong>:</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #3B82F6;">
        <p style="margin: 0 0 6px 0;"><strong>Subject:</strong> ${data.subject}</p>
        <p style="margin: 0; color: #E5E7EB;">${data.message}</p>
      </div>
    `,
    callToAction: {
      text: "View Support Desk",
      url: `${getAppUrlSync()}/support`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `[Support #${data.ticketId}] ${data.subject} - ETHSLTD`,
    eventType: "SUPPORT_REPLY",
    category: EmailCategory.SUPPORT,
    html,
  });
}

export async function sendComplianceNotification(data: {
  email: string;
  title: string;
  message: string;
  actionRequired?: boolean;
}) {
  const html = buildEmailTemplate({
    title: data.title,
    preheader: `Important Compliance and Regulatory Notice`,
    contentHtml: `
      <p style="color: #F59E0B; font-weight: 700;">ETHSLTD Compliance Review Notification</p>
      <p>${data.message}</p>
    `,
    callToAction: {
      text: "Access Compliance Portal",
      url: `${getAppUrlSync()}/compliance`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `[Compliance] ${data.title} - ETHSLTD`,
    eventType: "COMPLIANCE_REQUEST",
    category: EmailCategory.COMPLIANCE,
    html,
  });
}

export async function sendMarketAlertNotification(data: {
  email: string;
  symbol: string;
  condition: string;
  price: number;
}) {
  const html = buildEmailTemplate({
    title: `Market Alert Triggered: ${data.symbol}`,
    preheader: `${data.symbol} has reached your target condition`,
    contentHtml: `
      <p>Your configured market alert for <strong>${data.symbol}</strong> has met trigger conditions:</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #10B981;">
        <p style="margin: 0 0 6px 0;"><strong>Asset:</strong> ${data.symbol}</p>
        <p style="margin: 0 0 6px 0;"><strong>Condition:</strong> ${data.condition}</p>
        <p style="margin: 0;"><strong>Current Trigger Price:</strong> $${data.price.toLocaleString()}</p>
      </div>
    `,
    callToAction: {
      text: "Open Trading Chart",
      url: `${getAppUrlSync()}/trade`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `[Market Alert] ${data.symbol} Alert Triggered - ETHSLTD`,
    eventType: "MARKET_ALERT",
    category: EmailCategory.MARKET_ALERTS,
    html,
  });
}

export async function sendAccountNotification(data: {
  email: string;
  title: string;
  message: string;
}) {
  const html = buildEmailTemplate({
    title: data.title,
    preheader: data.message,
    contentHtml: `<p>${data.message}</p>`,
    callToAction: {
      text: "Account Settings",
      url: `${getAppUrlSync()}/profile`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `${data.title} - ETHSLTD`,
    eventType: "ACCOUNT_UPDATE",
    category: EmailCategory.ACCOUNT,
    html,
  });
}

export async function sendUpdateNotification(data: {
  email: string;
  title: string;
  message: string;
}) {
  const html = buildEmailTemplate({
    title: data.title,
    preheader: data.message,
    contentHtml: `<p>${data.message}</p>`,
    callToAction: {
      text: "Platform Announcements",
      url: `${getAppUrlSync()}/announcements`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `[Announcement] ${data.title} - ETHSLTD`,
    eventType: "PLATFORM_ANNOUNCEMENT",
    category: EmailCategory.UPDATES,
    html,
  });
}

export async function sendRewardNotification(data: {
  email: string;
  rewardType: string;
  amount: number;
  asset: string;
}) {
  const html = buildEmailTemplate({
    title: `Reward Credited: ${data.rewardType}`,
    preheader: `You earned ${data.amount} ${data.asset}`,
    contentHtml: `
      <p>Congratulations! You have received a platform promotional reward:</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #10B981;">
        <p style="margin: 0 0 6px 0;"><strong>Program:</strong> ${data.rewardType}</p>
        <p style="margin: 0;"><strong>Reward Amount:</strong> ${data.amount} ${data.asset}</p>
      </div>
    `,
    callToAction: {
      text: "Check Rewards Balance",
      url: `${getAppUrlSync()}/assets`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `[Rewards] ${data.amount} ${data.asset} Credited - ETHSLTD`,
    eventType: "REWARD_EARNED",
    category: EmailCategory.REWARDS,
    html,
  });
}

export async function sendReportNotification(data: {
  email: string;
  period: string;
  reportUrl: string;
}) {
  const html = buildEmailTemplate({
    title: `Account Statement: ${data.period}`,
    preheader: `Your account statement for ${data.period} is ready`,
    contentHtml: `
      <p>Your periodic ETHSLTD trading statement and asset summary for <strong>${data.period}</strong> has been generated.</p>
    `,
    callToAction: {
      text: "Download Statement",
      url: data.reportUrl,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `[Report] Account Statement (${data.period}) - ETHSLTD`,
    eventType: "ACCOUNT_STATEMENT",
    category: EmailCategory.REPORTS,
    html,
  });
}

export async function sendApiSecurityNotification(data: {
  email: string;
  action: "CREATED" | "REVOKED" | "MODIFIED";
  keyName: string;
}) {
  const html = buildEmailTemplate({
    title: `API Key Security Event: ${data.action}`,
    preheader: `API key ${data.keyName} has been ${data.action.toLowerCase()}`,
    contentHtml: `
      <p>A security-sensitive API key operation occurred on your ETHSLTD account:</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #F59E0B;">
        <p style="margin: 0 0 6px 0;"><strong>API Key:</strong> ${data.keyName}</p>
        <p style="margin: 0;"><strong>Status:</strong> ${data.action}</p>
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">If you did not initiate this change, revoke your developer keys immediately and reset your credentials.</p>
    `,
    callToAction: {
      text: "Manage API Keys",
      url: `${getAppUrlSync()}/security/api-keys`,
    },
  });

  return sendEmail({
    to: data.email,
    subject: `Security Alert: API Key ${data.action} - ETHSLTD`,
    eventType: "API_KEY_SECURITY",
    category: EmailCategory.API_SECURITY,
    html,
  });
}

export async function sendAdminDisputeAlertNotification(data: {
  disputeId: string;
  disputeNumber: string;
  orderId: string;
  orderNumber: string;
  openerName: string;
  openerEmail: string;
  openerRole: "BUYER" | "SELLER";
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  cryptoAmount: number | string;
  asset: string;
  fiatAmount: number | string;
  fiatCurrency: string;
  reason: string;
  description?: string;
  createdAt?: Date | string;
}) {
  try {
    const config = await prisma.emailConfig.findFirst({
      where: { enabled: true },
      orderBy: { isDefault: "desc" },
    });

    const adminEmailsStr = (config?.adminEmails || process.env.ADMIN_EMAIL || "admin@ethsltd.com").trim();
    const recipientSet = new Set<string>();

    adminEmailsStr
      .split(",")
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.includes("@"))
      .forEach((e: string) => recipientSet.add(e));

    // Also include registered administrators from the database
    try {
      const dbAdmins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { email: true },
      });
      for (const a of dbAdmins) {
        if (a.email?.includes("@")) recipientSet.add(a.email.trim().toLowerCase());
      }
    } catch {}

    const recipients = Array.from(recipientSet);
    if (recipients.length === 0) return { success: false, error: "No valid admin email recipients" };

    const appUrl = getAppUrlSync();
    const disputeConsoleUrl = `${appUrl}/admin/p2p/disputes?id=${data.disputeId}`;

    const html = buildEmailTemplate({
      title: `[ADMIN ALERT] New P2P Dispute Raised: ${data.disputeNumber}`,
      preheader: `Dispute filed on Order ${data.orderNumber} for ${data.cryptoAmount} ${data.asset}`,
      contentHtml: `
        <div style="background-color: #7C2D12; border: 1px solid #EA580C; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
          <p style="color: #FED7AA; font-weight: 700; margin: 0; font-size: 14px;">Urgent: P2P Escrow Disputed</p>
          <p style="color: #FFEDD5; margin: 4px 0 0 0; font-size: 12px;">A counterparty has raised a dispute requiring administrative review and escrow disposition.</p>
        </div>

        <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #F59E0B;">
          <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Dispute Case:</strong> <span style="color: #F59E0B; font-weight: 700;">#${data.disputeNumber}</span></p>
          <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Associated Order:</strong> #${data.orderNumber}</p>
          <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Escrow Amount:</strong> <span style="color: #10B981; font-weight: 700;">${data.cryptoAmount} ${data.asset}</span> (${Number(data.fiatAmount).toLocaleString()} ${data.fiatCurrency})</p>
          <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Dispute Initiator:</strong> ${data.openerName} (${data.openerEmail}) [${data.openerRole}]</p>
          <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Buyer:</strong> ${data.buyerName} (${data.buyerEmail})</p>
          <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Seller:</strong> ${data.sellerName} (${data.sellerEmail})</p>
          <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Dispute Reason:</strong> <span style="color: #FCD34D;">${data.reason}</span></p>
          ${data.description ? `<p style="margin: 0; font-size: 12px; color: #9CA3AF; background-color: #1A1D27; padding: 10px; border-radius: 6px;"><em>"${data.description}"</em></p>` : ""}
        </div>

        <p style="font-size: 12px; color: #9CA3AF; line-height: 1.5;">
          The cryptocurrency escrow is automatically locked and cannot be released or cancelled by either trader until an authorized administrator adjudicates the case.
        </p>
      `,
      callToAction: {
        text: "Open Dispute Resolution Console",
        url: disputeConsoleUrl,
      },
    });

    const results = await Promise.all(
      recipients.map((to: string) =>
        sendEmail({
          to,
          subject: `[ADMIN ALERT] New P2P Dispute ${data.disputeNumber} (Order #${data.orderNumber}) - ETHSLTD`,
          eventType: "ADMIN_ALERT",
          category: EmailCategory.ADMIN_ALERTS,
          html,
        })
      )
    );

    return { success: results.some((r) => r.success) };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("sendAdminDisputeAlertNotification failed:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function sendDisputeStatusUpdateNotification(data: {
  email: string;
  name?: string;
  role: "BUYER" | "SELLER";
  disputeNumber: string;
  orderNumber: string;
  status: string;
  message: string;
  requiresAction?: boolean;
  actionUrl?: string;
}) {
  try {
    const appUrl = getAppUrlSync();
    const orderUrl = data.actionUrl || `${appUrl}/p2p/orders`;

    const html = buildEmailTemplate({
      title: `Dispute #${data.disputeNumber} Update`,
      preheader: data.message,
      contentHtml: `
        <p>Dear ${data.name || (data.role === "BUYER" ? "Buyer" : "Seller")},</p>
        <p>An update has been posted to your P2P trade dispute for <strong>Order #${data.orderNumber}</strong>:</p>

        <div style="background-color: #12141C; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #3B82F6;">
          <p style="margin: 0 0 6px 0;"><strong>Case ID:</strong> #${data.disputeNumber}</p>
          <p style="margin: 0 0 6px 0;"><strong>Current Status:</strong> <span style="color: #60A5FA; font-weight: 700;">${data.status.replace(/_/g, " ")}</span></p>
          <p style="margin: 0;"><strong>Message from Moderator:</strong> ${data.message}</p>
        </div>

        ${data.requiresAction ? `<p style="color: #F59E0B; font-weight: 600;">Action Required: Please click below to review moderator requests and submit supporting evidence.</p>` : ""}
      `,
      callToAction: {
        text: data.requiresAction ? "Submit Evidence / View Order" : "View Dispute Details",
        url: orderUrl,
      },
    });

    return await sendEmail({
      to: data.email,
      subject: `[P2P Dispute] #${data.disputeNumber} Update - ETHSLTD`,
      eventType: "P2P_ORDER_STATUS",
      category: EmailCategory.P2P,
      html,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("sendDisputeStatusUpdateNotification failed:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function sendDisputeResolvedNotification(data: {
  email: string;
  name?: string;
  role: "BUYER" | "SELLER";
  disputeNumber: string;
  orderNumber: string;
  decision: "BUYER_WINS" | "SELLER_WINS" | "DISMISSED";
  resolutionNotes?: string;
  cryptoAmount: number | string;
  asset: string;
  recipientOutcome: "ESCROW_RECEIVED" | "ESCROW_RETURNED" | "DISMISSED" | "ESCROW_LOST";
}) {
  try {
    const appUrl = getAppUrlSync();
    const orderUrl = `${appUrl}/p2p/orders`;

    const isWinner = data.recipientOutcome === "ESCROW_RECEIVED" || data.recipientOutcome === "ESCROW_RETURNED";
    const statusColor = isWinner ? "#10B981" : "#EF4444";

    let outcomeTitle = "Dispute Resolved";
    let outcomeDescription = "";

    if (data.recipientOutcome === "ESCROW_RECEIVED") {
      outcomeTitle = "Dispute Resolved in Your Favor - Escrow Released";
      outcomeDescription = `The moderator has resolved the dispute in your favor. Exactly ${data.cryptoAmount} ${data.asset} has been credited to your platform wallet balance.`;
    } else if (data.recipientOutcome === "ESCROW_RETURNED") {
      outcomeTitle = "Dispute Resolved in Your Favor - Escrow Returned";
      outcomeDescription = `The dispute has been resolved in your favor. The locked escrow of ${data.cryptoAmount} ${data.asset} has been safely returned to your wallet balance.`;
    } else if (data.recipientOutcome === "DISMISSED") {
      outcomeTitle = "Dispute Dismissed";
      outcomeDescription = `The dispute claim has been reviewed and dismissed by the administrator.`;
    } else {
      outcomeTitle = "Dispute Adjudicated";
      outcomeDescription = `The dispute for Order #${data.orderNumber} has been resolved by our moderation team.`;
    }

    const html = buildEmailTemplate({
      title: outcomeTitle,
      preheader: `Dispute #${data.disputeNumber} has reached a final resolution.`,
      contentHtml: `
        <p>Dear ${data.name || (data.role === "BUYER" ? "Buyer" : "Seller")},</p>
        <p>${outcomeDescription}</p>

        <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${statusColor};">
          <p style="margin: 0 0 6px 0;"><strong>Case ID:</strong> #${data.disputeNumber}</p>
          <p style="margin: 0 0 6px 0;"><strong>Order ID:</strong> #${data.orderNumber}</p>
          <p style="margin: 0 0 6px 0;"><strong>Official Ruling:</strong> <span style="color: ${statusColor}; font-weight: 700;">${data.decision.replace(/_/g, " ")}</span></p>
          <p style="margin: 0 0 6px 0;"><strong>Escrow Amount:</strong> ${data.cryptoAmount} ${data.asset}</p>
          ${data.resolutionNotes ? `<p style="margin: 0; font-size: 13px; color: #D1D5DB;"><strong>Moderator Rationale:</strong> <em>"${data.resolutionNotes}"</em></p>` : ""}
        </div>

        <p style="font-size: 12px; color: #9CA3AF;">This ruling was authorized by an ETHSLTD compliance administrator and is permanently recorded in the platform audit ledger.</p>
      `,
      callToAction: {
        text: "View Trade Order Details",
        url: orderUrl,
      },
    });

    return await sendEmail({
      to: data.email,
      subject: `[P2P Dispute Resolution] Ruling on #${data.disputeNumber} - ETHSLTD`,
      eventType: "P2P_ORDER_STATUS",
      category: EmailCategory.P2P,
      html,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("sendDisputeResolvedNotification failed:", errorMsg);
    return { success: false, error: errorMsg };
  }
}




