"use server";

import prisma, { DBClient, DBWallet } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  sendDepositNotification,
  sendWithdrawalNotification,
  sendAdminEventNotification,
  sendKycSubmissionConfirmation,
} from "@/lib/email";
import { reconcileExpiredOptions } from "@/actions/trade";
import { validateCryptoAddress } from "@/lib/crypto-validation";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Outside Next.js context
  }
}

// Helper to resolve user strictly from authenticated session with authorization checks
async function resolveUser(requestedUserId?: string) {
  const currentUser = await getCurrentUser();

  // CLI test mode bypass (strictly for test runner outside Next.js HTTP request scope with explicit requestedUserId)
  if (!currentUser && process.env.CLI_TEST_MODE === "true" && requestedUserId) {
    return prisma.user.findUnique({
      where: { id: requestedUserId },
      include: { wallets: true, kyc: true, bankCards: true, cryptoWallets: true } as any,
    });
  }

  if (!currentUser) {
    return null;
  }

  // If a specific userId is requested, only allow if it matches current user or caller is Admin
  if (requestedUserId && requestedUserId !== currentUser.id) {
    const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";
    if (!isAdmin) {
      return null;
    }
    return prisma.user.findUnique({
      where: { id: requestedUserId },
      include: { wallets: true, kyc: true, bankCards: true, cryptoWallets: true } as any,
    });
  }

  return currentUser;
}

// 1. KYC Application
export async function submitKycApplication(data: {
  userId?: string;
  documentType?: string; // PASSPORT, GOVERNMENT_ID, DRIVERS_LICENSE, RESIDENCE_PERMIT
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  country?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  issuingCountry?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  idNumber: string;
  address: string;
  idFrontUrl?: string;
  idBackUrl?: string;
}) {
  try {
    const user = await resolveUser(data.userId);
    if (!user) return { success: false, error: "Please log in first." };

    if (!data.idNumber?.trim() || !data.address?.trim()) {
      return { success: false, error: "Document ID Number and Address are required." };
    }

    if (!data.idFrontUrl) {
      return {
        success: false,
        error: "Please upload the primary document (front side or passport photo page).",
      };
    }

    // Front & Back required unless it's a Passport where back may not be required
    const docType = data.documentType || "GOVERNMENT_ID";
    if (docType !== "PASSPORT" && !data.idBackUrl) {
      return {
        success: false,
        error: "Please upload both front and back photos of your ID document.",
      };
    }

    if (data.fullName?.trim()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: data.fullName.trim() },
      });
    }

    // Check existing application to determine attempt count
    const existing = await prisma.kycApplication.findUnique({
      where: { userId: user.id },
    });
    const attemptCount = existing ? ((existing as any).attemptCount || 1) + 1 : 1;

    const application = await (prisma.kycApplication as any).upsert({
      where: { userId: user.id },
      update: {
        documentType: docType,
        fullName: data.fullName?.trim() || null,
        dateOfBirth: data.dateOfBirth?.trim() || null,
        gender: data.gender?.trim() || null,
        nationality: data.nationality?.trim() || null,
        country: data.country?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        postalCode: data.postalCode?.trim() || null,
        issuingCountry: data.issuingCountry?.trim() || null,
        issuingAuthority: data.issuingAuthority?.trim() || null,
        issueDate: data.issueDate?.trim() || null,
        expiryDate: data.expiryDate?.trim() || null,
        idNumber: data.idNumber.trim(),
        address: data.address.trim(),
        idFrontUrl: data.idFrontUrl,
        idBackUrl: data.idBackUrl || null,
        status: "PENDING",
        rejectionReason: null,
        additionalInfoRequired: null,
        attemptCount,
        reviewedBy: null,
        reviewedAt: null,
      },
      create: {
        userId: user.id,
        documentType: docType,
        fullName: data.fullName?.trim() || null,
        dateOfBirth: data.dateOfBirth?.trim() || null,
        gender: data.gender?.trim() || null,
        nationality: data.nationality?.trim() || null,
        country: data.country?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        postalCode: data.postalCode?.trim() || null,
        issuingCountry: data.issuingCountry?.trim() || null,
        issuingAuthority: data.issuingAuthority?.trim() || null,
        issueDate: data.issueDate?.trim() || null,
        expiryDate: data.expiryDate?.trim() || null,
        idNumber: data.idNumber.trim(),
        address: data.address.trim(),
        idFrontUrl: data.idFrontUrl,
        idBackUrl: data.idBackUrl || null,
        status: "PENDING",
        attemptCount: 1,
      },
    });

    safeRevalidate("/profile/kyc");
    safeRevalidate("/admin/kyc");

    // Dispatch both user confirmation and admin alert (awaited for Cloudflare Workers isolate)
    try {
      await Promise.allSettled([
        sendKycSubmissionConfirmation({
          email: user.email,
          name: user.name,
          uid: user.uid,
          documentType: docType,
          attemptCount,
        }),
        sendAdminEventNotification({
          eventType: "KYC",
          title: `KYC Submitted by ${user.email}`,
          message: `User ${user.email} (UID: #${user.uid}) submitted ${docType} documents (Attempt #${attemptCount}) for compliance review.`,
          details: {
            User: user.email,
            UID: user.uid,
            DocumentType: docType,
            IDNumber: data.idNumber.trim(),
            FullName: data.fullName?.trim() || "N/A",
            Country: data.country?.trim() || data.issuingCountry?.trim() || "N/A",
            Address: data.address.trim(),
          },
        }),
      ]);
    } catch (e) {
      console.warn("KYC notification dispatch error:", e);
    }

    return { success: true, data: application };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to submit KYC.";
    console.error("submitKycApplication error:", err);
    return { success: false, error: errorMsg };
  }
}

