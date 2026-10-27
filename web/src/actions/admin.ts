"use server";

// Admin Server Actions
import prisma, { DBClient, DBWallet, DBEmailConfig } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getBackupDashboardStats,
  validateBackupPackage,
  restoreFullDatabase,
  restoreWebsiteConfiguration,
  restoreMediaArchive,
} from "@/lib/backup-service";
import {
  sendDepositNotification,
  sendWithdrawalNotification,
  sendKycNotification,
  sendTestEmail,
  sendEmail,
  EmailSendResult,
  SendEmailOptions,
} from "@/lib/email";

function sanitizeRmCode(code: string | null | undefined, fallbackUid?: number | string): string {
  if (!code) return fallbackUid ? `RM-${fallbackUid}` : "RM";
  const trimmed = code.trim();
  if (/[@#$%^&*+=<>?/\\]/.test(trimmed)) {
    return fallbackUid ? `RM-${fallbackUid}` : "RM";
  }
  return trimmed;
}

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

export type UserStatus = "ACTIVE" | "FROZEN" | "BANNED" | "FLAGGED_SPAM" | "PENDING_VERIFICATION";
export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN" | "RM";

export async function updateUserStatus(
  userId: string,
  status: UserStatus
) {
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

export async function updateUserRole(userId: string, role: UserRole) {
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

/**
 * Super Admin: Complete Permanent User Deletion
 * Purges user profile, auth, financial wallets, transactions, trading orders,
 * P2P marketplace ads/orders/messages/feedback, RM contracts/connections,
 * KYC applications & documents from Cloudflare D1 / storage, and logs an audit event.
 */
export async function adminDeleteUser(userId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const admin = await verifyAdmin();
  if (admin.role !== "SUPER_ADMIN") {
    return { success: false, error: "Access denied. Only Super Admin can permanently delete user accounts." };
  }

  if (admin.id === userId) {
    return { success: false, error: "Access denied: You cannot delete your own Super Admin account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallets: true,
      rmProfile: true,
      kyc: true,
    },
  });

  if (!target) {
    return { success: false, error: "User not found." };
  }

  // Protected Account Safeguards
  if (target.email === "admin@ethsltd.com" || target.uid === 100001) {
    return { success: false, error: "Protected System Account: The primary system Super Admin account cannot be deleted." };
  }

  if (target.role === "SUPER_ADMIN") {
    const superAdminCount = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    if (superAdminCount <= 1) {
      return { success: false, error: "Protected Account: Cannot delete the last remaining Super Admin account." };
    }
  }

  try {
    // 1. RM System Cleanup (Conversations, Messages, Contracts, Connections, Reviews)
    const connectionIds = (
      await prisma.rmConnection.findMany({
        where: { OR: [{ userId }, { rmId: userId }] },
        select: { id: true },
      })
    ).map((c: any) => c.id);

    const conversationIds = (
      await prisma.rmConversation.findMany({
        where: { OR: [{ connectionId: { in: connectionIds } }, { userId }, { rmId: userId }] },
        select: { id: true },
      })
    ).map((c: any) => c.id);

    if (conversationIds.length > 0) {
      await prisma.rmMessage.deleteMany({
        where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: userId }] },
      });
      await prisma.rmConversation.deleteMany({
        where: { id: { in: conversationIds } },
      });
    }

    if (connectionIds.length > 0) {
      await prisma.investmentContract.deleteMany({
        where: { OR: [{ connectionId: { in: connectionIds } }, { userId }, { rmId: userId }] },
      });
      await prisma.rmConnection.deleteMany({
        where: { id: { in: connectionIds } },
      });
    } else {
      await prisma.investmentContract.deleteMany({
        where: { OR: [{ userId }, { rmId: userId }] },
      });
    }

    await prisma.rmNotification.deleteMany({ where: { userId } });
    await prisma.rmReview.deleteMany({ where: { OR: [{ userId }, { rmId: userId }] } });
    if (target.rmProfile) {
      await prisma.rmProfile.deleteMany({ where: { userId } });
    }

    // 2. P2P Marketplace Cleanup (Ads, Orders, Messages, Disputes, Feedback, Payment Methods)
    const userAds = await prisma.p2pAd.findMany({ where: { userId }, select: { id: true } });
    const userAdIds = userAds.map((a: any) => a.id);

    const userOrders = await prisma.p2pOrder.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }, { adId: { in: userAdIds } }] },
      select: { id: true },
    });
    const orderIds = userOrders.map((o: any) => o.id);

    if (orderIds.length > 0) {
      await prisma.p2pFeedback.deleteMany({
        where: { OR: [{ orderId: { in: orderIds } }, { fromUserId: userId }, { toUserId: userId }] },
      });
      await prisma.p2pMessage.deleteMany({
        where: { OR: [{ orderId: { in: orderIds } }, { senderId: userId }] },
      });
      await prisma.p2pDispute.deleteMany({
        where: { OR: [{ orderId: { in: orderIds } }, { openerId: userId }] },
      });
      await prisma.p2pOrder.deleteMany({ where: { id: { in: orderIds } } });
    } else {
      await prisma.p2pFeedback.deleteMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      });
      await prisma.p2pMessage.deleteMany({ where: { senderId: userId } });
      await prisma.p2pDispute.deleteMany({ where: { openerId: userId } });
    }

    // Unassign this user if assigned as dispute admin
    await prisma.p2pDispute.updateMany({
      where: { assignedAdminId: userId },
      data: { assignedAdminId: null },
    });

    if (userAdIds.length > 0) {
      await prisma.p2pAd.deleteMany({ where: { id: { in: userAdIds } } });
    }
    await prisma.p2pPaymentMethod.deleteMany({ where: { userId } });

    // 3. Financial, Trading, and Wallets
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.depositRequest.deleteMany({ where: { userId } });
    await prisma.withdrawalRequest.deleteMany({ where: { userId } });
    await prisma.bankCard.deleteMany({ where: { userId } });
    await prisma.userCryptoWallet.deleteMany({ where: { userId } });
    await prisma.wallet.deleteMany({ where: { userId } });

    // 4. KYC & Stored Document Chunks in D1
    await prisma.kycApplication.deleteMany({ where: { userId } });
    try {
      const cf = getCloudflareContext({ async: false });
      const dbBinding = (cf as any)?.env?.DB || (globalThis as any).DB;
      if (dbBinding) {
        await dbBinding.prepare("DELETE FROM kyc_documents WHERE user_id = ?").bind(userId).run();
      } else {
        await prisma.$executeRawUnsafe("DELETE FROM kyc_documents WHERE user_id = $1", userId);
      }
    } catch (e) {
      console.warn("D1 kyc_documents deletion fallback warning:", e);
    }

    // 5. Auth Tokens
    await prisma.verificationToken.deleteMany({ where: { identifier: target.email } });

    // 6. Handle previous AuditLogs referencing this user
    await prisma.auditLog.deleteMany({ where: { targetType: "USER", targetId: userId } });
    await prisma.auditLog.deleteMany({ where: { adminId: userId } });

    // 7. Delete the User Record
    await prisma.user.delete({ where: { id: userId } });

    // 8. Record Immutable Administrative Audit Event
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "USER_PERMANENT_DELETION",
        targetType: "USER",
        targetId: userId,
        details: `Super Admin permanently deleted user UID: ${target.uid} (${target.email}, Role: ${target.role}) and purged all associated financial, P2P, KYC, and document records across the application.`,
      },
    });

    safeRevalidate("/admin/users");
    safeRevalidate("/admin/rm");
    safeRevalidate("/admin/kyc");
    safeRevalidate("/admin/deposits");
    safeRevalidate("/admin/withdrawals");

    return {
      success: true,
      message: `User ${target.email} (UID: ${target.uid}) and all associated records were permanently deleted.`,
    };
  } catch (err: any) {
    console.error("adminDeleteUser execution error:", err);
    return {
      success: false,
      error: `Failed to permanently delete user: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Super Admin: Backup and Restore Operations
 */
export async function adminGetBackupStats() {
  await verifyAdmin();
  return await getBackupDashboardStats();
}

export async function adminValidateBackupPackage(pkg: any) {
  await verifyAdmin();
  return validateBackupPackage(pkg);
}

export async function adminRestoreDatabase(pkg: any) {
  const admin = await verifyAdmin();
  if (admin.role !== "SUPER_ADMIN") {
    return { success: false, error: "Access denied. Only Super Admin can restore database backups." };
  }
  const validation = validateBackupPackage(pkg);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join("; ") };
  }
  const res = await restoreFullDatabase(pkg.data, admin);
  if (res.success) {
    safeRevalidate("/admin");
    safeRevalidate("/admin/users");
    safeRevalidate("/admin/markets");
    safeRevalidate("/admin/hero-slider");
  }
  return res;
}

export async function adminRestoreWebsiteConfig(pkg: any) {
  const admin = await verifyAdmin();
  if (admin.role !== "SUPER_ADMIN") {
    return { success: false, error: "Access denied. Only Super Admin can restore website configuration." };
  }
  const validation = validateBackupPackage(pkg);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join("; ") };
  }
  const res = await restoreWebsiteConfiguration(pkg.data, admin);
  if (res.success) {
    safeRevalidate("/admin/markets");
    safeRevalidate("/admin/hero-slider");
    safeRevalidate("/admin/p2p/channels");
    safeRevalidate("/admin/tracking");
  }
  return res;
}

export async function adminRestoreMedia(pkg: any) {
  const admin = await verifyAdmin();
  if (admin.role !== "SUPER_ADMIN") {
    return { success: false, error: "Access denied. Only Super Admin can restore media archives." };
  }
  const validation = validateBackupPackage(pkg);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join("; ") };
  }
  return await restoreMediaArchive(pkg.data, admin);
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
    include: {
      user: {
        select: {
          id: true,
          email: true,
          uid: true,
          name: true,
          phone: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getKycAuditHistory(kycId: string) {
  await verifyAdmin();
  return prisma.auditLog.findMany({
    where: {
      targetType: "KYC",
      targetId: kycId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function reviewKyc(
  kycId: string,
  decision: "APPROVED" | "REJECTED" | "ADDITIONAL_INFO_REQUIRED",
  reason?: string,
  checklist?: string[]
) {
  const admin = await verifyAdmin();

  const kyc = await prisma.kycApplication.findUnique({
    where: { id: kycId },
    include: { user: true },
  });
  if (!kyc) return { success: false, error: "KYC application not found." };

  if (decision === "REJECTED" && !reason?.trim()) {
    return { success: false, error: "Rejection reason is mandatory." };
  }

  if (decision === "ADDITIONAL_INFO_REQUIRED" && !reason?.trim()) {
    return {
      success: false,
      error: "Remarks/instructions for additional information or re-upload are mandatory.",
    };
  }

  await prisma.$transaction(async (tx: DBClient) => {
    await (tx.kycApplication as any).update({
      where: { id: kycId },
      data: {
        status: decision,
        rejectionReason: decision === "REJECTED" ? reason?.trim() : null,
        additionalInfoRequired:
          decision === "ADDITIONAL_INFO_REQUIRED" ? reason?.trim() : null,
        adminChecklist: checklist ? JSON.stringify(checklist) : undefined,
        reviewedBy: admin.email,
        reviewedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: kyc.userId },
      data: { isKycVerified: decision === "APPROVED" },
    });

    const actionName =
      decision === "APPROVED"
        ? "KYC_APPROVAL"
        : decision === "REJECTED"
        ? "KYC_REJECTION"
        : "KYC_ADDITIONAL_INFO_REQUEST";

    const checksStr = checklist && checklist.length > 0 ? ` | Checks: [${checklist.join(", ")}]` : "";
    const remarksStr = reason?.trim() ? ` | Remarks: "${reason.trim()}"` : "";
    const docType = (kyc as any).documentType || "ID";
    const attempts = (kyc as any).attemptCount || 1;

    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: actionName,
        targetType: "KYC",
        targetId: kycId,
        details: `KYC ${decision} for ${kyc.user.email} (UID: #${kyc.user.uid}, Doc: ${docType}, Attempt #${attempts})${remarksStr}${checksStr}`,
      },
    });
  });

  safeRevalidate("/admin/kyc");
  safeRevalidate("/profile/kyc");

  // Send transactional email notification to user
  try {
    await sendKycNotification({
      email: kyc.user.email,
      status: decision,
      reason: reason?.trim(),
    });
  } catch (e) {
    console.warn("KYC notification dispatch error:", e);
  }

  return { success: true };
}

