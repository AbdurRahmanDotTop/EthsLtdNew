"use server";

import prisma, { DBClient } from "@/lib/prisma";
import { hashPassword, verifyPassword, setAuthCookie, clearAuthCookie, getSession } from "@/lib/auth";
import crypto from "crypto";
import { headers } from "next/headers";
import { validateEmail } from "@/lib/email-validator";
import { checkRateLimit, resetRateLimit, getClientIp } from "@/lib/rate-limiter";
import { verifyTurnstileToken } from "@/lib/turnstile";
import {
  sendWelcomeNotification,
  sendAdminEventNotification,
  sendPasswordResetNotification,
  sendPinResetNotification,
  sendPasswordChangedNotification,
  sendPinChangedNotification,
  sendLoginAlertNotification,
  sendEmailVerificationOtpNotification,
} from "@/lib/email";

export async function loginUser(formData: { email: string; password: string }) {
  try {
    const { email, password } = formData;
    if (!email || !password) {
      return { success: false, error: "Please enter both email and password." };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, error: "Invalid email or password." };
    }

    if (user.status === "BANNED" || user.status === "FROZEN") {
      return { success: false, error: "Your account has been suspended or frozen. Please contact support." };
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Invalid email or password." };
    }

    // Transparently upgrade legacy Cloudflare SHA-256 hash to modern bcrypt
    if (user.passwordHash && user.passwordHash.length === 64) {
      try {
        const modernHash = await hashPassword(password);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: modernHash },
        });
      } catch (err) {
        console.error("Non-fatal: Failed to auto-upgrade password hash", err);
      }
    }

    // Set authenticated session cookie
    await setAuthCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
      uid: user.uid,
    });

    // Send login alert (non-blocking for login, protected with timeout cap)
    try {
      await Promise.race([
        sendLoginAlertNotification({
          email: user.email,
          time: new Date().toUTCString(),
        }).catch((e) => console.warn("Login alert failed:", e)),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
    } catch {}

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const isRM = user.role === "RM";
    return {
      success: true,
      role: user.role,
      redirectUrl: isAdmin ? "/admin" : isRM ? "/rm/dashboard" : "/assets",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to log in.";
    console.error("loginUser error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function registerUser(formData: {
  email: string;
  password: string;
  name?: string;
  transactionPin?: string;
  turnstileToken?: string;
  honeypot?: string;
  submissionTiming?: number;
}) {
  try {
    const { email, password, name, transactionPin, turnstileToken, honeypot, submissionTiming } = formData;

    // 1. Honeypot check (Bots fill invisible fields)
    if (honeypot && honeypot.trim() !== "") {
      console.warn("Bot registration attempt caught by honeypot:", honeypot);
      return { success: false, error: "Automated registration detected and blocked." };
    }

    // 2. Minimum form submission timing check (Humans take > 1 second)
    if (submissionTiming && Date.now() - submissionTiming < 800) {
      console.warn("Registration rejected due to abnormally fast submission:", Date.now() - submissionTiming);
      return { success: false, error: "Suspicious automated activity detected. Please try again." };
    }

    // 3. Client IP extraction
    let clientIp = "127.0.0.1";
    try {
      const headersList = await headers();
      clientIp = getClientIp(headersList);
    } catch {
      // In test runner or non-request environment, headers() is unavailable
    }

    // 4. IP-level Rate Limiting (Max 5 registration attempts per IP per 15 minutes, 100 in CLI_TEST_MODE)
    const rateCheck = checkRateLimit(`register_ip:${clientIp}`, {
      windowSeconds: 900,
      maxRequests: process.env.CLI_TEST_MODE === "true" ? 100 : 5,
    });
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: rateCheck.error || "Too many registration attempts from your IP address. Please wait before retrying.",
      };
    }

    // 5. Cloudflare Turnstile Verification (Server-Side)
    const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!turnstileResult.success) {
      return {
        success: false,
        error: turnstileResult.error || "Security check failed. Please complete the captcha verification.",
      };
    }

    // 6. Basic Input Validation
    if (!email || !password) {
      return { success: false, error: "Email and password are required." };
    }

    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters." };
    }

    // 7. Dynamic Email Validation & Anti-Spam Disposable Verification Engine
    const emailValidation = await validateEmail(email);
    if (!emailValidation.isValid) {
      // Record blocked attempt in AuditLog
      try {
        const adminUser = await prisma.user.findFirst({
          where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
          select: { id: true, email: true },
        });

        if (adminUser) {
          await prisma.auditLog.create({
            data: {
              adminId: adminUser.id,
              adminEmail: adminUser.email,
              action: emailValidation.isDisposable ? "REGISTRATION_BLOCKED_DISPOSABLE_EMAIL" : "REGISTRATION_BLOCKED_INVALID_EMAIL",
              targetType: "USER",
              targetId: emailValidation.normalizedEmail || email,
              details: `Blocked registration attempt for email: ${email} (Domain: @${emailValidation.domain || "invalid"}, Error: ${emailValidation.error}, IP: ${clientIp})`,
            },
          });
        }
      } catch (logErr) {
        console.warn("Could not log blocked registration:", logErr);
      }

      return {
        success: false,
        error: emailValidation.error || "Disposable and temporary email addresses are not allowed.",
      };
    }

    const normalizedEmail = emailValidation.normalizedEmail;

    // 8. Prevent duplicate email registrations
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return { success: false, error: "An account with this email already exists." };
    }

    // 9. Generate unique 6-digit UID
    let uid = Math.floor(100000 + Math.random() * 900000);
    while (await prisma.user.findUnique({ where: { uid } })) {
      uid = Math.floor(100000 + Math.random() * 900000);
    }

    const passwordHash = await hashPassword(password);

    // 10. Atomic User and Wallet Creation (Marked as PENDING_VERIFICATION)
    const newUser = await prisma.$transaction(async (tx: DBClient) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name?.trim() || normalizedEmail.split("@")[0],
          uid,
          transactionPin: transactionPin || "123456",
          role: "USER",
          status: "PENDING_VERIFICATION",
          isKycVerified: false,
          isEmailVerified: false,
        },
      });

      // Create initial wallet accounts with strictly 0.0 balance
      await tx.wallet.createMany({
        data: [
          { userId: user.id, asset: "USDT", balance: 0.0, type: "Currency" },
          { userId: user.id, asset: "BTC", balance: 0.0, type: "Currency" },
          { userId: user.id, asset: "ETH", balance: 0.0, type: "Currency" },
          { userId: user.id, asset: "USDC", balance: 0.0, type: "Currency" },
          { userId: user.id, asset: "USDT", balance: 0.0, type: "Contract" },
          { userId: user.id, asset: "USDT", balance: 0.0, type: "Options" },
        ],
      });

      // Audit Log for Auditability
      await tx.auditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email,
          action: "USER_REGISTERED_PENDING_VERIFICATION",
          targetType: "USER",
          targetId: user.id,
          details: `User UID #${user.uid} registered from IP ${clientIp}. Status: PENDING_VERIFICATION.`,
        },
      });

      return user;
    });

    // 11. Generate 6-Digit Email Verification Code & Token
    const rawToken = crypto.randomBytes(24).toString("hex");
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: rawToken,
        code: otpCode,
        type: "EMAIL_VERIFICATION",
        expiresAt,
        used: false,
        attempts: 0,
      },
    });

    // 12. Send Email Verification OTP (No marketing welcome email until verified)
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${origin}/verify-email?email=${encodeURIComponent(normalizedEmail)}`;

    try {
      await Promise.race([
        sendEmailVerificationOtpNotification({
          email: normalizedEmail,
          otpCode,
          verifyUrl,
        }),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch (e) {
      console.warn("Failed to dispatch verification email:", e);
    }

    // 13. Set authenticated session cookie so user can immediately verify
    await setAuthCookie({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      uid: newUser.uid,
    });

    return {
      success: true,
      role: newUser.role,
      requiresVerification: true,
      email: normalizedEmail,
      redirectUrl: `/verify-email?email=${encodeURIComponent(normalizedEmail)}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create account.";
    console.error("registerUser error:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Resend Email Verification OTP with strict 60-second cooldown and rate limiting
 */
export async function requestEmailVerificationOtp(customEmail?: string) {
  try {
    const session = await getSession();
    let emailToVerify: string | null = null;

    if (session?.userId) {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (user) {
        if (user.isEmailVerified && user.status === "ACTIVE") {
          return { success: false, error: "Your email address is already verified." };
        }
        emailToVerify = user.email;
      }
    }

    if (!emailToVerify && customEmail) {
      emailToVerify = customEmail.toLowerCase().trim();
    }

    if (!emailToVerify) {
      return { success: false, error: "Please log in or provide your registered email address." };
    }

    // Extract IP and rate limit
    let clientIp = "127.0.0.1";
    try {
      const headersList = await headers();
      clientIp = getClientIp(headersList);
    } catch {
      // Outside active Next.js request context
    }

    // IP-level rate limit: Max 10 OTP dispatches per IP per 15 minutes
    const ipRateCheck = checkRateLimit(`otp_ip:${clientIp}`, {
      windowSeconds: 900,
      maxRequests: 10,
    });
    if (!ipRateCheck.allowed) {
      return { success: false, error: "Too many verification requests from your network. Please wait before retrying." };
    }

    // Email-level Rate Limiting: Max 4 requests per 15 minutes with 60-second cooldown
    const rateCheck = checkRateLimit(`otp_email:${emailToVerify}`, {
      windowSeconds: 900,
      maxRequests: 4,
      minCooldownSeconds: 60,
    });

    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.error || "Please wait 60 seconds before requesting a new code." };
    }

    // Invalidate old active verification tokens for this email
    await prisma.verificationToken.updateMany({
      where: {
        identifier: emailToVerify,
        type: "EMAIL_VERIFICATION",
        used: false,
      },
      data: { used: true },
    });

    // Generate new secure 6-digit OTP
    const rawToken = crypto.randomBytes(24).toString("hex");
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.verificationToken.create({
      data: {
        identifier: emailToVerify,
        token: rawToken,
        code: otpCode,
        type: "EMAIL_VERIFICATION",
        expiresAt,
        used: false,
        attempts: 0,
      },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${origin}/verify-email?email=${encodeURIComponent(emailToVerify)}`;

    try {
      await sendEmailVerificationOtpNotification({
        email: emailToVerify,
        otpCode,
        verifyUrl,
      });
    } catch (e) {
      console.warn("Failed to dispatch verification OTP email:", e);
    }

    return {
      success: true,
      message: "A new 6-digit verification code has been dispatched to your email.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to send verification code.";
    console.error("requestEmailVerificationOtp error:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Verify Email with 6-digit OTP code
 */
export async function verifyEmailOtp(formData: { code: string; email?: string }) {
  try {
    const { code, email: paramEmail } = formData;
    if (!code || code.trim().length !== 6) {
      return { success: false, error: "Please enter the complete 6-digit verification code." };
    }

    const cleanCode = code.trim();
    const session = await getSession();

    let targetEmail: string | null = null;
    let userId: string | null = null;

    if (session?.userId) {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (user) {
        targetEmail = user.email;
        userId = user.id;
      }
    }

    if (!targetEmail && paramEmail) {
      const user = await prisma.user.findUnique({ where: { email: paramEmail.toLowerCase().trim() } });
      if (user) {
        targetEmail = user.email;
        userId = user.id;
      }
    }

    if (!targetEmail || !userId) {
      return { success: false, error: "Account could not be identified. Please log in first." };
    }

    // Find active token record
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: targetEmail,
        type: "EMAIL_VERIFICATION",
        used: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!tokenRecord) {
      return { success: false, error: "No pending verification code found. Please request a new one." };
    }

    if (new Date() > tokenRecord.expiresAt) {
      await prisma.verificationToken.update({ where: { id: tokenRecord.id }, data: { used: true } });
      return { success: false, error: "Verification code has expired. Please request a new code." };
    }

    if (tokenRecord.attempts >= 5) {
      await prisma.verificationToken.update({ where: { id: tokenRecord.id }, data: { used: true } });
      return { success: false, error: "Too many incorrect attempts. Please request a new code." };
    }

    if (tokenRecord.code !== cleanCode) {
      await prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });
      return { success: false, error: "Invalid verification code. Please check your email and try again." };
    }

    // Atomically activate account and mark verified
    const updatedUser = await prisma.$transaction(async (tx: DBClient) => {
      await tx.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      });

      const user = await tx.user.update({
        where: { id: userId! },
        data: {
          isEmailVerified: true,
          status: "ACTIVE",
        },
      });

      await tx.auditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email,
          action: "EMAIL_VERIFICATION_SUCCESS",
          targetType: "USER",
          targetId: user.id,
          details: `User UID #${user.uid} verified their email address successfully. Status set to ACTIVE.`,
        },
      });

      return user;
    });

    // Reset rate limiter on successful verification
    resetRateLimit(`otp_email:${targetEmail}`);

    // Send Welcome Notification & Admin Alert now that user is verified!
    try {
      await Promise.allSettled([
        sendWelcomeNotification({
          email: updatedUser.email,
          name: updatedUser.name,
          uid: updatedUser.uid,
        }),
        sendAdminEventNotification({
          eventType: "REGISTRATION_VERIFIED",
          title: `User Verified: #${updatedUser.uid}`,
          message: `User ${updatedUser.email} (UID: #${updatedUser.uid}) has verified their email and activated their account.`,
          details: { Email: updatedUser.email, UID: updatedUser.uid, Time: new Date().toISOString() },
        }),
      ]);
    } catch (e) {
      console.warn("Welcome email notification dispatch exception:", e);
    }

    // Ensure active authenticated session cookie is established for the verified user
    await setAuthCookie({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      uid: updatedUser.uid,
    });

    return {
      success: true,
      message: "Email successfully verified! Your account is now active.",
      redirectUrl: "/assets",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to verify email.";
    console.error("verifyEmailOtp error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function logoutUser() {
  await clearAuthCookie();
  return { success: true, redirectUrl: "/login" };
}

export async function getAuthSession() {
  const session = await getSession();
  if (!session) return null;

  try {
    let db: any = null;
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const cf = getCloudflareContext({ async: false });
      db = (cf as any)?.env?.DB;
    } catch {}
    if (!db) {
      const cfGlobal = (globalThis as any)[Symbol.for("__cloudflare-context__")];
      db = cfGlobal?.env?.DB || (globalThis as any).DB;
    }

    if (db && typeof db.prepare === "function") {
      const row = await db.prepare(
        "SELECT id, email, name, avatarUrl, phone, uid, role, status, isKycVerified, isEmailVerified FROM User WHERE id = ?"
      ).bind(session.userId).first();

      if (row) {
        return {
          id: row.id,
          email: row.email,
          name: row.name,
          avatarUrl: row.avatarUrl,
          phone: row.phone,
          uid: row.uid,
          role: row.role,
          status: row.status,
          isKycVerified: Boolean(row.isKycVerified),
          isEmailVerified: Boolean(row.isEmailVerified),
        };
      }
      return null;
    }
  } catch {}

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      phone: true,
      uid: true,
      role: true,
      status: true,
      isKycVerified: true,
      isEmailVerified: true,
    },
  });

  return user;
}

