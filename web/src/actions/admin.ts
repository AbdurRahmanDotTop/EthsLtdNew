"use server";

// Admin Server Actions
import prisma, { DBClient, DBWallet, DBEmailConfig } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  sendDepositNotification,
  sendWithdrawalNotification,
  sendKycNotification,
  sendTestEmail,
  sendEmail,
  EmailSendResult,
  SendEmailOptions,
} from "@/lib/email";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Outside Next.js context
  }
}

async function verifyAdmin(): Promise<{ id: string; email: string; role: string }> {
  const session = await getSession();
  if (session && (session.role === "ADMIN" || session.role === "SUPER_ADMIN")) {
    return { id: session.userId, email: session.email, role: session.role };
  }
  if (process.env.CLI_TEST_MODE === "true") {
    const testAdmin = await prisma.user.findFirst({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }
    });
    if (testAdmin) {
      return { id: testAdmin.id, email: testAdmin.email, role: testAdmin.role };
    }
  }
  throw new Error("Unauthorized: Admin privileges required.");
}

// 1. Dashboard Overview Stats
export async function getAdminStats() {
  await verifyAdmin();

  const [totalUsers, totalDeposits, totalWithdrawals, activeOrders, closedOrders] = await Promise.all([
    prisma.user.count(),
    prisma.depositRequest.aggregate({
      _sum: { amount: true },
      where: { status: "APPROVED" },
    }),
    prisma.withdrawalRequest.aggregate({
      _sum: { amount: true },
      where: { status: "APPROVED" },
    }),
    prisma.order.count({ where: { status: { in: ["Executed", "Awaiting"] } } }),
    prisma.order.aggregate({
      _sum: { amount: true },
      where: { status: { in: ["Closed", "Win", "Loss"] } },
    }),
  ]);

  const pendingKycCount = await prisma.kycApplication.count({ where: { status: "PENDING" } });
  const pendingDepositsCount = await prisma.depositRequest.count({ where: { status: "PENDING" } });
  const pendingWithdrawalsCount = await prisma.withdrawalRequest.count({ where: { status: "PENDING" } });

  return {
    totalUsers,
    totalDeposited: totalDeposits._sum.amount || 0,
    totalWithdrawn: totalWithdrawals._sum.amount || 0,
    activeOrders,
    tradingVolume: closedOrders._sum.amount || 0,
    pendingKycCount,
    pendingDepositsCount,
    pendingWithdrawalsCount,
  };
}

// 2. User Management
export async function getAllUsers() {
  await verifyAdmin();

  return prisma.user.findMany({
    include: {
      wallets: true,
      kyc: true,
      _count: { select: { orders: true, transactions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateUserStatus(userId: string, status: "ACTIVE" | "FROZEN" | "BANNED") {
  const admin = await verifyAdmin();

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "USER_STATUS_CHANGE",
      targetType: "USER",
      targetId: userId,
      details: `Changed status of ${user.email} (UID: ${user.uid}) to ${status}`,
    },
  });

  safeRevalidate("/admin/users");
  return { success: true };
}

export async function updateUserRole(userId: string, role: "USER" | "ADMIN" | "SUPER_ADMIN" | "RM") {
  const admin = await verifyAdmin();

  if (admin.role !== "SUPER_ADMIN") {
    return { success: false, error: "Access denied. Only Super Admin can change user roles." };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  if (role === "RM") {
    const existingProfile = await prisma.rmProfile.findUnique({
      where: { userId },
    });
    if (!existingProfile) {
      await prisma.rmProfile.create({
        data: {
          userId,
          rmCode: `RM-${user.uid}`,
          designation: "Senior Crypto Relationship Manager",
          department: "Private Wealth & Institutional Trading",
          bio: "Dedicated digital asset portfolio and trading advisor.",
          specialties: "Perpetual Futures, Hedging, Options, Portfolio Allocation",
          rating: 4.9,
          experienceYears: 5,
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "ROLE_CHANGE",
      targetType: "USER",
      targetId: userId,
      details: `Changed role of ${user.email} to ${role}`,
    },
  });

  safeRevalidate("/admin/users");
  safeRevalidate("/admin/rm");
  return { success: true };
}

// 3. Balance & Asset Adjustments
export async function adjustUserBalance(data: {
  userId: string;
  asset: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  reason: string;
}) {
  const admin = await verifyAdmin();
  const { userId, asset, amount, type, reason } = data;

  if (!amount || amount <= 0) {
    return { success: false, error: "Amount must be greater than zero." };
  }
  if (!reason?.trim()) {
    return { success: false, error: "Reason for adjustment is required." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallets: true },
  });
  if (!user) return { success: false, error: "User not found." };

  let wallet = user.wallets.find((w: DBWallet) => w.asset === asset && w.type === "Currency");
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, asset, balance: 0.0, type: "Currency" },
    });
  }

  if (type === "DEBIT" && wallet.balance < amount) {
    return {
      success: false,
      error: `Cannot debit ${amount} ${asset}. Current balance is ${wallet.balance} ${asset}.`,
    };
  }

  const result = await prisma.$transaction(async (tx: DBClient) => {
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: type === "CREDIT" ? { increment: amount } : { decrement: amount },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: `Admin Adjustment (${type})`,
        asset,
        amount,
        status: "Passed",
        description: `Admin adjustment by ${admin.email}: ${reason}`,
      },
    });

    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "BALANCE_ADJUSTMENT",
        targetType: "WALLET",
        targetId: wallet.id,
        details: `${type} ${amount} ${asset} for ${user.email} (UID: ${user.uid}). Reason: ${reason}`,
      },
    });

    return updatedWallet;
  });

  safeRevalidate("/admin/users");
  safeRevalidate("/assets");
  return { success: true, newBalance: result.balance };
}