export interface KycDataRecord {
  id: string;
  userId: string;
  documentType: string;
  fullName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  issuingCountry?: string | null;
  issuingAuthority?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  idNumber: string;
  address: string;
  idFrontUrl?: string | null;
  idBackUrl?: string | null;
  status: string;
  rejectionReason?: string | null;
  additionalInfoRequired?: string | null;
  adminChecklist?: string | null;
  attemptCount: number;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getKycStatus(userId?: string): Promise<KycDataRecord | null> {
  const user = await resolveUser(userId);
  if (!user) return null;

  return (await prisma.kycApplication.findUnique({
    where: { userId: user.id },
  })) as any;
}

// 2. Deposit Request
export async function submitBankDeposit(data: {
  userId?: string;
  amount: number;
  bankName?: string;
  referenceNumber: string;
  proofUrl?: string;
}) {
  try {
    const user = await resolveUser(data.userId);
    if (!user) return { success: false, error: "Please log in first." };

    if (!data.amount || data.amount <= 0) {
      return { success: false, error: "Please enter a valid deposit amount." };
    }

    if (!data.referenceNumber) {
      return { success: false, error: "Transaction / UTR Reference number is required." };
    }

    const deposit = await prisma.$transaction(async (tx: DBClient) => {
      const dep = await tx.depositRequest.create({
        data: {
          userId: user.id,
          amount: data.amount,
          asset: "USDT",
          method: "BANK",
          bankName: data.bankName || "Axis Bank",
          referenceNumber: data.referenceNumber.trim(),
          proofUrl: data.proofUrl,
          status: "PENDING",
        },
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "Deposit",
          asset: "USDT",
          amount: data.amount,
          status: "Processing",
          description: `Bank Deposit Ref: ${data.referenceNumber}`,
        },
      });

      return dep;
    });

    safeRevalidate("/assets");
    safeRevalidate("/assets/records");
    safeRevalidate("/admin/deposits");
    return { success: true, data: deposit };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to submit deposit.";
    console.error("submitBankDeposit error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function submitDeposit(data: {
  userId?: string;
  amount: number;
  method: "BANK" | "CRYPTO";
  networkOrBank?: string;
  referenceNumber: string;
  proofUrl?: string;
}) {
  try {
    const user = await resolveUser(data.userId);
    if (!user) return { success: false, error: "Please log in first." };

    if (!data.amount || data.amount <= 0) {
      return { success: false, error: "Please enter a valid deposit amount." };
    }

    if (!data.referenceNumber || !data.referenceNumber.trim()) {
      return {
        success: false,
        error:
          data.method === "BANK"
            ? "Transaction / UTR Reference number is required."
            : "Transaction Hash (TXID) is required.",
      };
    }

    const deposit = await prisma.$transaction(async (tx: DBClient) => {
      const dep = await tx.depositRequest.create({
        data: {
          userId: user.id,
          amount: data.amount,
          asset: "USDT",
          method: data.method,
          bankName: data.networkOrBank || (data.method === "BANK" ? "Axis Bank" : "USDT"),
          referenceNumber: data.referenceNumber.trim(),
          proofUrl: data.proofUrl,
          status: "PENDING",
        },
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "Deposit",
          asset: "USDT",
          amount: data.amount,
          status: "Processing",
          description: `${data.method === "BANK" ? "Bank Deposit" : "Crypto Deposit"} (${data.networkOrBank || "USDT"}) Ref: ${data.referenceNumber.trim()}`,
        },
      });

      return dep;
    });

    safeRevalidate("/assets");
    safeRevalidate("/assets/records");
    safeRevalidate("/admin/deposits");

    // Send transactional notification to user & admin alert (awaited for Cloudflare Workers isolate)
    try {
      await Promise.allSettled([
        sendDepositNotification({
          email: user.email,
          amount: data.amount,
          asset: "USDT",
          status: "SUBMITTED",
          referenceNumber: data.referenceNumber.trim(),
        }),
        sendAdminEventNotification({
          eventType: "DEPOSIT",
          title: `Deposit Submitted: ${data.amount} USDT`,
          message: `User ${user.email} submitted a deposit of ${data.amount} USDT (Ref: ${data.referenceNumber.trim()}).`,
          details: { User: user.email, Amount: `${data.amount} USDT`, Ref: data.referenceNumber.trim() },
        }),
      ]);
    } catch (e) {
      console.warn("Notification dispatch error:", e);
    }

    return { success: true, data: deposit };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to submit deposit.";
    console.error("submitDeposit error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function getActivePaymentMethods() {
  try {
    return await prisma.paymentMethod.findMany({
      where: { enabled: true },
      orderBy: { displayOrder: "asc" },
    });
  } catch (err) {
    console.error("getActivePaymentMethods error:", err);
    return [];
  }
}


// 2.5 KYC Withdrawal Eligibility Check
export async function checkWithdrawalEligibility(userId?: string) {
  try {
    const user = await resolveUser(userId);
    if (!user) {
      return { eligible: false, error: "Please log in first.", kycStatus: "UNAUTHENTICATED" };
    }

    const kyc = await prisma.kycApplication.findUnique({
      where: { userId: user.id },
    });

    if (user.isKycVerified && kyc?.status === "APPROVED") {
      return {
        eligible: true,
        kycStatus: "APPROVED",
        isKycVerified: true,
      };
    }

    const status = kyc?.status || "NOT_SUBMITTED";
    return {
      eligible: false,
      kycStatus: status, // "PENDING", "REJECTED", "NOT_SUBMITTED"
      isKycVerified: false,
      rejectionReason: kyc?.rejectionReason || null,
      error: "KYC Verification Required — You must complete your KYC verification before withdrawing funds.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to verify KYC eligibility.";
    console.error("checkWithdrawalEligibility error:", err);
    return { eligible: false, error: errorMsg, kycStatus: "ERROR" };
  }
}

// 3. Withdrawal Request
export interface SubmitWithdrawalPayload {
  userId?: string;
  amount: number;
  fundPassword?: string;
  method?: "BANK" | "CRYPTO";
  methodId?: string;
  bankDetails?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    ifscCode?: string;
    branchName?: string;
    country?: string;
  };
  cryptoDetails?: {
    asset: string;
    network: string;
    address: string;
    label?: string;
    memo?: string;
  };
  // Legacy backward compatibility
  bankName?: string;
  accountNumber?: string;
  fullName?: string;
  asset?: string;
  userCryptoWalletId?: string;
}

export async function submitWithdrawal(data: SubmitWithdrawalPayload) {
  try {
    const user = await resolveUser(data.userId);
    if (!user) return { success: false, error: "Please log in first." };

    // 1. STRICT BACKEND KYC VERIFICATION CHECK
    const kyc = await prisma.kycApplication.findUnique({
      where: { userId: user.id },
    });

    if (!user.isKycVerified || kyc?.status !== "APPROVED") {
      const status = kyc?.status || "NOT_SUBMITTED";
      return {
        success: false,
        error: "KYC Verification Required — You must complete your KYC verification before withdrawing funds.",
        kycStatus: status,
        rejectionReason: kyc?.rejectionReason || null,
      };
    }

    // 2. Validate Amount
    if (!data.amount || data.amount <= 0) {
      return { success: false, error: "Please enter a valid withdrawal amount." };
    }

    if (data.amount < 10) {
      return { success: false, error: "Minimum withdrawal amount is 10.00 USDT." };
    }

    // 3. Verify Fund Password / Transaction Pin
    if (user.transactionPin && user.transactionPin !== data.fundPassword) {
      return { success: false, error: "Incorrect fund password / PIN." };
    }

    // 4. Daily Limit Check (Max 3 withdrawals per calendar day)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayWithdrawalsCount = await prisma.withdrawalRequest.count({
      where: {
        userId: user.id,
        createdAt: { gte: todayStart },
      },
    });

    if (todayWithdrawalsCount >= 3) {
      return {
        success: false,
        error: "Daily withdrawal limit reached. Maximum 3 withdrawal applications per day.",
      };
    }

    // 5. Balance Check
    const usdtWallet: any = (user.wallets as any[]).find((w: any) => w.asset === "USDT" && w.type === "Currency");
    const availableBalance = Number(usdtWallet?.balance ?? 0);
    if (!usdtWallet || availableBalance < data.amount) {
      return {
        success: false,
        error: `Insufficient balance. Available: ${availableBalance.toFixed(4)} USDT`,
      };
    }

    const method = data.method || (data.cryptoDetails ? "CRYPTO" : "BANK");
    let methodSnapshot: any = null;
    let bankName: string | null = null;
    let accountNumber: string | null = null;
    let accountHolder: string | null = null;
    let ifscCode: string | null = null;
    let branchName: string | null = null;
    let country: string | null = null;

    let network: string | null = null;
    let walletAddress: string | null = null;
    let walletLabel: string | null = null;
    let memo: string | null = null;
    let targetAsset = "USDT";

    if (method === "CRYPTO") {
      let targetWallet: any = null;
      const targetMethodId = data.methodId || data.userCryptoWalletId;
      if (targetMethodId) {
        targetWallet = await (prisma as any).userCryptoWallet.findFirst({
          where: { id: targetMethodId, userId: user.id },
        });
      }

      if (!targetWallet && data.cryptoDetails) {
        targetWallet = data.cryptoDetails;
      }

      if (!targetWallet) {
        targetWallet = await (prisma as any).userCryptoWallet.findFirst({
          where: { userId: user.id, isPrimary: true },
        }) || await (prisma as any).userCryptoWallet.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!targetWallet || !targetWallet.address || !targetWallet.network) {
        return { success: false, error: "Please select or save a valid crypto withdrawal wallet." };
      }

      const validation = validateCryptoAddress(
        targetWallet.asset || "USDT",
        targetWallet.network,
        targetWallet.address
      );
      if (!validation.valid) {
        return { success: false, error: validation.error || "Invalid crypto wallet address." };
      }

      targetAsset = targetWallet.asset || "USDT";
      network = targetWallet.network;
      walletAddress = targetWallet.address.trim();
      walletLabel = targetWallet.label?.trim() || `${network} Wallet`;
      memo = targetWallet.memo?.trim() || null;

      methodSnapshot = {
        method: "CRYPTO",
        asset: targetAsset,
        network,
        address: walletAddress,
        label: walletLabel,
        memo: memo || "",
        capturedAt: new Date().toISOString(),
      };
    } else {
      // BANK Withdrawal
      let targetBank: any = null;
      if (data.methodId) {
        targetBank = await prisma.bankCard.findFirst({
          where: { id: data.methodId, userId: user.id },
        });
      }

      if (!targetBank && data.bankDetails) {
        targetBank = data.bankDetails;
      }

      if (!targetBank) {
        targetBank = await (prisma as any).bankCard.findFirst({
          where: { userId: user.id, isPrimary: true },
        }) || await prisma.bankCard.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!targetBank && data.bankName && (data.accountNumber || data.fullName)) {
        targetBank = {
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          accountHolder: data.fullName,
        };
      }

      if (!targetBank || (!targetBank.accountNumber && !targetBank.iban)) {
        return { success: false, error: "Please link or select a bank account before withdrawing." };
      }

      bankName = targetBank.bankName?.trim() || "Bank Account";
      accountNumber = (targetBank.accountNumber || targetBank.iban || "").trim();
      accountHolder = (targetBank.accountHolder || targetBank.fullName || user.name || "User").trim();
      ifscCode = (targetBank.ifscCode || targetBank.swiftCode || "").trim() || null;
      branchName = targetBank.branchName?.trim() || null;
      country = targetBank.country?.trim() || "India";

      const accNumSafe = accountNumber || "";
      methodSnapshot = {
        method: "BANK",
        bankName,
        accountNumber,
        maskedAccountNumber: accNumSafe.length > 4 ? `•••• •••• ${accNumSafe.slice(-4)}` : accNumSafe,
        accountHolder,
        ifscCode: ifscCode || "",
        branchName: branchName || "",
        country,
        capturedAt: new Date().toISOString(),
      };
    }

    const fee = 0.0;
    const receiveAmount = data.amount - fee;

    // Freeze amount from balance and create withdrawal request atomically
    const withdrawal = await prisma.$transaction(async (tx: DBClient) => {
      const freshWallet = await tx.wallet.findUnique({
        where: { id: usdtWallet.id },
      });
      if (!freshWallet || freshWallet.balance < data.amount) {
        throw new Error("Insufficient available balance for withdrawal.");
      }

      await tx.wallet.update({
        where: { id: usdtWallet.id },
        data: { balance: { decrement: data.amount } },
      });

      const wReq = await tx.withdrawalRequest.create({
        data: {
          userId: user.id,
          amount: data.amount,
          fee,
          receiveAmount,
          asset: targetAsset,
          method,
          bankName,
          accountNumber,
          accountHolder,
          fullName: accountHolder,
          ifscCode,
          branchName,
          country,
          network,
          walletAddress,
          walletLabel,
          memo,
          methodSnapshot: JSON.stringify(methodSnapshot),
          status: "PENDING",
        } as any,
      });

      const description = method === "CRYPTO"
        ? `Withdrawal to ${network} (${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)})`
        : `Withdrawal to ${bankName} (${accountNumber ? accountNumber.slice(-4) : "••••"})`;

      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "Withdraw",
          asset: targetAsset,
          amount: data.amount,
          fee,
          status: "Processing",
          description,
        },
      });