// 5. Deposit Management
export async function getAllDeposits(limit: number = 100) {
  await verifyAdmin();

  return prisma.depositRequest.findMany({
    include: { user: { select: { email: true, uid: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
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

    // Safely update corresponding Transaction record matching this deposit's reference
    const cleanRef = deposit.referenceNumber ? deposit.referenceNumber.trim() : "";
    let updatedTx = { count: 0 };
    if (cleanRef) {
      updatedTx = await tx.transaction.updateMany({
        where: {
          userId: deposit.userId,
          type: "Deposit",
          status: "Processing",
          description: { contains: cleanRef },
        },
        data: {
          status: decision === "APPROVED" ? "Passed" : "Failed",
        },
      });
    }

    // Fallback if transaction record description lacked the reference string
    if (updatedTx.count === 0) {
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
    }

    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: decision === "APPROVED" ? "DEPOSIT_APPROVAL" : "DEPOSIT_REJECTION",
        targetType: "DEPOSIT",
        targetId: depositId,
        details: `${decision} deposit of ${deposit.amount} USDT for ${deposit.user.email} (Ref: ${deposit.referenceNumber})`,
      },
    });
  });

  safeRevalidate("/admin/deposits");
  safeRevalidate("/assets");
  safeRevalidate("/assets/records");

  // Send transactional email notification to user
  try {
    await sendDepositNotification({
      email: deposit.user.email,
      amount: deposit.amount,
      asset: deposit.asset,
      status: decision,
      referenceNumber: deposit.referenceNumber,
      reason: rejectionReason,
    });
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
    await sendWithdrawalNotification({
      email: withdrawal.user.email,
      amount: withdrawal.amount,
      asset: withdrawal.asset,
      status: decision,
      receiveAmount: withdrawal.receiveAmount,
      reason: options.rejectionReason,
    });
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
    rmCode: sanitizeRmCode(rm.rmProfile?.rmCode, rm.uid),
    designation: rm.rmProfile?.designation || "Senior Relationship Manager",
    department: rm.rmProfile?.department || "Private Wealth & Institutional Trading",
    bio: rm.rmProfile?.bio,
    rating: rm.rmProfile?.totalRatings ? Number(rm.rmProfile?.rating || 0) : 0,
    totalRatings: rm.rmProfile?.totalRatings || 0,
    experienceYears: rm.rmProfile?.experienceYears || 0,
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
  experienceYears?: number;
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

  let rmCode = data.rmCode?.trim();
  if (rmCode) {
    // Validate format: RM Code / User ID must be alphanumeric and cannot contain password characters
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(rmCode) || /[@#$%^&*+=<>?/\\]/.test(rmCode)) {
      return {
        success: false,
        error: "Invalid RM Code / User ID format. RM Code must be alphanumeric (e.g. 1004, 1005, RM-1005) and cannot contain passwords or special characters (@, #, $, etc.)."
      };
    }
  } else {
    rmCode = `RM-${uid}`;
  }

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
        rating: 0,
        totalRatings: 0,
        experienceYears: Number(data.experienceYears) || 0,
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
  rmCode?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await verifyAdmin();

    let cleanRmCode: string | undefined = undefined;
    if (data.rmCode !== undefined) {
      cleanRmCode = data.rmCode.trim();
      if (cleanRmCode) {
        if (!/^[A-Za-z0-9_-]{2,30}$/.test(cleanRmCode) || /[@#$%^&*+=<>?/\\]/.test(cleanRmCode)) {
          return {
            success: false,
            error: "Invalid RM Code / User ID format. Must be alphanumeric (e.g. 1004, 1005, RM-1005) and cannot contain passwords or special characters.",
          };
        }
        const existing = await prisma.rmProfile.findFirst({
          where: { rmCode: cleanRmCode, NOT: { userId: data.userId } },
        });
        if (existing) {
          return { success: false, error: "This RM Code is already in use by another manager." };
        }
      }
    }

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
          ...(data.rating !== undefined ? { rating: Number(data.rating) } : {}),
          experienceYears: data.experienceYears !== undefined ? Number(data.experienceYears) : 0,
          status: data.status,
          ...(cleanRmCode ? { rmCode: cleanRmCode } : {}),
        },
        create: {
          userId: data.userId,
          rmCode: cleanRmCode || `RM-${Date.now().toString().slice(-4)}`,
          designation: data.designation,
          department: data.department,
          bio: data.bio,
          specialties: data.specialties,
          phone: data.phone || null,
          workingHours: data.workingHours || "09:00 - 21:00 UTC",
          maxClients: data.maxClients || 50,
          rating: data.rating !== undefined ? Number(data.rating) : 0,
          totalRatings: 0,
          experienceYears: data.experienceYears !== undefined ? Number(data.experienceYears) : 0,
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

// ==========================================
// P2P ADMIN ACTIONS
// ==========================================

export async function getAdminP2pStats() {
  await verifyAdmin();

  const [totalOrders, completedOrders, disputedOrders, totalDisputes, activeAds, openDisputes] =
    await Promise.all([
      prisma.p2pOrder.count(),
      prisma.p2pOrder.count({ where: { status: "COMPLETED" } }),
      prisma.p2pOrder.count({ where: { status: "DISPUTED" } }),
      prisma.p2pDispute.count(),
      prisma.p2pAd.count({ where: { status: "ACTIVE" } }),
      prisma.p2pDispute.count({ where: { status: "OPEN" } }),
    ]);

  const completed = await prisma.p2pOrder.findMany({
    where: { status: "COMPLETED" },
    select: { fiatAmount: true, cryptoAmount: true },
  });

  const totalVolumeFiat = completed.reduce((sum, o) => sum + (parseFloat(o.fiatAmount) || 0), 0);
  const totalVolumeCrypto = completed.reduce((sum, o) => sum + (parseFloat(o.cryptoAmount) || 0), 0);

  return {
    totalOrders,
    completedOrders,
    disputedOrders,
    totalDisputes,
    activeAds,
    openDisputes,
    totalVolumeFiat,
    totalVolumeCrypto,
  };
}

export async function getAdminP2pOrders(filters?: { status?: string; search?: string }) {
  await verifyAdmin();

  const where: any = {};
  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status.toUpperCase();
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    where.OR = [
      { id: { contains: q } },
      { displayId: { contains: q } },
      { buyer: { email: { contains: q } } },
      { seller: { email: { contains: q } } },
    ];
  }

  const orders = await prisma.p2pOrder.findMany({
    where,
    include: {
      ad: true,
      buyer: { select: { id: true, uid: true, name: true, email: true } },
      seller: { select: { id: true, uid: true, name: true, email: true } },
      disputes: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return [...orders].sort((a: any, b: any) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeB - timeA;
  });
}

export async function getAdminP2pDisputes(filters?: { status?: string }) {
  await verifyAdmin();

  const where: any = {};
  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status.toUpperCase();
  }

  const disputes = await prisma.p2pDispute.findMany({
    where,
    include: {
      order: {
        include: {
          ad: true,
          buyer: { select: { id: true, uid: true, name: true, email: true } },
          seller: { select: { id: true, uid: true, name: true, email: true } },
        },
      },
      opener: { select: { id: true, uid: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const sortedDisputes = [...disputes].sort((a: any, b: any) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeB - timeA;
  });

  return sortedDisputes.map((d: any) => ({
    ...d,
    evidenceUrls: typeof d.evidenceUrls === "string" ? JSON.parse(d.evidenceUrls || "[]") : d.evidenceUrls,
  }));
}

export async function resolveAdminP2pDispute(
  disputeId: string,
  data: {
    decision: "BUYER_WINS" | "SELLER_WINS" | "SPLIT" | "DISMISSED";
    resolutionNotes?: string;
    releaseEscrowTo?: "BUYER" | "SELLER" | "NONE";
  }
) {
  const admin = await verifyAdmin();

  const dispute = await prisma.p2pDispute.findUnique({
    where: { id: disputeId },
    include: { order: { include: { ad: true } } },
  });

  if (!dispute) {
    return { success: false, error: "Dispute not found" };
  }

  const order = dispute.order;
  if (!order) {
    return { success: false, error: "Order associated with dispute not found" };
  }

  const asset = order.ad.asset;
  const cryptoNum = parseFloat(order.cryptoAmount) || 0;

  const result = await prisma.$transaction(async (tx: DBClient) => {
    // 1. Release escrow according to decision
    if (data.releaseEscrowTo === "BUYER" || data.decision === "BUYER_WINS") {
      // Deduct seller escrow (check P2P wallet first, then Currency wallet)
      let sellerWallet = await tx.wallet.findFirst({
        where: { userId: order.sellerId, asset, type: "P2P", escrowBalance: { gte: cryptoNum } },
      });
      if (!sellerWallet) {
        sellerWallet = await tx.wallet.findFirst({
          where: { userId: order.sellerId, asset, type: "Currency" },
        });
      }
      if (sellerWallet) {
        const decAmt = Math.min(sellerWallet.escrowBalance, cryptoNum);
        await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: { escrowBalance: { decrement: decAmt } },
        });
      }

      // Credit buyer's Funding (P2P) wallet
      let buyerWallet = await tx.wallet.findFirst({
        where: { userId: order.buyerId, asset, type: "P2P" },
      });
      if (!buyerWallet) {
        buyerWallet = await tx.wallet.create({
          data: { userId: order.buyerId, asset, type: "P2P", balance: cryptoNum },
        });
      } else {
        await tx.wallet.update({
          where: { id: buyerWallet.id },
          data: { balance: { increment: cryptoNum } },
        });
      }

      // Double-entry transaction records
      await tx.transaction.create({
        data: {
          userId: order.buyerId,
          type: "P2P",
          asset,
          amount: cryptoNum,
          status: "Passed",
          description: `Dispute Resolution: Received ${cryptoNum} ${asset} for P2P Order ${order.displayId || order.id}`,
        },
      });

      await tx.transaction.create({
        data: {
          userId: order.sellerId,
          type: "P2P",
          asset,
          amount: -cryptoNum,
          status: "Passed",
          description: `Dispute Resolution: Deducted ${cryptoNum} ${asset} for P2P Order ${order.displayId || order.id}`,
        },
      });

      await tx.p2pOrder.update({
        where: { id: order.id },
        data: { status: "COMPLETED" },
      });
    } else if (data.releaseEscrowTo === "SELLER" || data.decision === "SELLER_WINS") {
      // Return escrow to seller balance (check P2P wallet first, then Currency wallet)
      let sellerWallet = await tx.wallet.findFirst({
        where: { userId: order.sellerId, asset, type: "P2P", escrowBalance: { gte: cryptoNum } },
      });
      if (!sellerWallet) {
        sellerWallet = await tx.wallet.findFirst({
          where: { userId: order.sellerId, asset, type: "Currency" },
        });
      }
      if (sellerWallet) {
        const decAmt = Math.min(sellerWallet.escrowBalance, cryptoNum);
        await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: {
            escrowBalance: { decrement: decAmt },
            balance: { increment: cryptoNum },
          },
        });
      }

      await tx.p2pOrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
    }

    // 2. Update dispute status
    const status =
      data.decision === "BUYER_WINS"
        ? "RESOLVED_BUYER"
        : data.decision === "SELLER_WINS"
        ? "RESOLVED_SELLER"
        : "CANCELLED";

    const updatedDispute = await tx.p2pDispute.update({
      where: { id: disputeId },
      data: {
        status,
        adminNotes: data.resolutionNotes || `Decision: ${data.decision}`,
        assignedAdminId: admin.id,
      },
    });

    // 3. Post system message
    await tx.p2pMessage.create({
      data: {
        orderId: order.id,
        senderId: admin.id,
        content: `Admin Dispute Resolved: Decision '${data.decision}'. Notes: ${data.resolutionNotes || "None"}`,
        type: "SYSTEM",
      },
    });

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "RESOLVE_P2P_DISPUTE",
        targetType: "P2P_DISPUTE",
        targetId: disputeId,
        details: `Resolved dispute ${dispute.displayId || dispute.id} with decision ${data.decision}. Notes: ${data.resolutionNotes || "None"}`,
      },
    });

    return updatedDispute;
  });

  safeRevalidate("/admin/p2p/disputes");
  safeRevalidate("/admin/p2p/orders");
  safeRevalidate(`/p2p/order/${order.id}`);

  return { success: true, data: result };
}