// 4. KYC Management
export async function getAllKycApplications() {
  await verifyAdmin();

  return prisma.kycApplication.findMany({
    include: { user: { select: { email: true, uid: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewKyc(
  kycId: string,
  decision: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  const admin = await verifyAdmin();

  const kyc = await prisma.kycApplication.findUnique({
    where: { id: kycId },
    include: { user: true },
  });
  if (!kyc) return { success: false, error: "KYC application not found." };

  await prisma.$transaction(async (tx: DBClient) => {
    await tx.kycApplication.update({
      where: { id: kycId },
      data: {
        status: decision,
        rejectionReason: decision === "REJECTED" ? rejectionReason : null,
        reviewedBy: admin.email,
        reviewedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: kyc.userId },
      data: { isKycVerified: decision === "APPROVED" },
    });

    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: decision === "APPROVED" ? "KYC_APPROVAL" : "KYC_REJECTION",
        targetType: "KYC",
        targetId: kycId,
        details: `Reviewed KYC for ${kyc.user.email} -> ${decision}${rejectionReason ? ` (${rejectionReason})` : ""}`,
      },
    });
  });

  safeRevalidate("/admin/kyc");
  safeRevalidate("/profile/kyc");

  // Send transactional email notification to user
  try {
    sendKycNotification({
      email: kyc.user.email,
      status: decision,
      reason: rejectionReason,
    }).catch((e) => console.warn("KYC notification async failed:", e));
  } catch (e) {
    console.warn("KYC notification dispatch error:", e);
  }

  return { success: true };
}

// 5. Deposit Management
export async function getAllDeposits() {
  await verifyAdmin();

  return prisma.depositRequest.findMany({
    include: { user: { select: { email: true, uid: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewDeposit(
  depositId: string,
  decision: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  const admin = await verifyAdmin();

  const deposit = await prisma.depositRequest.findUnique({
    where: { id: depositId },
    include: { user: { include: { wallets: true } } },
  });
  if (!deposit || deposit.status !== "PENDING") {
    return { success: false, error: "Deposit request not found or already reviewed." };
  }

  await prisma.$transaction(async (tx: DBClient) => {
    await tx.depositRequest.update({
      where: { id: depositId },
      data: {
        status: decision,
        rejectionReason: decision === "REJECTED" ? rejectionReason : null,
        reviewedBy: admin.email,
        reviewedAt: new Date(),
      },
    });

    if (decision === "APPROVED") {
      const existingWallet = deposit.user.wallets.find((w: DBWallet) => w.asset === "USDT" && w.type === "Currency");
      const walletId = existingWallet
        ? existingWallet.id
        : (await tx.wallet.create({
            data: { userId: deposit.userId, asset: "USDT", balance: 0.0, type: "Currency" },
          })).id;

      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: deposit.amount } },
      });
    }

    // Update Transaction record status
    await tx.transaction.updateMany({
      where: {
        userId: deposit.userId,
        type: "Deposit",
        amount: deposit.amount,
        status: "Processing",
      },
      data: {
        status: decision === "APPROVED" ? "Passed" : "Failed",
      },
    });

    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: decision === "APPROVED" ? "DEPOSIT_APPROVAL" : "DEPOSIT_REJECTION",
        targetType: "DEPOSIT",
        targetId: depositId,
        details: `${decision} deposit of ${deposit.amount} USDT for ${deposit.user.email}`,
      },
    });
  });

  safeRevalidate("/admin/deposits");
  safeRevalidate("/assets");
  safeRevalidate("/assets/records");

  // Send transactional email notification to user
  try {
    sendDepositNotification({
      email: deposit.user.email,
      amount: deposit.amount,
      asset: deposit.asset,
      status: decision,
      referenceNumber: deposit.referenceNumber,
      reason: rejectionReason,
    }).catch((e) => console.warn("Deposit notification async failed:", e));
  } catch (e) {
    console.warn("Deposit notification dispatch error:", e);
  }

  return { success: true };
}

// 6. Withdrawal Management
export async function getAllWithdrawals() {
  await verifyAdmin();

  return prisma.withdrawalRequest.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          uid: true,
          name: true,
          isKycVerified: true,
          kyc: {
            select: { status: true, rejectionReason: true, idNumber: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewWithdrawal(
  withdrawalId: string,
  decision: "APPROVED" | "REJECTED",
  rejectionReasonOrOptions?: string | {
    rejectionReason?: string;
    txHash?: string;
    adminNotes?: string;
  }
) {
  const admin = await verifyAdmin();

  const options = typeof rejectionReasonOrOptions === "string"
    ? { rejectionReason: rejectionReasonOrOptions }
    : (rejectionReasonOrOptions || {});

  const withdrawal: any = await prisma.withdrawalRequest.findUnique({
    where: { id: withdrawalId },
    include: { user: { include: { wallets: true } } },
  });
  if (!withdrawal || withdrawal.status !== "PENDING") {
    return { success: false, error: "Withdrawal not found or already processed." };
  }

  await prisma.$transaction(async (tx: DBClient) => {
    await tx.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: decision,
        rejectionReason: decision === "REJECTED" ? options.rejectionReason : null,
        txHash: decision === "APPROVED" ? options.txHash || null : null,
        adminNotes: options.adminNotes || null,
        reviewedBy: admin.email,
        reviewedAt: new Date(),
      } as any,
    });

    // If REJECTED, refund frozen balance back to user
    if (decision === "REJECTED") {
      const usdtWallet = withdrawal.user.wallets.find((w: DBWallet) => w.asset === "USDT" && w.type === "Currency");
      if (usdtWallet) {
        await tx.wallet.update({
          where: { id: usdtWallet.id },
          data: { balance: { increment: withdrawal.amount } },
        });
      }
    }

    // Update transaction record
    await tx.transaction.updateMany({
      where: {
        userId: withdrawal.userId,
        type: "Withdraw",
        amount: withdrawal.amount,
        status: "Processing",
      },
      data: {
        status: decision === "APPROVED" ? "Passed" : "Failed",
      },
    });

    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: decision === "APPROVED" ? "WITHDRAWAL_APPROVAL" : "WITHDRAWAL_REJECTION",
        targetType: "WITHDRAWAL",
        targetId: withdrawalId,
        details: `${decision} withdrawal of ${withdrawal.amount} ${withdrawal.asset} (${(withdrawal as any)?.method || "CRYPTO"}) for ${withdrawal.user.email}.${options.txHash ? ` TxHash: ${options.txHash}.` : ""}${options.adminNotes ? ` Notes: ${options.adminNotes}.` : ""}`,
      },
    });
  });

  safeRevalidate("/admin/withdrawals");
  safeRevalidate("/assets");
  safeRevalidate("/assets/records");

  // Send transactional email notification to user
  try {
    sendWithdrawalNotification({
      email: withdrawal.user.email,
      amount: withdrawal.amount,
      asset: withdrawal.asset,
      status: decision,
      receiveAmount: withdrawal.receiveAmount,
      reason: options.rejectionReason,
    }).catch((e) => console.warn("Withdrawal notification async failed:", e));
  } catch (e) {
    console.warn("Withdrawal notification dispatch error:", e);
  }

  return { success: true };
}