      return wReq;
    });

    safeRevalidate("/assets");
    safeRevalidate("/assets/withdraw");
    safeRevalidate("/assets/records");
    safeRevalidate("/admin/withdrawals");

    // Send transactional notification to user & admin alert (awaited for Cloudflare Workers isolate)
    try {
      await Promise.allSettled([
        sendWithdrawalNotification({
          email: user.email,
          amount: data.amount,
          asset: targetAsset,
          status: "SUBMITTED",
          receiveAmount,
        }),
        sendAdminEventNotification({
          eventType: "WITHDRAWAL",
          title: `Withdrawal Requested: ${data.amount} ${targetAsset} (${method})`,
          message: `User ${user.email} (UID: #${user.uid}) requested withdrawal of ${data.amount} ${targetAsset} via ${method}.`,
          details: {
            User: user.email,
            Amount: `${data.amount} ${targetAsset}`,
            Method: method,
            Destination: method === "CRYPTO" ? `${network}: ${walletAddress}` : `${bankName}: ${accountNumber}`,
          },
        }),
      ]);
    } catch (e) {
      console.warn("Notification dispatch error:", e);
    }

    return { success: true, data: withdrawal, receiveAmount, fee, methodSnapshot };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to process withdrawal.";
    console.error("submitWithdrawal error:", err);
    return { success: false, error: errorMsg };
  }
}