// -------------------------------------------------------------
// 12. Admin Centralized P2P Payment Method Management
// -------------------------------------------------------------

export interface AdminP2pPaymentMethodInput {
  identifier: string;
  name: string;
  channelTypeId?: string | null;
  type?: string; // BANK, UPI, WALLET, OTHER
  currency?: string; // ALL, INR, USD, EUR, etc.
  instructions?: string;
  fields?: any;
  isActive?: boolean;
  displayOrder?: number;
}

export async function getAdminP2pPaymentMethods(): Promise<{ success: boolean; data?: any[]; channelTypes?: any[]; error?: string }> {
  try {
    await verifyAdmin();

    const [methods, activeAds, channelTypes] = await Promise.all([
      (prisma.p2pSystemPaymentMethod as any).findMany({
        include: {
          channelType: {
            include: {
              fields: {
                orderBy: { displayOrder: "asc" },
              },
            },
          },
        },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.p2pAd.findMany({
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        select: { id: true, paymentMethods: true },
      }),
      prisma.p2pChannelType.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        include: {
          fields: {
            where: { isActive: true },
            orderBy: { displayOrder: "asc" },
          },
        },
      }),
    ]);

    const parsedMethods = methods.map((m: any) => {
      let adUsageCount = 0;
      const identifierLower = m.identifier.toLowerCase();
      const nameLower = m.name.toLowerCase();

      for (const ad of activeAds) {
        try {
          const methodsArr =
            typeof ad.paymentMethods === "string"
              ? JSON.parse(ad.paymentMethods || "[]")
              : ad.paymentMethods;
          if (Array.isArray(methodsArr)) {
            const isUsed = methodsArr.some((item: any) => {
              const itemName = typeof item === "string" ? item : (item?.type || item?.name || "");
              const itemLower = itemName.toLowerCase();
              return (
                itemLower === identifierLower ||
                itemLower === nameLower ||
                itemLower.includes(identifierLower)
              );
            });
            if (isUsed) adUsageCount++;
          }
        } catch {}
      }

      return {
        ...m,
        fields: typeof m.fields === "string" ? JSON.parse(m.fields || "[]") : m.fields,
        adUsageCount,
      };
    });

    return { success: true, data: parsedMethods, channelTypes };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to load payment methods" };
  }
}