export async function changeUserPassword(formData: {
  currentPassword: string;
  newPassword: string;
}) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Please log in first." };
    }

    const { currentPassword, newPassword } = formData;
    if (!currentPassword || !newPassword) {
      return { success: false, error: "Both current and new password are required." };
    }
    if (newPassword.length < 6) {
      return { success: false, error: "New password must be at least 6 characters." };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user) {
      return { success: false, error: "User not found." };
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Current password is incorrect." };
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    try {
      await sendPasswordChangedNotification({ email: user.email });
    } catch (e) {
      console.warn("Password changed alert dispatch failed:", e);
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update password.";
    return { success: false, error: errorMsg };
  }
}

// -------------------------------------------------------------
// Forgot Password & Token-Based Reset
// -------------------------------------------------------------

export async function requestPasswordReset(formData: { email: string; appOrigin?: string }) {
  try {
    const { email, appOrigin } = formData;
    if (!email || !email.includes("@")) {
      return { success: false, error: "Please enter a valid email address." };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Anti-enumeration: Return safe identical message if user is not found
    if (!user) {
      return {
        success: true,
        message: "If an account is associated with this email, recovery instructions and a 6-digit verification code have been dispatched.",
      };
    }

    // Cooldown check (60 seconds)
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        type: "PASSWORD_RESET",
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentToken) {
      return {
        success: false,
        error: "A reset code was already sent recently. Please wait 60 seconds before requesting a new one.",
      };
    }

    // Invalidate old unused tokens for this email & type
    await prisma.verificationToken.updateMany({
      where: { identifier: normalizedEmail, type: "PASSWORD_RESET", used: false },
      data: { used: true },
    });

    // Generate secure token and 6-digit OTP code
    const rawToken = crypto.randomBytes(24).toString("hex");
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: rawToken,
        code: otpCode,
        type: "PASSWORD_RESET",
        expiresAt,
        used: false,
        attempts: 0,
      },
    });

    const origin = appOrigin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${origin}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Dispatch email
    await sendPasswordResetNotification({
      email: normalizedEmail,
      otpCode,
      resetUrl,
    });

    return {
      success: true,
      message: "If an account is associated with this email, recovery instructions and a 6-digit verification code have been dispatched.",
    };
  } catch (err: unknown) {
    console.error("requestPasswordReset error:", err);
    return { success: false, error: "Failed to process password recovery request. Please try again." };
  }
}

