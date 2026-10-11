import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

export interface SendEmailOptions {
  to: string;
  subject: string;
  eventType:
    | "WELCOME"
    | "RESET_PASSWORD"
    | "RESET_PIN"
    | "PASSWORD_CHANGED"
    | "PIN_CHANGED"
    | "DEPOSIT_STATUS"
    | "WITHDRAWAL_STATUS"
    | "KYC_STATUS"
    | "ADMIN_ALERT"
    | "TEST_EMAIL";
  html: string;
  text?: string;
  providerOverrideId?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerUsed?: string;
}

/**
 * Fetch the active EmailConfig (DB priority, followed by ENV variables)
 */
export async function getActiveEmailConfig(configId?: string) {
  try {
    if (configId) {
      const explicit = await prisma.emailConfig.findUnique({ where: { id: configId } });
      if (explicit) return explicit;
    }

    // Default enabled provider from DB
    const dbDefault = await prisma.emailConfig.findFirst({
      where: { isDefault: true, enabled: true },
    });
    if (dbDefault) return dbDefault;

    // Any enabled provider from DB
    const anyEnabled = await prisma.emailConfig.findFirst({
      where: { enabled: true },
      orderBy: { updatedAt: "desc" },
    });
    if (anyEnabled) return anyEnabled;

    // Check environment variables as fallback
    if (process.env.BREVO_API_KEY) {
      return {
        id: "env-brevo",
        provider: "BREVO",
        name: "Brevo API (Environment)",
        apiKey: process.env.BREVO_API_KEY,
        fromEmail: process.env.EMAIL_FROM || "support@ethsltd.com",
        fromName: process.env.EMAIL_FROM_NAME || "ETHSLTD Security",
        replyTo: process.env.EMAIL_REPLY_TO || null,
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
        fromEmail: process.env.EMAIL_FROM || "support@ethsltd.com",
        fromName: process.env.EMAIL_FROM_NAME || "ETHSLTD Security",
        replyTo: process.env.EMAIL_REPLY_TO || null,
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
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const errMsg = String(data.message || `Brevo API error ${res.status}: ${res.statusText}`);
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      messageId: String(data.messageId || `brevo-${Date.now()}`),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
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
  const { to, subject, eventType, html, text, providerOverrideId } = options;

  let config: Awaited<ReturnType<typeof getActiveEmailConfig>> = null;
  try {
    config = await getActiveEmailConfig(providerOverrideId);
  } catch (err) {
    console.error("Failed to read email config:", err);
  }

  if (!config) {
    const errorMsg = "No active email provider configured in Admin Email Settings or ENV.";
    console.warn(`[ETHSLTD Email] Skipped '${eventType}' to ${to}: ${errorMsg}`);
    
    // Log failure
    try {
      await prisma.emailLog.create({
        data: {
          recipient: to,
          subject,
          eventType,
          provider: "NONE",
          status: "FAILED",
          errorMessage: errorMsg,
        },
      });
    } catch {}

    return { success: false, error: errorMsg, providerUsed: "NONE" };
  }

  let result: { success: boolean; messageId?: string; error?: string } = {
    success: false,
    error: "Provider unknown",
  };

  const providerType = config.provider || "SMTP";

  try {
    if (providerType === "BREVO" && config.apiKey) {
      result = await sendViaBrevoApi(
        config.apiKey,
        config.fromEmail || "support@ethsltd.com",
        config.fromName || "ETHSLTD Security",
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
        config.fromEmail || "support@ethsltd.com",
        config.fromName || "ETHSLTD Security",
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
        provider: `${providerType} (${config.name || "Default"})`,
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
    providerUsed: `${providerType} - ${config.name || "Default"}`,
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
  const ctaBlock = callToAction
    ? `
      <div style="margin: 28px 0; text-align: center;">
        <a href="${callToAction.url}" style="background: linear-gradient(135deg, #00A070 0%, #10B981 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(0, 160, 112, 0.35);">
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
      url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/assets` : "http://localhost:3000/assets",
    },
    noteText: "Security Reminder: ETHSLTD staff will never ask for your password, PIN, or private keys.",
  });

  return sendEmail({
    to: user.email,
    subject: `Welcome to ETHSLTD [UID: #${user.uid}]`,
    eventType: "WELCOME",
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
      url: data.resetUrl,
    },
    noteText: "Do not forward or share this code with anyone. ETHSLTD will never call or message asking for your code.",
  });

  return sendEmail({
    to: data.email,
    subject: `Password Reset Code: ${data.otpCode} - ETHSLTD Security`,
    eventType: "RESET_PASSWORD",
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
      url: data.resetUrl,
    },
    noteText: "Your Transaction PIN protects all withdrawals and asset transfers.",
  });

  return sendEmail({
    to: data.email,
    subject: `Transaction PIN Recovery Code: ${data.otpCode} - ETHSLTD`,
    eventType: "RESET_PIN",
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
      url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/security/password` : "http://localhost:3000/assets",
    },
    noteText: "CRITICAL: If you did not make this change, please contact our emergency security desk immediately.",
  });

  return sendEmail({
    to: data.email,
    subject: `Security Alert: Login Password Changed - ETHSLTD`,
    eventType: "PASSWORD_CHANGED",
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
      url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/assets` : "http://localhost:3000/assets",
    },
    noteText: "If you did not authorize this change, please report it to support immediately.",
  });

  return sendEmail({
    to: data.email,
    subject: `Security Alert: Transaction PIN Changed - ETHSLTD`,
    eventType: "PIN_CHANGED",
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
}) {
  const isApproved = data.status === "APPROVED";
  const isRejected = data.status === "REJECTED";
  const statusColor = isApproved ? "#10B981" : isRejected ? "#EF4444" : "#F59E0B";

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
      url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/assets/records` : "http://localhost:3000/assets/records",
    },
  });

  return sendEmail({
    to: data.email,
    subject: `Deposit ${data.status}: ${data.amount} ${data.asset} - ETHSLTD`,
    eventType: "DEPOSIT_STATUS",
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
}) {
  const isApproved = data.status === "APPROVED";
  const isRejected = data.status === "REJECTED";
  const statusColor = isApproved ? "#10B981" : isRejected ? "#EF4444" : "#F59E0B";

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
      <p style="font-size: 13px; color: #9CA3AF;">${isApproved ? "Funds have been dispatched to your bank card/destination." : isRejected ? "The withdrawal request was rejected and funds have been released back to your available balance." : "Your request is currently awaiting admin authorization."}</p>
    `,
    callToAction: {
      text: "View Transaction History",
      url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/assets/records` : "http://localhost:3000/assets/records",
    },
  });

  return sendEmail({
    to: data.email,
    subject: `Withdrawal ${data.status}: ${data.amount} ${data.asset} - ETHSLTD`,
    eventType: "WITHDRAWAL_STATUS",
    html,
  });
}

export async function sendKycNotification(data: {
  email: string;
  status: "APPROVED" | "REJECTED";
  reason?: string;
}) {
  const isApproved = data.status === "APPROVED";
  const statusColor = isApproved ? "#10B981" : "#EF4444";

  const html = buildEmailTemplate({
    title: `KYC Verification: ${data.status}`,
    preheader: `Your Identity Verification is ${data.status.toLowerCase()}`,
    contentHtml: `
      <p>Your KYC (Know Your Customer) verification application has been reviewed by compliance.</p>
      <div style="background-color: #12141C; padding: 18px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${statusColor};">
        <p style="margin: 0 0 6px 0;"><strong>Result:</strong> <span style="color: ${statusColor}; font-weight: 700;">${data.status}</span></p>
        ${data.reason ? `<p style="margin: 0; font-size: 13px; color: #EF4444;"><strong>Reason:</strong> ${data.reason}</p>` : ""}
      </div>
      <p style="font-size: 13px; color: #9CA3AF;">${isApproved ? "Your account now has verified trader status with unlocked trading and withdrawal limits." : "You may resubmit your identity documents with clearer photos and matching information."}</p>
    `,
    callToAction: {
      text: isApproved ? "Start Trading" : "Resubmit KYC",
      url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/profile/kyc` : "http://localhost:3000/profile/kyc",
    },
  });

  return sendEmail({
    to: data.email,
    subject: `KYC Identity Verification ${data.status} - ETHSLTD`,
    eventType: "KYC_STATUS",
    html,
  });
}