export async function createAdminP2pPaymentMethod(data: AdminP2pPaymentMethodInput) {
  const admin = await verifyAdmin();

  if (!data.name?.trim()) {
    return { success: false, error: "Payment method name is required." };
  }

  const identifier = (data.identifier || data.name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");

  const existing = await prisma.p2pSystemPaymentMethod.findUnique({
    where: { identifier },
  });

  if (existing) {
    return { success: false, error: `A payment method with identifier '${identifier}' already exists.` };
  }

  let inferredType = data.type || "BANK";
  if (data.channelTypeId) {
    const ct = await prisma.p2pChannelType.findUnique({ where: { id: data.channelTypeId } });
    if (ct) inferredType = ct.identifier;
  }

  const created = await (prisma.p2pSystemPaymentMethod as any).create({
    data: {
      identifier,
      name: data.name.trim(),
      channelTypeId: data.channelTypeId || null,
      type: inferredType,
      currency: (data.currency || "ALL").toUpperCase().trim(),
      instructions: data.instructions?.trim() || null,
      fields: data.fields ? JSON.stringify(data.fields) : null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      displayOrder: typeof data.displayOrder === "number" ? data.displayOrder : 0,
    },
    include: {
      channelType: {
        include: {
          fields: { orderBy: { displayOrder: "asc" } },
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CREATE_P2P_PAYMENT_METHOD",
      targetType: "P2P_SYSTEM_PAYMENT_METHOD",
      targetId: created.id,
      details: `Created P2P payment method '${created.name}' (${created.identifier})`,
    },
  });

  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  safeRevalidate("/p2p/payment-methods");
  safeRevalidate("/p2p");
  return { success: true, data: created };
}

export async function updateAdminP2pPaymentMethod(
  id: string,
  data: Partial<AdminP2pPaymentMethodInput>
) {
  const admin = await verifyAdmin();

  const existing = await prisma.p2pSystemPaymentMethod.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Payment method not found." };
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.channelTypeId !== undefined) {
    updateData.channelTypeId = data.channelTypeId || null;
    if (!data.type && data.channelTypeId) {
      const ct = await prisma.p2pChannelType.findUnique({ where: { id: data.channelTypeId } });
      if (ct) updateData.type = ct.identifier;
    }
  }
  if (data.type !== undefined) updateData.type = data.type;
  if (data.currency !== undefined) updateData.currency = data.currency.toUpperCase().trim();
  if (data.instructions !== undefined) updateData.instructions = data.instructions?.trim() || null;
  if (data.fields !== undefined) updateData.fields = JSON.stringify(data.fields);
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

  const updated = await (prisma.p2pSystemPaymentMethod as any).update({
    where: { id },
    data: updateData,
    include: {
      channelType: {
        include: {
          fields: { orderBy: { displayOrder: "asc" } },
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "UPDATE_P2P_PAYMENT_METHOD",
      targetType: "P2P_SYSTEM_PAYMENT_METHOD",
      targetId: id,
      details: `Updated P2P payment method '${updated.name}' (${updated.identifier})`,
    },
  });

  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  safeRevalidate("/p2p/payment-methods");
  safeRevalidate("/p2p");
  return { success: true, data: updated };
}

export async function toggleAdminP2pPaymentMethod(id: string, isActive: boolean) {
  const admin = await verifyAdmin();

  const existing = await prisma.p2pSystemPaymentMethod.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Payment method not found." };
  }

  const updated = await prisma.p2pSystemPaymentMethod.update({
    where: { id },
    data: { isActive },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "TOGGLE_P2P_PAYMENT_METHOD",
      targetType: "P2P_SYSTEM_PAYMENT_METHOD",
      targetId: id,
      details: `Changed active status of '${existing.name}' to ${isActive}`,
    },
  });

  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  safeRevalidate("/p2p/payment-methods");
  safeRevalidate("/p2p");
  return { success: true, data: updated };
}

export async function deleteAdminP2pPaymentMethod(id: string) {
  const admin = await verifyAdmin();

  const existing = await prisma.p2pSystemPaymentMethod.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Payment method not found." };
  }

  // Safety check: check active ads usage
  const activeAds = await prisma.p2pAd.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true, paymentMethods: true },
  });

  const identifierLower = existing.identifier.toLowerCase();
  const nameLower = existing.name.toLowerCase();
  let usageCount = 0;

  for (const ad of activeAds) {
    try {
      const methodsArr =
        typeof ad.paymentMethods === "string"
          ? JSON.parse(ad.paymentMethods || "[]")
          : ad.paymentMethods;
      if (Array.isArray(methodsArr)) {
        const isUsed = methodsArr.some((item: any) => {
          if (typeof item === "string") {
            const strLower = item.toLowerCase();
            return strLower === identifierLower || strLower === nameLower;
          }
          const itemType = (item?.type || "").toLowerCase();
          const itemName = (item?.name || "").toLowerCase();
          const itemIdent = (item?.identifier || "").toLowerCase();
          return (
            itemType === identifierLower ||
            itemType === nameLower ||
            itemName === identifierLower ||
            itemName === nameLower ||
            itemIdent === identifierLower
          );
        });
        if (isUsed) usageCount++;
      }
    } catch {}
  }

  if (usageCount > 0) {
    return {
      success: false,
      error: `Cannot delete payment method '${existing.name}': It is currently configured on ${usageCount} active advertisement(s). Please deactivate it instead so existing ads are preserved while preventing new ads from selecting it.`,
    };
  }

  await prisma.p2pSystemPaymentMethod.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "DELETE_P2P_PAYMENT_METHOD",
      targetType: "P2P_SYSTEM_PAYMENT_METHOD",
      targetId: id,
      details: `Deleted P2P payment method '${existing.name}' (${existing.identifier})`,
    },
  });

  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  safeRevalidate("/p2p/payment-methods");
  safeRevalidate("/p2p");
  return { success: true };
}

// =============================================================
// 13. Channel Types & Dynamic Custom Fields Management
// =============================================================

export interface ChannelFieldInput {
  fieldName: string;
  fieldLabel: string;
  fieldType?: string; // TEXT, NUMBER, EMAIL, PHONE, TEXTAREA, DROPDOWN, RADIO, CHECKBOX, DATE
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  options?: string[]; // for DROPDOWN / RADIO
  validationRule?: string;
  minLength?: number;
  maxLength?: number;
  displayOrder?: number;
  isActive?: boolean;
}