// 7. Trading Operations
export async function getAllTradingPositions() {
  await verifyAdmin();

  return prisma.order.findMany({
    include: { user: { select: { email: true, uid: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// 8. Payment Methods Management
export async function getAllPaymentMethods() {
  await verifyAdmin();
  return prisma.paymentMethod.findMany({ orderBy: { displayOrder: "asc" } });
}

export async function togglePaymentMethod(id: string, enabled: boolean) {
  const admin = await verifyAdmin();
  if (admin.role !== "SUPER_ADMIN" && admin.role !== "ADMIN") {
    return { success: false, error: "Access denied. Admin privileges required." };
  }
  await prisma.paymentMethod.update({ where: { id }, data: { enabled } });
  safeRevalidate("/admin/payment-methods");
  safeRevalidate("/assets/deposit");
  safeRevalidate("/assets/deposit/bank");
  return { success: true };
}

export interface PaymentMethodInput {
  name: string;
  type: "BANK" | "CRYPTO";
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifscOrSwift?: string;
  network?: string;
  address?: string;
  minAmount?: number;
  maxAmount?: number;
  instructions?: string;
  enabled?: boolean;
  displayOrder?: number;
}

export async function createPaymentMethod(data: PaymentMethodInput) {
  const admin = await verifyAdmin();
  if (!data.name || !data.name.trim()) {
    return { success: false, error: "Payment method name is required." };
  }
  if (data.type === "BANK") {
    if (!data.bankName?.trim() || !data.accountNumber?.trim() || !data.accountHolder?.trim()) {
      return {
        success: false,
        error: "Bank name, account holder, and account number are required for bank methods.",
      };
    }
  } else if (data.type === "CRYPTO") {
    if (!data.network?.trim() || !data.address?.trim()) {
      return {
        success: false,
        error: "Network and deposit wallet address are required for crypto methods.",
      };
    }
  }

  const method = await prisma.paymentMethod.create({
    data: {
      name: data.name.trim(),
      type: data.type,
      bankName: data.bankName?.trim() || null,
      accountHolder: data.accountHolder?.trim() || null,
      accountNumber: data.accountNumber?.trim() || null,
      ifscOrSwift: data.ifscOrSwift?.trim() || null,
      network: data.network?.trim() || null,
      address: data.address?.trim() || null,
      minAmount: typeof data.minAmount === "number" && data.minAmount >= 0 ? data.minAmount : 10.0,
      maxAmount: typeof data.maxAmount === "number" && data.maxAmount > 0 ? data.maxAmount : null,
      instructions: data.instructions?.trim() || null,
      enabled: data.enabled !== undefined ? data.enabled : true,
      displayOrder: typeof data.displayOrder === "number" ? data.displayOrder : 0,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CREATE_PAYMENT_METHOD",
      targetType: "PAYMENT_METHOD",
      targetId: method.id,
      details: `Created ${method.type} payment method: ${method.name}`,
    },
  });

  safeRevalidate("/admin/payment-methods");
  safeRevalidate("/assets/deposit");
  safeRevalidate("/assets/deposit/bank");
  return { success: true, data: method };
}

export async function updatePaymentMethod(id: string, data: Partial<PaymentMethodInput>) {
  const admin = await verifyAdmin();
  const existing = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Payment method not found." };
  }

  const method = await prisma.paymentMethod.update({
    where: { id },
    data: {
      name: data.name !== undefined ? data.name.trim() : existing.name,
      type: data.type !== undefined ? data.type : existing.type,
      bankName:
        data.bankName !== undefined
          ? data.bankName
            ? data.bankName.trim()
            : null
          : existing.bankName,
      accountHolder:
        data.accountHolder !== undefined
          ? data.accountHolder
            ? data.accountHolder.trim()
            : null
          : existing.accountHolder,
      accountNumber:
        data.accountNumber !== undefined
          ? data.accountNumber
            ? data.accountNumber.trim()
            : null
          : existing.accountNumber,
      ifscOrSwift:
        data.ifscOrSwift !== undefined
          ? data.ifscOrSwift
            ? data.ifscOrSwift.trim()
            : null
          : existing.ifscOrSwift,
      network:
        data.network !== undefined
          ? data.network
            ? data.network.trim()
            : null
          : existing.network,
      address:
        data.address !== undefined
          ? data.address
            ? data.address.trim()
            : null
          : existing.address,
      minAmount: data.minAmount !== undefined ? data.minAmount : existing.minAmount,
      maxAmount: data.maxAmount !== undefined ? data.maxAmount : existing.maxAmount,
      instructions:
        data.instructions !== undefined
          ? data.instructions
            ? data.instructions.trim()
            : null
          : existing.instructions,
      enabled: data.enabled !== undefined ? data.enabled : existing.enabled,
      displayOrder: data.displayOrder !== undefined ? data.displayOrder : existing.displayOrder,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "UPDATE_PAYMENT_METHOD",
      targetType: "PAYMENT_METHOD",
      targetId: method.id,
      details: `Updated ${method.type} payment method: ${method.name}`,
    },
  });

  safeRevalidate("/admin/payment-methods");
  safeRevalidate("/assets/deposit");
  safeRevalidate("/assets/deposit/bank");
  return { success: true, data: method };
}

export async function deletePaymentMethod(id: string) {
  const admin = await verifyAdmin();
  const existing = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Payment method not found." };
  }

  await prisma.paymentMethod.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "DELETE_PAYMENT_METHOD",
      targetType: "PAYMENT_METHOD",
      targetId: id,
      details: `Deleted payment method: ${existing.name}`,
    },
  });

  safeRevalidate("/admin/payment-methods");
  safeRevalidate("/assets/deposit");
  safeRevalidate("/assets/deposit/bank");
  return { success: true };
}

// 9. Audit Logs
export async function getAuditLogs() {
  await verifyAdmin();
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// -------------------------------------------------------------
// 10. Email Configuration & Management
// -------------------------------------------------------------

export interface EmailConfigInput {
  id?: string;
  provider: "BREVO" | "SMTP" | "HOSTINGER" | "CUSTOM";
  name: string;
  host?: string;
  port?: number;
  encryption?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  adminEmails?: string;
  notifyOnRegistration?: boolean;
  notifyOnDeposit?: boolean;
  notifyOnWithdrawal?: boolean;
  notifyOnKyc?: boolean;
  enabled?: boolean;
  isDefault?: boolean;
}

export async function getAllEmailConfigs() {
  await verifyAdmin();
  const configs = await prisma.emailConfig.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  // Mask sensitive secrets before sending to client
  return configs.map((c: DBEmailConfig) => ({
    ...c,
    hasPassword: Boolean(c.password),
    hasApiKey: Boolean(c.apiKey),
    password: c.password ? "••••••••" : "",
    apiKey: c.apiKey ? "••••••••" : "",
  }));
}

export async function saveEmailConfig(data: EmailConfigInput) {
  const admin = await verifyAdmin();

  if (!data.name?.trim()) {
    return { success: false, error: "Configuration Name is required." };
  }

  if (data.provider === "BREVO" && !data.apiKey && !data.id) {
    if (!data.host && !data.username) {
      return { success: false, error: "Brevo requires either an API Key or SMTP credentials." };
    }
  }

  if ((data.provider === "SMTP" || data.provider === "HOSTINGER") && !data.host?.trim() && !data.id) {
    return { success: false, error: "SMTP Host is required." };
  }

  const configId = data.id;

  if (configId) {
    const existing = await prisma.emailConfig.findUnique({ where: { id: configId } });
    if (!existing) {
      return { success: false, error: "Configuration not found." };
    }

    // Preserve existing password if user left it masked or blank
    const passwordToSave =
      data.password && data.password !== "••••••••" && data.password.trim() !== ""
        ? data.password.trim()
        : existing.password;

    // Preserve existing API key if masked or blank
    const apiKeyToSave =
      data.apiKey && data.apiKey !== "••••••••" && data.apiKey.trim() !== ""
        ? data.apiKey.trim()
        : existing.apiKey;

    if (data.isDefault) {
      await prisma.emailConfig.updateMany({
        where: { id: { not: configId } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.emailConfig.update({
      where: { id: configId },
      data: {
        name: data.name.trim(),
        provider: data.provider,
        host: data.host?.trim() || null,
        port: data.port || 587,
        encryption: data.encryption || "TLS",
        username: data.username?.trim() || null,
        password: passwordToSave,
        apiKey: apiKeyToSave,
        fromEmail: data.fromEmail?.trim() || "support@ethsltd.com",
        fromName: data.fromName?.trim() || "ETHSLTD Security",
        replyTo: data.replyTo?.trim() || null,
        adminEmails: data.adminEmails?.trim() || null,
        notifyOnRegistration: data.notifyOnRegistration ?? true,
        notifyOnDeposit: data.notifyOnDeposit ?? true,
        notifyOnWithdrawal: data.notifyOnWithdrawal ?? true,
        notifyOnKyc: data.notifyOnKyc ?? true,
        enabled: data.enabled ?? true,
        isDefault: data.isDefault ?? false,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "UPDATE_EMAIL_CONFIG",
        targetType: "EMAIL_CONFIG",
        targetId: updated.id,
        details: `Updated email provider configuration: ${updated.name} (${updated.provider})`,
      },
    });

    safeRevalidate("/admin/email-settings");
    return { success: true, data: updated };
  } else {
    // Creating new configuration
    if (data.isDefault) {
      await prisma.emailConfig.updateMany({
        data: { isDefault: false },
      });
    }

    const created = await prisma.emailConfig.create({
      data: {
        name: data.name.trim(),
        provider: data.provider,
        host: data.host?.trim() || null,
        port: data.port || 587,
        encryption: data.encryption || "TLS",
        username: data.username?.trim() || null,
        password: data.password?.trim() || null,
        apiKey: data.apiKey?.trim() || null,
        fromEmail: data.fromEmail?.trim() || "support@ethsltd.com",
        fromName: data.fromName?.trim() || "ETHSLTD Security",
        replyTo: data.replyTo?.trim() || null,
        adminEmails: data.adminEmails?.trim() || null,
        notifyOnRegistration: data.notifyOnRegistration ?? true,
        notifyOnDeposit: data.notifyOnDeposit ?? true,
        notifyOnWithdrawal: data.notifyOnWithdrawal ?? true,
        notifyOnKyc: data.notifyOnKyc ?? true,
        enabled: data.enabled ?? true,
        isDefault: data.isDefault ?? false,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "CREATE_EMAIL_CONFIG",
        targetType: "EMAIL_CONFIG",
        targetId: created.id,
        details: `Created new email provider: ${created.name} (${created.provider})`,
      },
    });

    safeRevalidate("/admin/email-settings");
    return { success: true, data: created };
  }
}

export async function deleteEmailConfig(id: string) {
  const admin = await verifyAdmin();
  const existing = await prisma.emailConfig.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Configuration not found." };

  await prisma.emailConfig.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "DELETE_EMAIL_CONFIG",
      targetType: "EMAIL_CONFIG",
      targetId: id,
      details: `Deleted email provider configuration: ${existing.name}`,
    },
  });

  safeRevalidate("/admin/email-settings");
  return { success: true };
}

export async function toggleEmailConfig(id: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdmin();
    await prisma.emailConfig.update({ where: { id }, data: { enabled } });
    safeRevalidate("/admin/email-settings");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update status.";
    return { success: false, error: errorMsg };
  }
}

export async function setDefaultEmailConfig(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdmin();
    await prisma.$transaction([
      prisma.emailConfig.updateMany({ data: { isDefault: false } }),
      prisma.emailConfig.update({ where: { id }, data: { isDefault: true, enabled: true } }),
    ]);
    safeRevalidate("/admin/email-settings");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to set default provider.";
    return { success: false, error: errorMsg };
  }
}

export async function testEmailProviderConnection(data: {
  configId?: string;
  toEmail: string;
}): Promise<EmailSendResult> {
  const admin = await verifyAdmin();
  const { configId, toEmail } = data;

  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, error: "Please enter a valid recipient email address for the test." };
  }

  try {
    const result = await sendTestEmail(toEmail.trim(), configId);

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "TEST_EMAIL_DISPATCH",
        targetType: "EMAIL_CONFIG",
        targetId: configId || "DEFAULT",
        details: `Dispatched test email to ${toEmail}. Result: ${result.success ? "Success" : result.error}`,
      },
    });

    safeRevalidate("/admin/email-settings");
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg || "Test dispatch failed." };
  }
}