export async function resetPasswordWithToken(formData: {
  email: string;
  tokenOrCode: string;
  newPassword: string;
  confirmPassword: string;
}) {
  try {
    const { email, tokenOrCode, newPassword, confirmPassword } = formData;
    if (!email || !tokenOrCode || !newPassword) {
      return { success: false, error: "All fields are required." };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "Passwords do not match." };
    }

    if (newPassword.length < 6) {
      return { success: false, error: "New password must be at least 6 characters." };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanTokenOrCode = tokenOrCode.trim();

    // Find active token record
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        type: "PASSWORD_RESET",
        used: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!tokenRecord) {
      return { success: false, error: "No active password reset request found. Please request a new code." };
    }

    if (new Date() > tokenRecord.expiresAt) {
      await prisma.verificationToken.update({ where: { id: tokenRecord.id }, data: { used: true } });
      return { success: false, error: "The verification code has expired. Please request a new one." };
    }

    if (tokenRecord.attempts >= 5) {
      await prisma.verificationToken.update({ where: { id: tokenRecord.id }, data: { used: true } });
      return { success: false, error: "Too many failed attempts. For your security, this request has been cancelled." };
    }

    const isMatch = tokenRecord.token === cleanTokenOrCode || tokenRecord.code === cleanTokenOrCode;
    if (!isMatch) {
      await prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });
      return { success: false, error: "Invalid verification code or token." };
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, error: "Account could not be found." };
    }

    const newHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx: DBClient) => {
      // Mark token used
      await tx.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      });

      // Update password
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      // Add audit log
      await tx.auditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email,
          action: "PASSWORD_RECOVERY_SUCCESS",
          targetType: "USER",
          targetId: user.id,
          details: `Password recovered via verified email OTP/token for ${user.email}`,
        },
      });
    });

    // Send confirmation security alert
    try {
      await sendPasswordChangedNotification({ email: normalizedEmail });
    } catch (e) {
      console.warn("Security alert send failed:", e);
    }

    return {
      success: true,
      message: "Your password has been reset successfully. You can now log in.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reset password.";
    console.error("resetPasswordWithToken error:", err);
    return { success: false, error: errorMsg };
  }
}