export interface ChannelTypeInput {
  name: string;
  identifier: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export async function getAdminChannelTypes(params?: { search?: string; status?: string }) {
  await verifyAdmin();
  try {
    const where: any = {};
    if (params?.status === "active") where.isActive = true;
    if (params?.status === "inactive") where.isActive = false;

    let channelTypes = await prisma.p2pChannelType.findMany({
      where,
      include: {
        fields: {
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: { systemPaymentMethods: true },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    if (params?.search?.trim()) {
      const q = params.search.toLowerCase().trim();
      channelTypes = channelTypes.filter(
        (c: any) => c.name.toLowerCase().includes(q) || c.identifier.toLowerCase().includes(q)
      );
    }

    const parsed = channelTypes.map((c: any) => ({
      ...c,
      fields: c.fields.map((f: any) => ({
        ...f,
        options: f.options ? (typeof f.options === "string" ? JSON.parse(f.options) : f.options) : [],
      })),
    }));

    return { success: true, data: parsed };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to load channel types" };
  }
}

export async function createAdminChannelType(data: ChannelTypeInput) {
  const admin = await verifyAdmin();

  if (!data.name?.trim()) {
    return { success: false, error: "Channel Type name is required." };
  }

  const identifier = (data.identifier || data.name)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_");

  const existing = await prisma.p2pChannelType.findUnique({
    where: { identifier },
  });

  if (existing) {
    return { success: false, error: `Channel Type with code '${identifier}' already exists.` };
  }

  const created = await prisma.p2pChannelType.create({
    data: {
      identifier,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      icon: data.icon?.trim() || "Landmark",
      displayOrder: typeof data.displayOrder === "number" ? data.displayOrder : 0,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
    include: {
      fields: true,
      _count: { select: { systemPaymentMethods: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CREATE_CHANNEL_TYPE",
      targetType: "P2P_CHANNEL_TYPE",
      targetId: created.id,
      details: `Created channel type '${created.name}' (${created.identifier})`,
    },
  });

  safeRevalidate("/admin/p2p/channels");
  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  return { success: true, data: created };
}

export async function updateAdminChannelType(id: string, data: Partial<ChannelTypeInput>) {
  const admin = await verifyAdmin();

  const existing = await prisma.p2pChannelType.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Channel type not found." };
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.icon !== undefined) updateData.icon = data.icon?.trim() || "Landmark";
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.p2pChannelType.update({
    where: { id },
    data: updateData,
    include: {
      fields: { orderBy: { displayOrder: "asc" } },
      _count: { select: { systemPaymentMethods: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "UPDATE_CHANNEL_TYPE",
      targetType: "P2P_CHANNEL_TYPE",
      targetId: id,
      details: `Updated channel type '${updated.name}' (${updated.identifier})`,
    },
  });

  safeRevalidate("/admin/p2p/channels");
  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  return { success: true, data: updated };
}

export async function toggleAdminChannelType(id: string, isActive: boolean) {
  const admin = await verifyAdmin();

  const existing = await prisma.p2pChannelType.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Channel type not found." };

  const updated = await prisma.p2pChannelType.update({
    where: { id },
    data: { isActive },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "TOGGLE_CHANNEL_TYPE",
      targetType: "P2P_CHANNEL_TYPE",
      targetId: id,
      details: `Changed channel type '${existing.name}' status to ${isActive}`,
    },
  });

  safeRevalidate("/admin/p2p/channels");
  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  return { success: true, data: updated };
}

export async function deleteAdminChannelType(id: string) {
  const admin = await verifyAdmin();

  const existing = await prisma.p2pChannelType.findUnique({
    where: { id },
    include: {
      systemPaymentMethods: { select: { id: true, name: true } },
    },
  });

  if (!existing) return { success: false, error: "Channel type not found." };

  if (existing.systemPaymentMethods.length > 0) {
    return {
      success: false,
      error: `Cannot delete Channel Type '${existing.name}': It is linked to ${existing.systemPaymentMethods.length} payment method(s) (e.g. ${existing.systemPaymentMethods.map((m: any) => m.name).slice(0, 3).join(', ')}). Please reassign or delete the payment methods first.`,
    };
  }

  await prisma.p2pChannelType.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "DELETE_CHANNEL_TYPE",
      targetType: "P2P_CHANNEL_TYPE",
      targetId: id,
      details: `Deleted channel type '${existing.name}' (${existing.identifier})`,
    },
  });

  safeRevalidate("/admin/p2p/channels");
  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  return { success: true };
}

export async function createAdminChannelField(channelTypeId: string, data: ChannelFieldInput) {
  const admin = await verifyAdmin();

  if (!data.fieldName?.trim() || !data.fieldLabel?.trim()) {
    return { success: false, error: "Field Name and Field Label are required." };
  }

  const cleanName = data.fieldName.trim().replace(/[^a-zA-Z0-9_]/g, '');

  const existing = await prisma.p2pChannelField.findUnique({
    where: {
      channelTypeId_fieldName: {
        channelTypeId,
        fieldName: cleanName,
      },
    },
  });

  if (existing) {
    return { success: false, error: `A field with name '${cleanName}' already exists on this channel type.` };
  }

  const created = await prisma.p2pChannelField.create({
    data: {
      channelTypeId,
      fieldName: cleanName,
      fieldLabel: data.fieldLabel.trim(),
      fieldType: data.fieldType || "TEXT",
      required: data.required !== undefined ? data.required : true,
      placeholder: data.placeholder?.trim() || null,
      helpText: data.helpText?.trim() || null,
      defaultValue: data.defaultValue?.trim() || null,
      options: data.options ? JSON.stringify(data.options) : null,
      validationRule: data.validationRule?.trim() || null,
      minLength: data.minLength || null,
      maxLength: data.maxLength || null,
      displayOrder: typeof data.displayOrder === "number" ? data.displayOrder : 0,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CREATE_CHANNEL_FIELD",
      targetType: "P2P_CHANNEL_FIELD",
      targetId: created.id,
      details: `Added custom field '${created.fieldLabel}' (${created.fieldName}) to channel type`,
    },
  });

  safeRevalidate("/admin/p2p/channels");
  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  return { success: true, data: created };
}

export async function updateAdminChannelField(fieldId: string, data: Partial<ChannelFieldInput>) {
  const admin = await verifyAdmin();

  const existing = await prisma.p2pChannelField.findUnique({ where: { id: fieldId } });
  if (!existing) return { success: false, error: "Field not found." };

  const updateData: any = {};
  if (data.fieldLabel !== undefined) updateData.fieldLabel = data.fieldLabel.trim();
  if (data.fieldType !== undefined) updateData.fieldType = data.fieldType;
  if (data.required !== undefined) updateData.required = data.required;
  if (data.placeholder !== undefined) updateData.placeholder = data.placeholder?.trim() || null;
  if (data.helpText !== undefined) updateData.helpText = data.helpText?.trim() || null;
  if (data.defaultValue !== undefined) updateData.defaultValue = data.defaultValue?.trim() || null;
  if (data.options !== undefined) updateData.options = JSON.stringify(data.options);
  if (data.validationRule !== undefined) updateData.validationRule = data.validationRule?.trim() || null;
  if (data.minLength !== undefined) updateData.minLength = data.minLength || null;
  if (data.maxLength !== undefined) updateData.maxLength = data.maxLength || null;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.p2pChannelField.update({
    where: { id: fieldId },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "UPDATE_CHANNEL_FIELD",
      targetType: "P2P_CHANNEL_FIELD",
      targetId: fieldId,
      details: `Updated custom field '${updated.fieldLabel}'`,
    },
  });

  safeRevalidate("/admin/p2p/channels");
  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  return { success: true, data: updated };
}

export async function deleteAdminChannelField(fieldId: string) {
  const admin = await verifyAdmin();

  const existing = await prisma.p2pChannelField.findUnique({ where: { id: fieldId } });
  if (!existing) return { success: false, error: "Field not found." };

  await prisma.p2pChannelField.delete({ where: { id: fieldId } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "DELETE_CHANNEL_FIELD",
      targetType: "P2P_CHANNEL_FIELD",
      targetId: fieldId,
      details: `Deleted custom field '${existing.fieldLabel}' (${existing.fieldName})`,
    },
  });

  safeRevalidate("/admin/p2p/channels");
  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  return { success: true };
}

export async function reorderAdminChannelFields(channelTypeId: string, fieldIds: string[]) {
  await verifyAdmin();

  for (let i = 0; i < fieldIds.length; i++) {
    await prisma.p2pChannelField.update({
      where: { id: fieldIds[i] },
      data: { displayOrder: i + 1 },
    });
  }

  safeRevalidate("/admin/p2p/channels");
  safeRevalidate("/admin/p2p/payment-methods");
  safeRevalidate("/p2p/post-ad");
  return { success: true };
}

// =============================================================
// 14. Crypto Assets Management (Admin)
// =============================================================

export interface CryptoAssetInput {
  symbol: string;
  name: string;
  iconUrl?: string;
  description?: string;
  networks: string[];
  decimals?: number;
  isActive?: boolean;
  canDeposit?: boolean;
  canWithdraw?: boolean;
  canP2p?: boolean;
  displayOrder?: number;
}

export async function getAdminCryptoAssets(params?: { search?: string; status?: string }) {
  await verifyAdmin();
  try {
    const where: any = {};
    if (params?.status === "active") where.isActive = true;
    if (params?.status === "inactive") where.isActive = false;

    const assets = await prisma.cryptoAsset.findMany({
      where,
      orderBy: { displayOrder: "asc" },
    });

    let result = assets.map((a: any) => ({
      ...a,
      networks: typeof a.networks === "string" ? JSON.parse(a.networks || "[]") : a.networks,
    }));

    if (params?.search?.trim()) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (a: any) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
      );
    }

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to load crypto assets" };
  }
}

export async function createAdminCryptoAsset(data: CryptoAssetInput) {
  const admin = await verifyAdmin();

  if (!data.symbol?.trim() || !data.name?.trim()) {
    return { success: false, error: "Asset Symbol and Name are required." };
  }

  const symbol = data.symbol.trim().toUpperCase();
  const existing = await prisma.cryptoAsset.findUnique({ where: { symbol } });
  if (existing) {
    return { success: false, error: `Crypto Asset '${symbol}' already exists.` };
  }

  const created = await prisma.cryptoAsset.create({
    data: {
      symbol,
      name: data.name.trim(),
      iconUrl: data.iconUrl?.trim() || null,
      description: data.description?.trim() || null,
      networks: JSON.stringify(data.networks || []),
      decimals: typeof data.decimals === "number" ? data.decimals : 8,
      isActive: data.isActive !== undefined ? data.isActive : true,
      canDeposit: data.canDeposit !== undefined ? data.canDeposit : true,
      canWithdraw: data.canWithdraw !== undefined ? data.canWithdraw : true,
      canP2p: data.canP2p !== undefined ? data.canP2p : true,
      displayOrder: typeof data.displayOrder === "number" ? data.displayOrder : 0,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CREATE_CRYPTO_ASSET",
      targetType: "CRYPTO_ASSET",
      targetId: created.id,
      details: `Created crypto asset '${created.name}' (${created.symbol})`,
    },
  });

  safeRevalidate("/admin/assets/crypto");
  safeRevalidate("/p2p");
  safeRevalidate("/p2p/post-ad");
  safeRevalidate("/assets");
  return { success: true, data: created };
}

export async function updateAdminCryptoAsset(id: string, data: Partial<CryptoAssetInput>) {
  const admin = await verifyAdmin();

  const existing = await prisma.cryptoAsset.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Crypto asset not found." };

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.iconUrl !== undefined) updateData.iconUrl = data.iconUrl?.trim() || null;
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.networks !== undefined) updateData.networks = JSON.stringify(data.networks);
  if (data.decimals !== undefined) updateData.decimals = data.decimals;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.canDeposit !== undefined) updateData.canDeposit = data.canDeposit;
  if (data.canWithdraw !== undefined) updateData.canWithdraw = data.canWithdraw;
  if (data.canP2p !== undefined) updateData.canP2p = data.canP2p;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

  const updated = await prisma.cryptoAsset.update({
    where: { id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "UPDATE_CRYPTO_ASSET",
      targetType: "CRYPTO_ASSET",
      targetId: id,
      details: `Updated crypto asset '${updated.name}' (${updated.symbol})`,
    },
  });

  safeRevalidate("/admin/assets/crypto");
  safeRevalidate("/p2p");
  safeRevalidate("/p2p/post-ad");
  safeRevalidate("/assets");
  return { success: true, data: updated };
}