// -------------------------------------------------------------
// 11. Email Delivery Logs & Retries
// -------------------------------------------------------------

export async function getAllEmailLogs(limit: number = 100) {
  await verifyAdmin();
  return prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function retryEmailLog(logId: string) {
  const admin = await verifyAdmin();
  const log = await prisma.emailLog.findUnique({ where: { id: logId } });
  if (!log) return { success: false, error: "Email log entry not found." };

  try {
    const result = await sendEmail({
      to: log.recipient,
      subject: `[RETRY] ${log.subject}`,
      eventType: log.eventType as SendEmailOptions["eventType"],
      html: `<p>This is a retried dispatch for: <strong>${log.subject}</strong></p><p>Original attempt: ${log.createdAt.toISOString()}</p>`,
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "RETRY_EMAIL_DISPATCH",
        targetType: "EMAIL_LOG",
        targetId: logId,
        details: `Retried email ${log.subject} to ${log.recipient}. Result: ${result.success ? "Success" : result.error}`,
      },
    });

    safeRevalidate("/admin/email-settings");
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Retry failed.";
    return { success: false, error: errorMsg };
  }
}

// ==========================================
// 12. RM (Relationship Manager) Admin Actions
// ==========================================

export async function getAllRmsAdmin() {
  await verifyAdmin();

  const rms = await prisma.user.findMany({
    where: { role: "RM" },
    include: {
      rmProfile: true,
      _count: {
        select: {
          rmManagedConnections: true,
          contractsAsRm: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rms.map((rm: any) => ({
    id: rm.id,
    uid: rm.uid,
    name: rm.name,
    email: rm.email,
    status: rm.status,
    avatarUrl: rm.avatarUrl || rm.rmProfile?.avatarUrl,
    rmCode: rm.rmProfile?.rmCode || `RM-${rm.uid}`,
    designation: rm.rmProfile?.designation || "Senior Relationship Manager",
    department: rm.rmProfile?.department || "Private Wealth & Institutional Trading",
    bio: rm.rmProfile?.bio,
    specialties: rm.rmProfile?.specialties,
    rating: rm.rmProfile?.rating || 4.9,
    experienceYears: rm.rmProfile?.experienceYears || 5,
    phone: rm.rmProfile?.phone || rm.phone,
    workingHours: rm.rmProfile?.workingHours || "09:00 - 21:00 UTC",
    maxClients: rm.rmProfile?.maxClients || 50,
    activeClientsCount: rm._count.rmManagedConnections,
    contractsCount: rm._count.contractsAsRm,
    createdAt: rm.createdAt,
  }));
}

export async function createRmAdmin(data: {
  name: string;
  email: string;
  password?: string;
  designation?: string;
  department?: string;
  rmCode?: string;
  specialties?: string;
  bio?: string;
  phone?: string;
  workingHours?: string;
  maxClients?: number;
}) {
  const admin = await verifyAdmin();

  const normalizedEmail = data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  let uid = Math.floor(100000 + Math.random() * 900000);
  while (await prisma.user.findUnique({ where: { uid } })) {
    uid = Math.floor(100000 + Math.random() * 900000);
  }

  const rawPassword = data.password || "Rm@123456";
  const passwordHash = await hashPassword(rawPassword);
  const rmCode = data.rmCode?.trim() || `RM-${uid}`;

  // Check unique rmCode
  const existingCode = await prisma.rmProfile.findUnique({ where: { rmCode } });
  if (existingCode) {
    return { success: false, error: "This RM Code is already in use. Please enter a unique code." };
  }

  const newUser = await prisma.$transaction(async (tx: DBClient) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: data.name.trim(),
        passwordHash,
        uid,
        role: "RM",
        status: "ACTIVE",
        phone: data.phone?.trim() || null,
        isKycVerified: true,
        transactionPin: "123456",
      },
    });

    await tx.rmProfile.create({
      data: {
        userId: user.id,
        rmCode,
        designation: data.designation?.trim() || "Senior Crypto Relationship Manager",
        department: data.department?.trim() || "Private Wealth & Institutional Trading",
        bio: data.bio?.trim() || "Dedicated digital asset portfolio and trading advisor.",
        specialties: data.specialties?.trim() || "Perpetual Futures, Hedging, Options, Portfolio Allocation",
        phone: data.phone?.trim() || null,
        workingHours: data.workingHours?.trim() || "09:00 - 21:00 UTC",
        maxClients: data.maxClients || 50,
        rating: 4.95,
        experienceYears: 5,
        status: "ACTIVE",
      },
    });

    // Create initial wallet accounts with strictly 0.0 balance (No automatic default funds or bonuses)
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

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CREATE_RM",
      targetType: "USER",
      targetId: newUser.id,
      details: `Created Relationship Manager ${newUser.name} (${rmCode}) - ${newUser.email}`,
    },
  });

  safeRevalidate("/admin/rm");
  safeRevalidate("/admin/users");
  safeRevalidate("/relationship-managers");
  return { success: true, user: newUser };
}