// 4. User Records (Deposits, Withdrawals & Transactions)
export async function getUserRecords(userId?: string) {
  const user = await resolveUser(userId);
  if (!user) return { deposits: [], withdrawals: [], transactions: [] };

  const [deposits, withdrawals, transactions] = await Promise.all([
    prisma.depositRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.withdrawalRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { deposits, withdrawals, transactions };
}

// 4.1 Asset Summary & Complete Balance Breakdown (Available, On Order, On Hold, Total)
export async function getUserAssetSummary(userId?: string) {
  try {
    const user = await resolveUser(userId);
    if (!user) return null;

    // Auto-reconcile any expired option orders before calculating balances
    await reconcileExpiredOptions(user.id);

    // Fetch user wallets, active orders, and pending withdrawals concurrently
    const [fullUser, activeOrders, pendingWithdrawals] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        include: { wallets: true },
      }),
      prisma.order.findMany({
        where: {
          userId: user.id,
          status: { in: ["Executed", "Awaiting", "Pending"] },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.withdrawalRequest.findMany({
        where: {
          userId: user.id,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!fullUser) return null;
    const wallets = fullUser.wallets || [];

    const getWalletBal = (asset: string, type: string = "Currency") => {
      const w = wallets.find((w: DBWallet) => w.asset === asset && w.type === type);
      return w ? w.balance : 0.0;
    };

    // 1. Calculate On Hold (Pending Withdrawals)
    let usdtOnHold = 0;
    let btcOnHold = 0;
    let ethOnHold = 0;
    for (const w of pendingWithdrawals) {
      if (w.asset === "USDT") usdtOnHold += w.amount;
      else if (w.asset === "BTC") btcOnHold += w.amount;
      else if (w.asset === "ETH") ethOnHold += w.amount;
    }

    // 2. Calculate On Order per category & asset
    let perpetualMargin = 0;
    let optionsInvested = 0;
    const btcOnOrder = 0;
    const ethOnOrder = 0;

    const perpetualPositions: Array<(typeof activeOrders)[0]> = [];
    const activeOptions: Array<(typeof activeOrders)[0]> = [];

    for (const ord of activeOrders) {
      if (ord.category === "Perpetual") {
        const orderMargin = ord.margin ?? ((ord.amount * ord.price) / (ord.leverage || 100));
        perpetualMargin += orderMargin;
        perpetualPositions.push(ord);
      } else if (ord.category === "Option") {
        const orderInvestment = ord.margin ?? ord.amount;
        optionsInvested += orderInvestment;
        activeOptions.push(ord);
      }
    }

    const totalUsdtOnOrder = perpetualMargin + optionsInvested;

    // 3. Liquid Balances (Available)
    const currencyUsdtAvail = getWalletBal("USDT", "Currency");
    const currencyBtcAvail = getWalletBal("BTC", "Currency");
    const currencyEthAvail = getWalletBal("ETH", "Currency");

    const contractUsdtAvail = getWalletBal("USDT", "Contract");
    const optionsUsdtAvail = getWalletBal("USDT", "Options");

    // Benchmark live prices
    const btcPrice = 83014.31;
    const ethPrice = 2501.91;
    const usdtPrice = 1.0;

    // 4. Totals = Available + On Order + On Hold (including any active P2P escrow)
    const currencyUsdtEscrow = (wallets.find((w: any) => w.asset === "USDT" && w.type === "Currency") as any)?.escrowBalance ?? 0;
    const btcTotal = currencyBtcAvail + btcOnOrder + btcOnHold;
    const ethTotal = currencyEthAvail + ethOnOrder + ethOnHold;
    const usdtTotal = currencyUsdtAvail + totalUsdtOnOrder + usdtOnHold + currencyUsdtEscrow;

    const btcValueUsd = btcTotal * btcPrice;
    const ethValueUsd = ethTotal * ethPrice;
    const usdtValueUsd = usdtTotal * usdtPrice;

    const totalPortfolioUsd = usdtValueUsd + btcValueUsd + ethValueUsd;
    const totalPortfolioUsdt = totalPortfolioUsd;

    // Funding (P2P) balances
    const p2pUsdtWallet = wallets.find((w: any) => w.asset === "USDT" && w.type === "P2P");
    const p2pAvailable = p2pUsdtWallet?.balance ?? 0;
    const p2pEscrow = (p2pUsdtWallet?.escrowBalance ?? 0) + currencyUsdtEscrow;
    const p2pTotal = p2pAvailable + p2pEscrow;

    return {
      uid: fullUser.uid,
      email: fullUser.email,
      totalAssetsUsdt: totalPortfolioUsdt,
      totalAssetsUsd: totalPortfolioUsd,
      summary: {
        availableUsdt: currencyUsdtAvail,
        onOrderUsdt: totalUsdtOnOrder,
        onHoldUsdt: usdtOnHold + currencyUsdtEscrow,
        totalUsdt: usdtTotal,
      },
      categories: {
        currency: {
          title: "Currency Account",
          totalUsd: totalPortfolioUsd,
          assets: [
            {
              name: "BTC",
              fullName: "Bitcoin",
              amount: btcTotal.toFixed(8),
              available: currencyBtcAvail.toFixed(8),
              orders: btcOnOrder.toFixed(8),
              onHold: btcOnHold.toFixed(8),
              value: `$${btcValueUsd.toFixed(2)} USD`,
              rawAmount: btcTotal,
              rawAvailable: currencyBtcAvail,
              rawOrders: btcOnOrder,
              rawOnHold: btcOnHold,
              color: "#F7931A",
            },
            {
              name: "ETH",
              fullName: "Ethereum",
              amount: ethTotal.toFixed(8),
              available: currencyEthAvail.toFixed(8),
              orders: ethOnOrder.toFixed(8),
              onHold: ethOnHold.toFixed(8),
              value: `$${ethValueUsd.toFixed(2)} USD`,
              rawAmount: ethTotal,
              rawAvailable: currencyEthAvail,
              rawOrders: ethOnOrder,
              rawOnHold: ethOnHold,
              color: "#627EEA",
            },
            {
              name: "USDT",
              fullName: "TetherUS",
              amount: usdtTotal.toFixed(4),
              available: currencyUsdtAvail.toFixed(4),
              orders: totalUsdtOnOrder.toFixed(4),
              onHold: (usdtOnHold + currencyUsdtEscrow).toFixed(4),
              value: `$${usdtValueUsd.toFixed(2)} USD`,
              rawAmount: usdtTotal,
              rawAvailable: currencyUsdtAvail,
              rawOrders: totalUsdtOnOrder,
              rawOnHold: usdtOnHold + currencyUsdtEscrow,
              color: "#26A17B",
            },
          ],
        },
        contract: {
          title: "Contract Account",
          totalUsdtEquivalent: contractUsdtAvail + perpetualMargin,
          availableUsdt: contractUsdtAvail,
          marginOnOrders: perpetualMargin,
          openPositionsCount: perpetualPositions.length,
          openPositions: perpetualPositions,
        },
        options: {
          title: "Options Account",
          totalUsdtEquivalent: optionsUsdtAvail + optionsInvested,
          availableUsdt: optionsUsdtAvail,
          investedOnOrders: optionsInvested,
          activeOptionsCount: activeOptions.length,
          activeOptions: activeOptions,
        },
        funding: {
          title: "Funding (P2P) Account",
          totalUsdtEquivalent: p2pTotal,
          availableUsdt: p2pAvailable,
          escrowLockedUsdt: p2pEscrow,
          assets: [
            {
              name: "USDT",
              fullName: "TetherUS",
              available: p2pAvailable.toFixed(4),
              escrow: p2pEscrow.toFixed(4),
              total: p2pTotal.toFixed(4),
            },
          ],
        },
      },
    };
  } catch (err: unknown) {
    console.error("getUserAssetSummary error:", err);
    return null;
  }
}


// 5. Bank Account Management
export async function getUserBankAccounts(userId?: string) {
  try {
    const user = await resolveUser(userId);
    if (!user) return [];

    return await prisma.bankCard.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: "desc" } as any, { createdAt: "desc" }],
    });
  } catch (err) {
    console.error("getUserBankAccounts error:", err);
    return [];
  }
}

export async function saveBankAccount(
  data: {
    id?: string;
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    confirmAccountNumber?: string;
    ifscCode?: string;
    swiftCode?: string;
    branchName?: string;
    country?: string;
    isPrimary?: boolean;
    userId?: string;
  },
  userId?: string
) {
  try {
    const user = await resolveUser(data.userId || userId);
    if (!user) return { success: false, error: "Please log in first." };

    const bankName = data.bankName?.trim();
    const accountHolder = data.accountHolder?.trim();
    const accountNumber = data.accountNumber?.trim();

    if (!bankName || !accountHolder || !accountNumber) {
      return { success: false, error: "Bank name, account holder name, and account number are required." };
    }

    if (!data.id && data.confirmAccountNumber && accountNumber !== data.confirmAccountNumber.trim()) {
      return { success: false, error: "Account numbers do not match. Please verify and re-enter." };
    }

    if (accountNumber.length < 5) {
      return { success: false, error: "Please enter a valid account number." };
    }

    const existingCount = await prisma.bankCard.count({
      where: { userId: user.id },
    });

    const isFirst = existingCount === 0;
    const shouldBePrimary = data.isPrimary !== undefined ? data.isPrimary : isFirst;

    if (data.id) {
      const existing: any = await prisma.bankCard.findFirst({
        where: { id: data.id, userId: user.id },
      });
      if (!existing) {
        return { success: false, error: "Bank account not found or unauthorized." };
      }

      const updated = await prisma.$transaction(async (tx: DBClient) => {
        if (shouldBePrimary) {
          await tx.bankCard.updateMany({
            where: { userId: user.id },
            data: { isPrimary: false } as any,
          });
        }

        return tx.bankCard.update({
          where: { id: data.id },
          data: {
            bankName,
            accountHolder,
            accountNumber,
            fullName: accountHolder,
            iban: accountNumber,
            ifscCode: data.ifscCode?.trim() || null,
            swiftCode: data.swiftCode?.trim() || null,
            branchName: data.branchName?.trim() || null,
            country: data.country?.trim() || "India",
            isPrimary: shouldBePrimary,
          } as any,
        });
      });

      safeRevalidate("/assets/withdraw");
      safeRevalidate("/security/bank-card");
      return { success: true, data: updated };
    } else {
      const created = await prisma.$transaction(async (tx: DBClient) => {
        if (shouldBePrimary) {
          await tx.bankCard.updateMany({
            where: { userId: user.id },
            data: { isPrimary: false } as any,
          });
        }

        return tx.bankCard.create({
          data: {
            userId: user.id,
            bankName,
            accountHolder,
            accountNumber,
            fullName: accountHolder,
            iban: accountNumber,
            ifscCode: data.ifscCode?.trim() || null,
            swiftCode: data.swiftCode?.trim() || null,
            branchName: data.branchName?.trim() || null,
            country: data.country?.trim() || "India",
            isPrimary: shouldBePrimary,
            status: "ACTIVE",
          } as any,
        });
      });

      safeRevalidate("/assets/withdraw");
      safeRevalidate("/security/bank-card");
      return { success: true, data: created };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to save bank account.";
    console.error("saveBankAccount error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function setPrimaryBankAccount(accountId: string, userId?: string) {
  try {
    const user = await resolveUser(userId);
    if (!user) return { success: false, error: "Please log in first." };

    const card: any = await prisma.bankCard.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!card) return { success: false, error: "Bank account not found." };

    await prisma.$transaction(async (tx: DBClient) => {
      await tx.bankCard.updateMany({
        where: { userId: user.id },
        data: { isPrimary: false } as any,
      });
      await tx.bankCard.update({
        where: { id: accountId },
        data: { isPrimary: true } as any,
      });
    });

    safeRevalidate("/assets/withdraw");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to set primary bank account.";
    return { success: false, error: errorMsg };
  }
}

export async function deleteBankAccount(accountId: string, userId?: string) {
  try {
    const user = await resolveUser(userId);
    if (!user) return { success: false, error: "Please log in first." };

    const card: any = await prisma.bankCard.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!card) return { success: false, error: "Bank account not found." };

    await prisma.$transaction(async (tx: DBClient) => {
      await tx.bankCard.delete({
        where: { id: accountId },
      });

      if ((card as any)?.isPrimary) {
        const remaining: any = await tx.bankCard.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });
        if (remaining) {
          await tx.bankCard.update({
            where: { id: remaining.id },
            data: { isPrimary: true } as any,
          });
        }
      }
    });

    safeRevalidate("/assets/withdraw");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete bank account.";
    return { success: false, error: errorMsg };
  }
}