export async function toggleAdminCryptoAsset(
  id: string,
  field: "isActive" | "canDeposit" | "canWithdraw" | "canP2p",
  value: boolean
) {
  const admin = await verifyAdmin();

  const existing = await prisma.cryptoAsset.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Crypto asset not found." };

  const updated = await prisma.cryptoAsset.update({
    where: { id },
    data: { [field]: value },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "TOGGLE_CRYPTO_ASSET",
      targetType: "CRYPTO_ASSET",
      targetId: id,
      details: `Updated '${existing.symbol}' ${field} to ${value}`,
    },
  });

  safeRevalidate("/admin/assets/crypto");
  safeRevalidate("/p2p");
  safeRevalidate("/p2p/post-ad");
  safeRevalidate("/assets");
  return { success: true, data: updated };
}

export async function deleteAdminCryptoAsset(id: string) {
  const admin = await verifyAdmin();

  const existing = await prisma.cryptoAsset.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Crypto asset not found." };

  // Safety checks: check if used in active P2pAds or funded Wallets
  const [activeAdsCount, walletsCount] = await Promise.all([
    prisma.p2pAd.count({ where: { asset: existing.symbol, status: { in: ["ACTIVE", "PAUSED"] } } }),
    prisma.wallet.count({ where: { asset: existing.symbol, balance: { gt: 0 } } }),
  ]);

  if (activeAdsCount > 0 || walletsCount > 0) {
    return {
      success: false,
      error: `Cannot hard-delete '${existing.symbol}': It is currently used in ${activeAdsCount} active P2P ad(s) and ${walletsCount} funded user wallet(s). Deactivate or disable P2P trading for this asset instead to preserve database integrity.`,
    };
  }

  await prisma.cryptoAsset.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "DELETE_CRYPTO_ASSET",
      targetType: "CRYPTO_ASSET",
      targetId: id,
      details: `Deleted crypto asset '${existing.name}' (${existing.symbol})`,
    },
  });

  safeRevalidate("/admin/assets/crypto");
  safeRevalidate("/p2p");
  safeRevalidate("/p2p/post-ad");
  safeRevalidate("/assets");
  return { success: true };
}

// =============================================================
// 15. Fiat Currencies Management (Admin)
// =============================================================

export interface FiatCurrencyInput {
  code: string;
  name: string;
  symbol: string;
  country?: string;
  decimals?: number;
  isActive?: boolean;
  canP2p?: boolean;
  displayOrder?: number;
}

export async function getAdminFiatCurrencies(params?: { search?: string; status?: string }) {
  await verifyAdmin();
  try {
    const where: any = {};
    if (params?.status === "active") where.isActive = true;
    if (params?.status === "inactive") where.isActive = false;

    let currencies = await prisma.fiatCurrency.findMany({
      where,
      orderBy: { displayOrder: "asc" },
    });

    if (params?.search?.trim()) {
      const q = params.search.toLowerCase().trim();
      currencies = currencies.filter(
        (c: any) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.country && c.country.toLowerCase().includes(q))
      );
    }

    return { success: true, data: currencies };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to load fiat currencies" };
  }
}

export async function createAdminFiatCurrency(data: FiatCurrencyInput) {
  const admin = await verifyAdmin();

  if (!data.code?.trim() || !data.name?.trim() || !data.symbol?.trim()) {
    return { success: false, error: "Currency Code, Name and Symbol are required." };
  }

  const code = data.code.trim().toUpperCase();
  const existing = await prisma.fiatCurrency.findUnique({ where: { code } });
  if (existing) {
    return { success: false, error: `Fiat currency with code '${code}' already exists.` };
  }

  const created = await prisma.fiatCurrency.create({
    data: {
      code,
      name: data.name.trim(),
      symbol: data.symbol.trim(),
      country: data.country?.trim() || null,
      decimals: typeof data.decimals === "number" ? data.decimals : 2,
      isActive: data.isActive !== undefined ? data.isActive : true,
      canP2p: data.canP2p !== undefined ? data.canP2p : true,
      displayOrder: typeof data.displayOrder === "number" ? data.displayOrder : 0,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CREATE_FIAT_CURRENCY",
      targetType: "FIAT_CURRENCY",
      targetId: created.id,
      details: `Created fiat currency '${created.name}' (${created.code})`,
    },
  });

  safeRevalidate("/admin/assets/fiat");
  safeRevalidate("/p2p");
  safeRevalidate("/p2p/post-ad");
  return { success: true, data: created };
}