export async function updateRmProfileAdmin(data: {
  userId: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BUSY";
  designation: string;
  department: string;
  bio: string;
  specialties: string;
  phone?: string;
  workingHours?: string;
  maxClients?: number;
  rating?: number;
  experienceYears?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await verifyAdmin();

    await prisma.$transaction(async (tx: DBClient) => {
      await tx.user.update({
        where: { id: data.userId },
        data: {
          name: data.name,
          phone: data.phone || null,
          status: data.status === "SUSPENDED" ? "BANNED" : "ACTIVE",
        },
      });

      await tx.rmProfile.upsert({
        where: { userId: data.userId },
        update: {
          designation: data.designation,
          department: data.department,
          bio: data.bio,
          specialties: data.specialties,
          phone: data.phone || null,
          workingHours: data.workingHours || "09:00 - 21:00 UTC",
          maxClients: data.maxClients || 50,
          rating: data.rating || 4.9,
          experienceYears: data.experienceYears || 5,
          status: data.status,
        },
        create: {
          userId: data.userId,
          rmCode: `RM-${Date.now().toString().slice(-4)}`,
          designation: data.designation,
          department: data.department,
          bio: data.bio,
          specialties: data.specialties,
          phone: data.phone || null,
          workingHours: data.workingHours || "09:00 - 21:00 UTC",
          maxClients: data.maxClients || 50,
          rating: data.rating || 4.9,
          experienceYears: data.experienceYears || 5,
          status: data.status,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "UPDATE_RM_PROFILE",
        targetType: "RM_PROFILE",
        targetId: data.userId,
        details: `Updated RM profile for user ID ${data.userId}: Status ${data.status}, Designation ${data.designation}`,
      },
    });

    safeRevalidate("/admin/rm");
    safeRevalidate("/relationship-managers");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update RM profile." };
  }
}

export async function reassignRmClientsAdmin(data: {
  fromRmId: string;
  toRmId: string;
  notes?: string;
}) {
  const admin = await verifyAdmin();
  const { fromRmId, toRmId, notes } = data;

  if (fromRmId === toRmId) {
    return { success: false, error: "Source and target Relationship Managers cannot be the same." };
  }

  const [fromRm, toRm] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromRmId }, include: { rmProfile: true } }),
    prisma.user.findUnique({ where: { id: toRmId }, include: { rmProfile: true } }),
  ]);

  if (!fromRm || !toRm) {
    return { success: false, error: "One or both Relationship Managers could not be found." };
  }

  const connectionsToReassign = await prisma.rmConnection.findMany({
    where: { rmId: fromRmId },
  });

  if (connectionsToReassign.length === 0) {
    return { success: false, error: "The source RM has no connected clients to reassign." };
  }

  // Atomically reassign all connections, update active contracts, update conversations
  const result = await prisma.$transaction(async (tx: DBClient) => {
    let reassignedCount = 0;

    for (const conn of connectionsToReassign) {
      // Check if target RM already has a connection with this user
      const existingWithTarget = await tx.rmConnection.findUnique({
        where: {
          userId_rmId: {
            userId: conn.userId,
            rmId: toRmId,
          },
        },
      });

      if (existingWithTarget) {
        // If already connected, skip or merge
        continue;
      }

      // Update connection
      await tx.rmConnection.update({
        where: { id: conn.id },
        data: {
          rmId: toRmId,
          reassignedFromRmId: fromRmId,
          responseNotes: `Reassigned from ${fromRm.name || fromRm.email} (${fromRm.rmProfile?.rmCode}) to ${toRm.name || toRm.email} (${toRm.rmProfile?.rmCode}). Note: ${notes || "Administrative Reassignment"}`,
        },
      });

      // Update contracts
      await tx.investmentContract.updateMany({
        where: { connectionId: conn.id },
        data: {
          rmId: toRmId,
          partyAName: `${toRm.name || "RM"} (${toRm.rmProfile?.rmCode || `RM-${toRm.uid}`}) [Reassigned]`,
        },
      });

      // Update conversation
      await tx.rmConversation.updateMany({
        where: { connectionId: conn.id },
        data: {
          rmId: toRmId,
        },
      });

      // Notify the user about reassignment
      await tx.rmNotification.create({
        data: {
          userId: conn.userId,
          title: "Relationship Manager Reassigned",
          message: `Your account advisory has been reassigned to ${toRm.name || toRm.email} (${toRm.rmProfile?.rmCode || "RM"}). All contracts and records remain intact.`,
          type: "RM_REASSIGNED",
          linkUrl: `/rm/chat/${conn.id}`,
        },
      });

      reassignedCount++;
    }

    return reassignedCount;
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "REASSIGN_RM_CLIENTS",
      targetType: "RM_REASSIGNMENT",
      targetId: `${fromRmId}->${toRmId}`,
      details: `Reassigned ${result} client relationships from ${fromRm.email} to ${toRm.email}. Notes: ${notes || "None"}`,
    },
  });

  safeRevalidate("/admin/rm");
  safeRevalidate("/rm/dashboard");
  safeRevalidate("/relationship-managers");
  return {
    success: true,
    reassignedCount: result,
    message: `Successfully reassigned ${result} client relationships to ${toRm.name}.`,
  };
}