export async function sendAdminEventNotification(data: {
  eventType: "REGISTRATION" | "DEPOSIT" | "WITHDRAWAL" | "KYC";
  title: string;
  message: string;
  details?: Record<string, string | number | boolean>;
}) {
  try {
    const config = await prisma.emailConfig.findFirst({
      where: { enabled: true },
      orderBy: { isDefault: "desc" },
    });

    if (!config || !config.adminEmails) {
      return { success: false, error: "No admin notification emails configured" };
    }

    // Check preference flags
    if (data.eventType === "REGISTRATION" && !config.notifyOnRegistration) return { success: true };
    if (data.eventType === "DEPOSIT" && !config.notifyOnDeposit) return { success: true };
    if (data.eventType === "WITHDRAWAL" && !config.notifyOnWithdrawal) return { success: true };
    if (data.eventType === "KYC" && !config.notifyOnKyc) return { success: true };

    const recipients: string[] = config.adminEmails
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
        url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/admin` : "http://localhost:3000/admin",
      },
    });

    const results = await Promise.all(
      recipients.map((to: string) =>
        sendEmail({
          to,
          subject: `[ADMIN] ${data.title} - ETHSLTD`,
          eventType: "ADMIN_ALERT",
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
      url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/email-settings` : "http://localhost:3000/admin/email-settings",
    },
  });

  return sendEmail({
    to: toEmail,
    subject: `[TEST EMAIL] Outbound Delivery Verification - ETHSLTD`,
    eventType: "TEST_EMAIL",
    html,
    providerOverrideId: configId,
  });
}

