"use server";

import prisma, { DBClient } from "@/lib/prisma";
import { hashPassword, verifyPassword, setAuthCookie, clearAuthCookie, getSession } from "@/lib/auth";
import crypto from "crypto";
import {
  sendWelcomeNotification,
  sendAdminEventNotification,
  sendPasswordResetNotification,
  sendPinResetNotification,
  sendPasswordChangedNotification,
  sendPinChangedNotification,
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

    // Set authenticated session cookie
    await setAuthCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
      uid: user.uid,
    });

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
}) {
  try {
    const { email, password, name, transactionPin } = formData;
    if (!email || !password) {
      return { success: false, error: "Email and password are required." };
    }

    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters." };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return { success: false, error: "An account with this email already exists." };
    }

    // Generate unique 6-digit UID
    let uid = Math.floor(100000 + Math.random() * 900000);
    while (await prisma.user.findUnique({ where: { uid } })) {
      uid = Math.floor(100000 + Math.random() * 900000);
    }

    const passwordHash = await hashPassword(password);

    // Create user and initialize wallets atomically
    const newUser = await prisma.$transaction(async (tx: DBClient) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name?.trim() || normalizedEmail.split("@")[0],
          uid,
          transactionPin: transactionPin || "123456",
          role: "USER",
          status: "ACTIVE",
          isKycVerified: false,
        },
      });

      // Create initial wallet accounts with strictly 0.0 balance (No automatic bonus)
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

      return user;
    });

    // Set authenticated session cookie
    await setAuthCookie({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      uid: newUser.uid,
    });

    // Send Welcome Email and Admin Notification (non-blocking)
    try {
      sendWelcomeNotification({
        email: newUser.email,
        name: newUser.name,
        uid: newUser.uid,
      }).catch((e) => console.warn("Welcome email async failed:", e));

      sendAdminEventNotification({
        eventType: "REGISTRATION",
        title: `New User Registered: #${newUser.uid}`,
        message: `User ${newUser.email} (UID: #${newUser.uid}) has completed registration.`,
        details: { Email: newUser.email, UID: newUser.uid, Time: new Date().toISOString() },
      }).catch((e) => console.warn("Admin alert async failed:", e));
    } catch (e) {
      console.warn("Notification dispatch exception:", e);
    }

    return {
      success: true,
      role: newUser.role,
      redirectUrl: "/assets",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create account.";
    console.error("registerUser error:", err);
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
    sendPasswordChangedNotification({ email: normalizedEmail }).catch((e) =>
      console.warn("Security alert send failed:", e)
    );

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
    sendPinChangedNotification({ email: normalizedEmail }).catch((e) =>
      console.warn("Security alert send failed:", e)
    );

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