export async function updateAdminFiatCurrency(id: string, data: Partial<FiatCurrencyInput>) {
  const admin = await verifyAdmin();

  const existing = await prisma.fiatCurrency.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Fiat currency not found." };

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.symbol !== undefined) updateData.symbol = data.symbol.trim();
  if (data.country !== undefined) updateData.country = data.country?.trim() || null;
  if (data.decimals !== undefined) updateData.decimals = data.decimals;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.canP2p !== undefined) updateData.canP2p = data.canP2p;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

  const updated = await prisma.fiatCurrency.update({
    where: { id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "UPDATE_FIAT_CURRENCY",
      targetType: "FIAT_CURRENCY",
      targetId: id,
      details: `Updated fiat currency '${updated.name}' (${updated.code})`,
    },
  });

  safeRevalidate("/admin/assets/fiat");
  safeRevalidate("/p2p");
  safeRevalidate("/p2p/post-ad");
  return { success: true, data: updated };
}

export async function toggleAdminFiatCurrency(
  id: string,
  field: "isActive" | "canP2p",
  value: boolean
) {
  const admin = await verifyAdmin();

  const existing = await prisma.fiatCurrency.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Fiat currency not found." };

  const updated = await prisma.fiatCurrency.update({
    where: { id },
    data: { [field]: value },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "TOGGLE_FIAT_CURRENCY",
      targetType: "FIAT_CURRENCY",
      targetId: id,
      details: `Updated '${existing.code}' ${field} to ${value}`,
    },
  });

  safeRevalidate("/admin/assets/fiat");
  safeRevalidate("/p2p");
  safeRevalidate("/p2p/post-ad");
  return { success: true, data: updated };
}

export async function deleteAdminFiatCurrency(id: string) {
  const admin = await verifyAdmin();

  const existing = await prisma.fiatCurrency.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Fiat currency not found." };

  const activeAdsCount = await prisma.p2pAd.count({
    where: { fiat: existing.code, status: { in: ["ACTIVE", "PAUSED"] } },
  });

  if (activeAdsCount > 0) {
    return {
      success: false,
      error: `Cannot delete fiat currency '${existing.code}': It is referenced by ${activeAdsCount} active P2P advertisement(s). Please deactivate it instead so existing records and ads remain safe.`,
    };
  }

  await prisma.fiatCurrency.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "DELETE_FIAT_CURRENCY",
      targetType: "FIAT_CURRENCY",
      targetId: id,
      details: `Deleted fiat currency '${existing.name}' (${existing.code})`,
    },
  });

  safeRevalidate("/admin/assets/fiat");
  safeRevalidate("/p2p");
  safeRevalidate("/p2p/post-ad");
  return { success: true };
}

// ==========================================
// 14. ADMIN RELATIONSHIP MANAGER CRUD & DETAILS
// ==========================================

export async function getRmDetailsAdmin(rmId: string): Promise<{ success: boolean; rm?: any; error?: string }> {
  try {
    await verifyAdmin();

    const rm: any = await prisma.user.findUnique({
      where: { id: rmId },
      include: {
        rmProfile: true,
        rmManagedConnections: {
          include: {
            user: {
              select: {
                id: true,
                uid: true,
                name: true,
                email: true,
                status: true,
                wallets: { select: { asset: true, balance: true, type: true } },
              },
            },
          },
          orderBy: { requestedAt: "desc" },
        },
        contractsAsRm: {
          include: {
            user: { select: { id: true, uid: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        rmReviewsReceived: {
          include: {
            user: { select: { id: true, uid: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      } as any,
    });

    if (!rm) {
      return { success: false, error: "Relationship Manager not found." };
    }

    return {
      success: true,
      rm: {
        id: rm.id,
        uid: rm.uid,
        name: rm.name,
        email: rm.email,
        phone: rm.phone || rm.rmProfile?.phone,
        status: rm.status,
        rmProfile: rm.rmProfile,
        clients: rm.rmManagedConnections,
        contracts: rm.contractsAsRm,
        reviews: rm.rmReviewsReceived,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load RM details." };
  }
}

export async function adminResetRmPassword(rmId: string, newPassword: string) {
  try {
    const admin = await verifyAdmin();

    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, error: "New password must be at least 6 characters long." };
    }

    const rm = await prisma.user.findFirst({
      where: { id: rmId, role: "RM" },
    });
    if (!rm) {
      return { success: false, error: "Relationship Manager not found." };
    }

    const passwordHash = await hashPassword(newPassword.trim());
    await prisma.user.update({
      where: { id: rmId },
      data: { passwordHash },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "RESET_RM_PASSWORD",
        targetType: "USER",
        targetId: rmId,
        details: `Admin reset password for RM ${rm.email} (UID: ${rm.uid})`,
      },
    });

    return { success: true, message: `Password for ${rm.name || rm.email} updated successfully.` };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reset password." };
  }
}

export async function deleteRmAdmin(rmId: string) {
  try {
    const admin = await verifyAdmin();

    const rm: any = await prisma.user.findFirst({
      where: { id: rmId, role: "RM" },
      include: {
        _count: {
          select: {
            rmManagedConnections: { where: { status: "ACTIVE" } },
            contractsAsRm: { where: { status: "FULLY_SIGNED" } },
          },
        },
      },
    });

    if (!rm) {
      return { success: false, error: "Relationship Manager not found." };
    }

    if (rm._count.rmManagedConnections > 0) {
      return {
        success: false,
        error: `Cannot delete RM '${rm.name || rm.email}': This manager has ${rm._count.rmManagedConnections} active client(s). Please reassign their clients first using the 'Reassign Clients' tab, or change status to 'SUSPENDED'.`,
      };
    }

    // Soft delete / archive: set status to BANNED/SUSPENDED and role to USER so relationships remain safe
    await prisma.$transaction(async (tx: DBClient) => {
      await tx.user.update({
        where: { id: rmId },
        data: {
          status: "BANNED",
          role: "USER",
        },
      });

      await tx.rmProfile.updateMany({
        where: { userId: rmId },
        data: {
          status: "SUSPENDED",
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "DEACTIVATE_RM",
        targetType: "RM_PROFILE",
        targetId: rmId,
        details: `Deactivated RM ${rm.email} (UID: ${rm.uid}) and archived profile`,
      },
    });

    safeRevalidate("/admin/rm");
    safeRevalidate("/relationship-managers");
    return { success: true, message: `Relationship Manager ${rm.name || rm.email} has been deactivated and archived safely.` };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete RM." };
  }
}

// ==========================================
// 15. ADMIN USER PROFILE CRUD & RM ASSIGNMENT
// ==========================================

export async function getUserDetailsAdmin(userId: string): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    await verifyAdmin();

    const user: any = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: true,
        kyc: true,
        bankCards: true,
        cryptoWallets: true,
        rmClientConnections: {
          include: {
            rm: {
              select: {
                id: true,
                uid: true,
                name: true,
                email: true,
                rmProfile: { select: { rmCode: true, designation: true } },
              },
            },
          },
          orderBy: { requestedAt: "desc" },
        },
        rmReviewsGiven: {
          include: {
            rm: { select: { id: true, uid: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            orders: true,
            transactions: true,
            deposits: true,
            withdrawals: true,
          },
        },
      } as any,
    });

    if (!user) {
      return { success: false, error: "User not found." };
    }

    return { success: true, user };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load user details." };
  }
}

export interface UpdateUserProfileAdminInput {
  name?: string;
  phone?: string;
  status?: UserStatus;
  role?: UserRole;
  isKycVerified?: boolean;
}

export async function updateUserProfileAdmin(
  userId: string,
  data: UpdateUserProfileAdminInput
) {
  try {
    const admin = await verifyAdmin();

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      return { success: false, error: "User not found." };
    }

    // Role changes require SUPER_ADMIN check
    if (data.role && data.role !== existingUser.role && admin.role !== "SUPER_ADMIN") {
      return { success: false, error: "Access denied. Only Super Admin can change user roles." };
    }

    const updatePayload: any = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.phone !== undefined) updatePayload.phone = data.phone?.trim() || null;
    if (data.status) updatePayload.status = data.status;
    if (data.role) updatePayload.role = data.role;
    if (data.isKycVerified !== undefined) updatePayload.isKycVerified = Boolean(data.isKycVerified);

    await prisma.user.update({
      where: { id: userId },
      data: updatePayload,
    });

    // If upgraded to RM, ensure profile exists
    if (data.role === "RM") {
      const existingProfile = await prisma.rmProfile.findUnique({ where: { userId } });
      if (!existingProfile) {
        await prisma.rmProfile.create({
          data: {
            userId,
            rmCode: `RM-${existingUser.uid}`,
            designation: "Senior Crypto Wealth Relationship Manager",
            department: "Private Wealth & Institutional Trading",
            rating: 0,
            totalRatings: 0,
            experienceYears: 0,
          },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "UPDATE_USER_PROFILE",
        targetType: "USER",
        targetId: userId,
        details: `Admin updated profile for ${existingUser.email} (UID: ${existingUser.uid}): ${JSON.stringify(updatePayload)}`,
      },
    });

    safeRevalidate("/admin/users");
    return { success: true, message: "User profile updated successfully." };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update user profile." };
  }
}

export async function adminAssignRmToUser(userId: string, rmId: string) {
  try {
    const admin = await verifyAdmin();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "User not found." };

    const rm = await prisma.user.findFirst({
      where: { id: rmId, role: "RM" },
      include: { rmProfile: true },
    });
    if (!rm) return { success: false, error: "Selected Relationship Manager not found." };

    // Terminate existing active connections for this user with other RMs
    await prisma.rmConnection.updateMany({
      where: { userId, rmId: { not: rmId }, status: { in: ["ACTIVE", "REQUESTED", "ACCEPTED"] } },
      data: { status: "TERMINATED", terminatedAt: new Date(), reassignedFromRmId: rmId },
    });

    // Upsert connection with new RM
    await prisma.rmConnection.upsert({
      where: {
        userId_rmId: {
          userId,
          rmId,
        },
      },
      update: {
        status: "ACTIVE",
        activatedAt: new Date(),
        responseNotes: "Assigned by Administrator",
      },
      create: {
        userId,
        rmId,
        status: "ACTIVE",
        activatedAt: new Date(),
        requestMessage: "Administrative Assignment",
        responseNotes: "Assigned by Administrator",
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "ADMIN_ASSIGN_RM",
        targetType: "RM_CONNECTION",
        targetId: `${userId}-${rmId}`,
        details: `Assigned user ${user.email} (UID: ${user.uid}) to RM ${rm.name || rm.email} (${rm.rmProfile?.rmCode || rm.uid})`,
      },
    });

    safeRevalidate("/admin/users");
    safeRevalidate("/admin/rm");
    safeRevalidate("/relationship-managers");
    return { success: true, message: `Successfully assigned ${user.name || user.email} to RM ${rm.name || rm.email}.` };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to assign RM." };
  }
}

export async function adminRemoveRmFromUser(userId: string) {
  try {
    const admin = await verifyAdmin();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "User not found." };

    await prisma.rmConnection.updateMany({
      where: { userId, status: { in: ["ACTIVE", "REQUESTED", "ACCEPTED", "CONTRACT_PENDING"] } },
      data: { status: "TERMINATED", terminatedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "ADMIN_REMOVE_RM",
        targetType: "RM_CONNECTION",
        targetId: userId,
        details: `Removed RM assignment for user ${user.email} (UID: ${user.uid})`,
      },
    });

    safeRevalidate("/admin/users");
    safeRevalidate("/admin/rm");
    return { success: true, message: "RM assignment removed successfully." };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to remove RM assignment." };
  }
}

export async function adminResetUserPin(userId: string) {
  try {
    const admin = await verifyAdmin();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "User not found." };

    await prisma.user.update({
      where: { id: userId },
      data: { transactionPin: "123456" },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "RESET_TRANSACTION_PIN",
        targetType: "USER",
        targetId: userId,
        details: `Reset transaction PIN for ${user.email} (UID: ${user.uid}) to default (123456)`,
      },
    });

    return { success: true, message: "Transaction PIN reset to default (123456)." };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reset PIN." };
  }
}

// ==========================================
// 16. ADMIN RATINGS & REVIEWS CRUD
// ==========================================

async function recalculateRmStatsAdmin(rmId: string) {
  try {
    const reviews = await prisma.rmReview.findMany({
      where: { rmId, status: "APPROVED" },
      select: { rating: true },
    });
    const totalRatings = reviews.length;
    const avgRating =
      totalRatings > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalRatings) * 10) / 10
        : 0;

    await prisma.rmProfile.updateMany({
      where: { userId: rmId },
      data: {
        rating: avgRating,
        totalRatings,
      },
    });

    safeRevalidate("/relationship-managers");
    safeRevalidate("/admin/rm");
  } catch (err) {
    console.error("recalculateRmStatsAdmin error:", err);
  }
}