// -------------------------------------------------------------
// Forgot PIN & Token-Based Reset
// -------------------------------------------------------------

export async function requestPinReset(formData: { email: string; appOrigin?: string }) {
  try {
    const { email, appOrigin } = formData;
    if (!email || !email.includes("@")) {
      return { success: false, error: "Please enter a valid email address." };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Anti-enumeration: Safe identical message
    if (!user) {
      return {
        success: true,
        message: "If an account is associated with this email, PIN recovery instructions and a verification code have been dispatched.",
      };
    }

    // Cooldown check (60 seconds)
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        type: "PIN_RESET",
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentToken) {
      return {
        success: false,
        error: "A recovery code was already sent recently. Please wait 60 seconds before requesting a new one.",
      };
    }

    // Invalidate old unused PIN tokens
    await prisma.verificationToken.updateMany({
      where: { identifier: normalizedEmail, type: "PIN_RESET", used: false },
      data: { used: true },
    });

    const rawToken = crypto.randomBytes(24).toString("hex");
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: rawToken,
        code: otpCode,
        type: "PIN_RESET",
        expiresAt,
        used: false,
        attempts: 0,
      },
    });

    const origin = appOrigin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${origin}/reset-pin?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Dispatch email
    await sendPinResetNotification({
      email: normalizedEmail,
      otpCode,
      resetUrl,
    });

    return {
      success: true,
      message: "If an account is associated with this email, PIN recovery instructions and a verification code have been dispatched.",
    };
  } catch (err: unknown) {
    console.error("requestPinReset error:", err);
    return { success: false, error: "Failed to process PIN recovery request. Please try again." };
  }
}