export async function getAllContractsAdmin(filters?: { status?: string; search?: string }) {
  await verifyAdmin();

  const where: any = {};
  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    where.OR = [
      { contractNumber: { contains: q } },
      { user: { email: { contains: q } } },
      { user: { name: { contains: q } } },
      { rm: { name: { contains: q } } },
      { rm: { email: { contains: q } } },
    ];
  }

  const contracts = await prisma.investmentContract.findMany({
    where,
    include: {
      user: { select: { id: true, uid: true, name: true, email: true } },
      rm: {
        select: {
          id: true,
          uid: true,
          name: true,
          email: true,
          rmProfile: { select: { rmCode: true, designation: true } },
        },
      },
      connection: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return contracts;
}

export async function getAllConnectionsAdmin(filters?: { status?: string; search?: string }) {
  await verifyAdmin();

  const where: any = {};
  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    where.OR = [
      { user: { email: { contains: q } } },
      { user: { name: { contains: q } } },
      { rm: { email: { contains: q } } },
      { rm: { name: { contains: q } } },
    ];
  }

  const connections = await prisma.rmConnection.findMany({
    where,
    include: {
      user: { select: { id: true, uid: true, name: true, email: true, isKycVerified: true } },
      rm: {
        select: {
          id: true,
          uid: true,
          name: true,
          email: true,
          rmProfile: { select: { rmCode: true, designation: true } },
        },
      },
      contracts: {
        select: { id: true, contractNumber: true, status: true },
        take: 1,
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  return connections;
}