export async function getAllRmReviewsAdmin(filters?: {
  rmId?: string;
  rating?: number;
  search?: string;
}) {
  try {
    await verifyAdmin();

    const where: any = {};
    if (filters?.rmId && filters.rmId !== "ALL") {
      where.rmId = filters.rmId;
    }
    if (filters?.rating && filters.rating > 0) {
      where.rating = filters.rating;
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      where.OR = [
        { comment: { contains: q } },
        { user: { name: { contains: q } } },
        { user: { email: { contains: q } } },
        { rm: { name: { contains: q } } },
        { rm: { email: { contains: q } } },
      ];
    }

    const reviews = await prisma.rmReview.findMany({
      where,
      include: {
        user: { select: { id: true, uid: true, name: true, email: true, avatarUrl: true } },
        rm: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            rmProfile: { select: { rmCode: true, designation: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, reviews };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load reviews.", reviews: [] };
  }
}

export async function createRmReviewAdmin(data: {
  userId: string;
  rmId: string;
  rating: number;
  comment?: string;
}) {
  try {
    const admin = await verifyAdmin();

    const cleanRating = Math.max(1, Math.min(5, Math.round(Number(data.rating))));
    const cleanComment = data.comment?.trim() || null;

    const review = await prisma.rmReview.upsert({
      where: {
        userId_rmId: {
          userId: data.userId,
          rmId: data.rmId,
        },
      },
      update: {
        rating: cleanRating,
        comment: cleanComment,
        status: "APPROVED",
        updatedAt: new Date(),
      },
      create: {
        userId: data.userId,
        rmId: data.rmId,
        rating: cleanRating,
        comment: cleanComment,
        status: "APPROVED",
      },
    });

    await recalculateRmStatsAdmin(data.rmId);

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "CREATE_RM_REVIEW",
        targetType: "RM_REVIEW",
        targetId: review.id,
        details: `Created review for RM ${data.rmId} by user ${data.userId} with rating ${cleanRating}`,
      },
    });

    return { success: true, message: "Review created successfully.", review };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create review." };
  }
}

export async function updateRmReviewAdmin(
  reviewId: string,
  data: {
    rating?: number;
    comment?: string;
    status?: "APPROVED" | "HIDDEN";
  }
) {
  try {
    const admin = await verifyAdmin();

    const existing = await prisma.rmReview.findUnique({ where: { id: reviewId } });
    if (!existing) return { success: false, error: "Review not found." };

    const updateData: any = {};
    if (data.rating !== undefined) {
      updateData.rating = Math.max(1, Math.min(5, Math.round(Number(data.rating))));
    }
    if (data.comment !== undefined) {
      updateData.comment = data.comment.trim() || null;
    }
    if (data.status) {
      updateData.status = data.status;
    }

    const updated = await prisma.rmReview.update({
      where: { id: reviewId },
      data: updateData,
    });

    await recalculateRmStatsAdmin(existing.rmId);

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "UPDATE_RM_REVIEW",
        targetType: "RM_REVIEW",
        targetId: reviewId,
        details: `Updated review ${reviewId}: Rating ${updated.rating}, Status ${updated.status}`,
      },
    });

    return { success: true, message: "Review updated successfully.", review: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update review." };
  }
}

export async function deleteRmReviewAdmin(reviewId: string) {
  try {
    const admin = await verifyAdmin();

    const existing = await prisma.rmReview.findUnique({ where: { id: reviewId } });
    if (!existing) return { success: false, error: "Review not found." };

    await prisma.rmReview.delete({ where: { id: reviewId } });

    await recalculateRmStatsAdmin(existing.rmId);

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "DELETE_RM_REVIEW",
        targetType: "RM_REVIEW",
        targetId: reviewId,
        details: `Deleted review ${reviewId} for RM ID ${existing.rmId}`,
      },
    });

    return { success: true, message: "Review deleted and statistics recalculated." };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete review." };
  }
}