export async function resetPinWithToken(formData: {
  email: string;
  tokenOrCode: string;
  newPin: string;
  confirmPin: string;
}) {
  try {
    const { email, tokenOrCode, newPin, confirmPin } = formData;
    if (!email || !tokenOrCode || !newPin) {
      return { success: false, error: "All fields are required." };
    }

    if (newPin !== confirmPin) {
      return { success: false, error: "PIN entries do not match." };
    }

    const cleanPin = newPin.replace(/\D/g, "");
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      return { success: false, error: "Security Transaction PIN must be between 4 and 6 digits." };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanTokenOrCode = tokenOrCode.trim();

    // Find active token record
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        type: "PIN_RESET",
        used: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!tokenRecord) {
      return { success: false, error: "No active PIN recovery request found. Please request a new code." };
    }

    if (new Date() > tokenRecord.expiresAt) {
      await prisma.verificationToken.update({ where: { id: tokenRecord.id }, data: { used: true } });
      return { success: false, error: "The recovery code has expired. Please request a new one." };
    }

    if (tokenRecord.attempts >= 5) {
      await prisma.verificationToken.update({ where: { id: tokenRecord.id }, data: { used: true } });
      return { success: false, error: "Too many failed attempts. For your security, this request has been cancelled." };
    }

    const isMatch = tokenRecord.token === cleanTokenOrCode || tokenRecord.code === cleanTokenOrCode;
    if (!isMatch) {
      await prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });
      return { success: false, error: "Invalid verification code or token." };
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, error: "Account could not be found." };
    }

    await prisma.$transaction(async (tx: DBClient) => {
      // Mark token used
      await tx.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      });

      // Update PIN
      await tx.user.update({
        where: { id: user.id },
        data: { transactionPin: cleanPin },
      });

      // Add audit log
      await tx.auditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email,
          action: "PIN_RECOVERY_SUCCESS",
          targetType: "USER",
          targetId: user.id,
          details: `Transaction PIN recovered via verified email OTP/token for ${user.email}`,
        },
      });
    });

    // Send confirmation security alert
    try {
      await sendPinChangedNotification({ email: normalizedEmail });
    } catch (e) {
      console.warn("Security alert send failed:", e);
    }

    return {
      success: true,
      message: "Your Security Transaction PIN has been updated successfully.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reset Transaction PIN.";
    console.error("resetPinWithToken error:", err);
    return { success: false, error: errorMsg };
  }
}