// Backward compatibility alias for legacy pages
export async function saveBankCard(cardData: any, userId?: string) {
  return saveBankAccount(
    {
      bankName: cardData.bankName,
      accountHolder: cardData.fullName || cardData.accountHolder,
      accountNumber: cardData.iban || cardData.accountNumber,
      swiftCode: cardData.swiftCode,
      branchName: cardData.bankAddress || cardData.branchName,
      isPrimary: true,
    },
    userId
  );
}

// 5.5 Crypto Wallet Management
export async function validateCryptoAddressAction(
  arg1: string,
  arg2: string,
  arg3?: string
): Promise<{ valid: boolean; error?: string }> {
  return validateCryptoAddress(arg1, arg2, arg3);
}

export async function getUserCryptoWallets(userId?: string) {
  try {
    const user = await resolveUser(userId);
    if (!user) return [];

    return await (prisma as any).userCryptoWallet.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: "desc" } as any, { createdAt: "desc" }],
    });
  } catch (err) {
    console.error("getUserCryptoWallets error:", err);
    return [];
  }
}

export async function saveCryptoWallet(
  data: {
    id?: string;
    asset: string;
    network: string;
    address: string;
    label: string;
    memo?: string;
    isPrimary?: boolean;
    userId?: string;
  },
  userId?: string
) {
  try {
    const user = await resolveUser(data.userId || userId);
    if (!user) return { success: false, error: "Please log in first." };

    const asset = (data.asset || "USDT").trim().toUpperCase();
    const network = data.network?.trim().toUpperCase();
    const address = data.address?.trim();
    const label = data.label?.trim() || `${asset}-${network} Wallet`;
    const memo = data.memo?.trim() || null;

    if (!asset || !network || !address) {
      return { success: false, error: "Cryptocurrency, blockchain network, and wallet address are required." };
    }

    const validation = validateCryptoAddress(asset, network, address);
    if (!validation.valid) {
      return { success: false, error: validation.error || "Invalid wallet address." };
    }

    const existingCount = await (prisma as any).userCryptoWallet.count({
      where: { userId: user.id },
    });

    const isFirst = existingCount === 0;
    const shouldBePrimary = data.isPrimary !== undefined ? data.isPrimary : isFirst;

    if (data.id) {
      const existing = await (prisma as any).userCryptoWallet.findFirst({
        where: { id: data.id, userId: user.id },
      });
      if (!existing) {
        return { success: false, error: "Crypto wallet not found or unauthorized." };
      }

      const updated = await prisma.$transaction(async (tx: DBClient) => {
        if (shouldBePrimary) {
          await tx.userCryptoWallet.updateMany({
            where: { userId: user.id },
            data: { isPrimary: false },
          });
        }

        return tx.userCryptoWallet.update({
          where: { id: data.id },
          data: {
            asset,
            network,
            address,
            label,
            memo,
            isPrimary: shouldBePrimary,
          },
        });
      });

      safeRevalidate("/assets/withdraw");
      return { success: true, data: updated };
    } else {
      const created = await prisma.$transaction(async (tx: DBClient) => {
        if (shouldBePrimary) {
          await tx.userCryptoWallet.updateMany({
            where: { userId: user.id },
            data: { isPrimary: false },
          });
        }

        return tx.userCryptoWallet.create({
          data: {
            userId: user.id,
            asset,
            network,
            address,
            label,
            memo,
            isPrimary: shouldBePrimary,
            status: "ACTIVE",
          },
        });
      });

      safeRevalidate("/assets/withdraw");
      return { success: true, data: created };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to save crypto wallet.";
    console.error("saveCryptoWallet error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function setPrimaryCryptoWallet(walletId: string, userId?: string) {
  try {
    const user = await resolveUser(userId);
    if (!user) return { success: false, error: "Please log in first." };

    const wallet = await (prisma as any).userCryptoWallet.findFirst({
      where: { id: walletId, userId: user.id },
    });
    if (!wallet) return { success: false, error: "Crypto wallet not found." };

    await prisma.$transaction(async (tx: DBClient) => {
      await tx.userCryptoWallet.updateMany({
        where: { userId: user.id },
        data: { isPrimary: false },
      });
      await tx.userCryptoWallet.update({
        where: { id: walletId },
        data: { isPrimary: true },
      });
    });

    safeRevalidate("/assets/withdraw");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to set primary crypto wallet.";
    return { success: false, error: errorMsg };
  }
}

export async function deleteCryptoWallet(walletId: string, userId?: string) {
  try {
    const user = await resolveUser(userId);
    if (!user) return { success: false, error: "Please log in first." };

    const wallet = await (prisma as any).userCryptoWallet.findFirst({
      where: { id: walletId, userId: user.id },
    });
    if (!wallet) return { success: false, error: "Crypto wallet not found." };

    await prisma.$transaction(async (tx: DBClient) => {
      await tx.userCryptoWallet.delete({
        where: { id: walletId },
      });

      if (wallet.isPrimary) {
        const remaining = await tx.userCryptoWallet.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });
        if (remaining) {
          await tx.userCryptoWallet.update({
            where: { id: remaining.id },
            data: { isPrimary: true },
          });
        }
      }
    });

    safeRevalidate("/assets/withdraw");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete crypto wallet.";
    return { success: false, error: errorMsg };
  }
}

// 6. Fund Password / Transaction Pin
export async function updateFundPassword(newPin: string, userId?: string) {
  try {
    const user = await resolveUser(userId);
    if (!user) return { success: false, error: "Please log in first." };

    if (!newPin || newPin.length < 4 || newPin.length > 8) {
      return { success: false, error: "PIN must be between 4 and 8 digits." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { transactionPin: newPin.trim() },
    });

    safeRevalidate("/security/password");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update fund password.";
    console.error("updateFundPassword error:", err);
    return { success: false, error: errorMsg };
  }
}

// 7. Profile Information Management
export async function updateUserProfile(data: {
  name?: string;
  phone?: string;
  avatarUrl?: string;
  userId?: string;
}) {
  try {
    const user = await resolveUser(data.userId);
    if (!user) return { success: false, error: "Please log in first." };

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.phone !== undefined && { phone: data.phone.trim() }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl.trim() }),
      },
    });

    safeRevalidate("/profile");
    safeRevalidate("/account");
    safeRevalidate("/assets");
    return { success: true, user: updated };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update profile.";
    console.error("updateUserProfile error:", err);
    return { success: false, error: errorMsg };
  }
}

// 8. Full User Profile Fetch
export async function getUserProfile(userId?: string) {
  const user = await resolveUser(userId);
  if (!user) return null;

  return prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      uid: true,
      email: true,
      name: true,
      phone: true,
      avatarUrl: true,
      role: true,
      status: true,
      isKycVerified: true,
      createdAt: true,
      kyc: true,
      bankCards: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      },
      cryptoWallets: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      },
      wallets: true,
    },
  });
}
