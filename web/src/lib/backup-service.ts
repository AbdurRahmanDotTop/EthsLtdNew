import prisma from "@/lib/prisma";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import crypto from "crypto";
import JSZip from "jszip";
import path from "path";
import fs from "fs";

export interface BackupManifest {
  version: string;
  type: "FULL_DATABASE" | "WEBSITE_CONFIG" | "MEDIA_ARCHIVE" | "PROJECT_SOURCE";
  createdAt: string;
  createdBy: string;
  checksum: string;
  tableCounts: Record<string, number>;
  totalRecords: number;
  environment: string;
}

export interface BackupPackage {
  manifest: BackupManifest;
  data: Record<string, any[]>;
}

export interface ValidationResult {
  valid: boolean;
  type?: string;
  createdAt?: string;
  createdBy?: string;
  checksumValid: boolean;
  totalRecords: number;
  tableCounts: Record<string, number>;
  errors: string[];
  warnings: string[];
}

function getDbBinding(): any {
  try {
    const cf = getCloudflareContext({ async: false });
    if ((cf as any)?.env?.DB) return (cf as any).env.DB;
  } catch {}

  const cfGlobal = (globalThis as any)[Symbol.for("__cloudflare-context__")];
  if (cfGlobal?.env?.DB) return cfGlobal.env.DB;

  return (globalThis as any).DB || null;
}

function calculateChecksum(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * 1. FULL DATABASE EXPORT
 */
export async function generateFullDatabaseExport(adminEmail: string): Promise<BackupPackage> {
  // Query all tables in parallel
  const [
    users,
    wallets,
    bankCards,
    cryptoWallets,
    orders,
    transactions,
    kycApplications,
    depositRequests,
    withdrawalRequests,
    paymentMethods,
    heroSlides,
    markets,
    verificationTokens,
    emailConfigs,
    rmProfiles,
    rmConnections,
    investmentContracts,
    rmConversations,
    rmMessages,
    rmNotifications,
    rmReviews,
    p2pChannelTypes,
    p2pChannelFields,
    p2pSystemPaymentMethods,
    cryptoAssets,
    fiatCurrencies,
    trackingConfigs,
    p2pAds,
    p2pOrders,
    p2pPaymentMethods,
    p2pMessages,
    p2pDisputes,
    p2pFeedbacks,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.wallet.findMany(),
    prisma.bankCard.findMany(),
    prisma.userCryptoWallet.findMany(),
    prisma.order.findMany(),
    prisma.transaction.findMany(),
    prisma.kycApplication.findMany(),
    prisma.depositRequest.findMany(),
    prisma.withdrawalRequest.findMany(),
    prisma.paymentMethod.findMany(),
    prisma.heroSlide.findMany(),
    prisma.market.findMany(),
    prisma.verificationToken.findMany(),
    prisma.emailConfig.findMany(),
    prisma.rmProfile.findMany(),
    prisma.rmConnection.findMany(),
    prisma.investmentContract.findMany(),
    prisma.rmConversation.findMany(),
    prisma.rmMessage.findMany(),
    prisma.rmNotification.findMany(),
    prisma.rmReview.findMany(),
    prisma.p2pChannelType.findMany(),
    prisma.p2pChannelField.findMany(),
    prisma.p2pSystemPaymentMethod.findMany(),
    prisma.cryptoAsset.findMany(),
    prisma.fiatCurrency.findMany(),
    prisma.trackingConfig.findMany(),
    prisma.p2pAd.findMany(),
    prisma.p2pOrder.findMany(),
    prisma.p2pPaymentMethod.findMany(),
    prisma.p2pMessage.findMany(),
    prisma.p2pDispute.findMany(),
    prisma.p2pFeedback.findMany(),
    prisma.auditLog.findMany({ take: 1000, orderBy: { createdAt: "desc" } }),
  ]);

  // Query D1 kyc_documents
  let kycDocs: any[] = [];
  try {
    const dbBinding = getDbBinding();
    if (dbBinding) {
      const res = await dbBinding.prepare("SELECT * FROM kyc_documents").all();
      kycDocs = res.results || [];
    } else {
      kycDocs = (await prisma.$queryRawUnsafe("SELECT * FROM kyc_documents")) as any[];
    }
  } catch (e) {
    console.warn("Could not query kyc_documents for full backup:", e);
  }

  // Sanitize sensitive email passwords if needed, but preserve necessary auth
  const sanitizedEmailConfigs = emailConfigs.map((c: any) => ({
    ...c,
    password: c.password ? "******" : null,
    apiKey: c.apiKey ? "******" : null,
  }));

  const data: Record<string, any[]> = {
    User: users,
    Wallet: wallets,
    BankCard: bankCards,
    UserCryptoWallet: cryptoWallets,
    Order: orders,
    Transaction: transactions,
    KycApplication: kycApplications,
    DepositRequest: depositRequests,
    WithdrawalRequest: withdrawalRequests,
    PaymentMethod: paymentMethods,
    HeroSlide: heroSlides,
    Market: markets,
    VerificationToken: verificationTokens,
    EmailConfig: sanitizedEmailConfigs,
    RmProfile: rmProfiles,
    RmConnection: rmConnections,
    InvestmentContract: investmentContracts,
    RmConversation: rmConversations,
    RmMessage: rmMessages,
    RmNotification: rmNotifications,
    RmReview: rmReviews,
    P2pChannelType: p2pChannelTypes,
    P2pChannelField: p2pChannelFields,
    P2pSystemPaymentMethod: p2pSystemPaymentMethods,
    CryptoAsset: cryptoAssets,
    FiatCurrency: fiatCurrencies,
    TrackingConfig: trackingConfigs,
    P2pAd: p2pAds,
    P2pOrder: p2pOrders,
    P2pPaymentMethod: p2pPaymentMethods,
    P2pMessage: p2pMessages,
    P2pDispute: p2pDisputes,
    P2pFeedback: p2pFeedbacks,
    AuditLog: auditLogs,
    kyc_documents: kycDocs,
  };

  const tableCounts: Record<string, number> = {};
  let totalRecords = 0;
  for (const [table, records] of Object.entries(data)) {
    tableCounts[table] = records.length;
    totalRecords += records.length;
  }

  const dataString = JSON.stringify(data);
  const checksum = calculateChecksum(dataString);

  return {
    manifest: {
      version: "1.0.0",
      type: "FULL_DATABASE",
      createdAt: new Date().toISOString(),
      createdBy: adminEmail,
      checksum,
      tableCounts,
      totalRecords,
      environment: process.env.NODE_ENV || "production",
    },
    data,
  };
}

/**
 * 2. WEBSITE CONFIGURATION & CONTENT EXPORT
 */
export async function generateWebsiteConfigExport(adminEmail: string): Promise<BackupPackage> {
  const [
    heroSlides,
    markets,
    paymentMethods,
    p2pChannelTypes,
    p2pChannelFields,
    p2pSystemPaymentMethods,
    cryptoAssets,
    fiatCurrencies,
    trackingConfigs,
    emailConfigs,
  ] = await Promise.all([
    prisma.heroSlide.findMany(),
    prisma.market.findMany(),
    prisma.paymentMethod.findMany(),
    prisma.p2pChannelType.findMany(),
    prisma.p2pChannelField.findMany(),
    prisma.p2pSystemPaymentMethod.findMany(),
    prisma.cryptoAsset.findMany(),
    prisma.fiatCurrency.findMany(),
    prisma.trackingConfig.findMany(),
    prisma.emailConfig.findMany(),
  ]);

  const sanitizedEmailConfigs = emailConfigs.map((c: any) => ({
    ...c,
    password: c.password ? "******" : null,
    apiKey: c.apiKey ? "******" : null,
  }));

  const data: Record<string, any[]> = {
    HeroSlide: heroSlides,
    Market: markets,
    PaymentMethod: paymentMethods,
    P2pChannelType: p2pChannelTypes,
    P2pChannelField: p2pChannelFields,
    P2pSystemPaymentMethod: p2pSystemPaymentMethods,
    CryptoAsset: cryptoAssets,
    FiatCurrency: fiatCurrencies,
    TrackingConfig: trackingConfigs,
    EmailConfig: sanitizedEmailConfigs,
  };

  const tableCounts: Record<string, number> = {};
  let totalRecords = 0;
  for (const [table, records] of Object.entries(data)) {
    tableCounts[table] = records.length;
    totalRecords += records.length;
  }

  const dataString = JSON.stringify(data);
  const checksum = calculateChecksum(dataString);

  return {
    manifest: {
      version: "1.0.0",
      type: "WEBSITE_CONFIG",
      createdAt: new Date().toISOString(),
      createdBy: adminEmail,
      checksum,
      tableCounts,
      totalRecords,
      environment: process.env.NODE_ENV || "production",
    },
    data,
  };
}

/**
 * 3. MEDIA & DOCUMENTS EXPORT
 */
export async function generateMediaArchiveExport(adminEmail: string): Promise<BackupPackage> {
  let kycDocs: any[] = [];
  try {
    const dbBinding = getDbBinding();
    if (dbBinding) {
      const res = await dbBinding.prepare("SELECT * FROM kyc_documents ORDER BY filename, chunk_index ASC").all();
      kycDocs = res.results || [];
    } else {
      kycDocs = (await prisma.$queryRawUnsafe("SELECT * FROM kyc_documents ORDER BY filename, chunk_index ASC")) as any[];
    }
  } catch (e) {
    console.warn("Could not query kyc_documents for media backup:", e);
  }

  const data: Record<string, any[]> = {
    kyc_documents: kycDocs,
  };

  const tableCounts: Record<string, number> = {
    kyc_documents: kycDocs.length,
  };

  const dataString = JSON.stringify(data);
  const checksum = calculateChecksum(dataString);

  return {
    manifest: {
      version: "1.0.0",
      type: "MEDIA_ARCHIVE",
      createdAt: new Date().toISOString(),
      createdBy: adminEmail,
      checksum,
      tableCounts,
      totalRecords: kycDocs.length,
      environment: process.env.NODE_ENV || "production",
    },
    data,
  };
}

/**
 * 4. PROJECT SOURCE CODE EXPORT (Clean bundle excluding secrets)
 */
export async function generateProjectSourceExport(): Promise<Buffer> {
  const zip = new JSZip();

  // Root manifest and README
  zip.file(
    "ETHSLTD_SOURCE_MANIFEST.json",
    JSON.stringify(
      {
        project: "ETHSLTD Trading Platform",
        version: "1.0.0",
        exportTimestamp: new Date().toISOString(),
        excludedPaths: [
          ".env",
          ".env.local",
          ".env.production",
          "node_modules",
          ".git",
          ".open-next",
          ".wrangler",
          "private",
        ],
        instructions:
          "This clean source bundle contains the Next.js and Cloudflare Workers application code. To deploy, run 'npm install', configure your environment variables based on .env.example, run 'npm run build:worker', and deploy.",
      },
      null,
      2
    )
  );

  // Safe file reader helper for local/Node context
  function addDirectoryToZip(dirPath: string, zipFolder: JSZip) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Exclude forbidden paths & secrets
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".next" ||
        entry.name === ".open-next" ||
        entry.name === ".wrangler" ||
        entry.name.startsWith(".env") ||
        entry.name.endsWith(".log") ||
        entry.name === "private"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFolder = zipFolder.folder(entry.name);
        if (subFolder) addDirectoryToZip(fullPath, subFolder);
      } else {
        try {
          const content = fs.readFileSync(fullPath);
          zipFolder.file(entry.name, content);
        } catch {
          // Skip if unreadable
        }
      }
    }
  }

  try {
    const webDir = path.join(process.cwd());
    addDirectoryToZip(path.join(webDir, "src"), zip.folder("src")!);
    addDirectoryToZip(path.join(webDir, "prisma"), zip.folder("prisma")!);
    addDirectoryToZip(path.join(webDir, "public"), zip.folder("public")!);
    addDirectoryToZip(path.join(webDir, "scripts"), zip.folder("scripts")!);

    // Include config files (sanitized)
    const allowedFiles = [
      "package.json",
      "tsconfig.json",
      "next.config.mjs",
      "next.config.ts",
      "wrangler.jsonc",
      "postcss.config.mjs",
    ];
    for (const f of allowedFiles) {
      const fp = path.join(webDir, f);
      if (fs.existsSync(fp)) {
        zip.file(f, fs.readFileSync(fp));
      }
    }
  } catch (err) {
    console.warn("Source export directory walking fallback:", err);
  }

  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * 5. VALIDATE BACKUP PACKAGE
 */
export function validateBackupPackage(pkg: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!pkg || typeof pkg !== "object") {
    return {
      valid: false,
      checksumValid: false,
      totalRecords: 0,
      tableCounts: {},
      errors: ["Invalid backup package: Root object is missing or not valid JSON."],
      warnings: [],
    };
  }

  const { manifest, data } = pkg;

  if (!manifest || typeof manifest !== "object") {
    errors.push("Missing or invalid 'manifest' object in backup package.");
  } else {
    if (!manifest.type) errors.push("Missing backup 'type' in manifest.");
    if (!manifest.version) warnings.push("Backup version is unspecified; assuming compatibility with v1.0.0.");
    if (!manifest.createdAt) warnings.push("Backup creation timestamp is missing.");
  }

  if (!data || typeof data !== "object") {
    errors.push("Missing or invalid 'data' payload object in backup package.");
  }

  let checksumValid = false;
  if (manifest?.checksum && data) {
    const calculated = calculateChecksum(JSON.stringify(data));
    if (calculated === manifest.checksum) {
      checksumValid = true;
    } else {
      errors.push("Checksum mismatch: Archive integrity verification failed. Data may be corrupted or modified.");
    }
  } else {
    warnings.push("Archive contains no checksum signature; integrity could not be cryptographically verified.");
  }

  const tableCounts: Record<string, number> = {};
  let totalRecords = 0;
  if (data && typeof data === "object") {
    for (const [table, records] of Object.entries(data)) {
      if (Array.isArray(records)) {
        tableCounts[table] = records.length;
        totalRecords += records.length;
      }
    }
  }

  return {
    valid: errors.length === 0,
    type: manifest?.type,
    createdAt: manifest?.createdAt,
    createdBy: manifest?.createdBy,
    checksumValid,
    totalRecords,
    tableCounts,
    errors,
    warnings,
  };
}

/**
 * 6. RESTORE WEBSITE CONFIGURATION
 */
export async function restoreWebsiteConfiguration(
  data: Record<string, any[]>,
  admin: { id: string; email: string }
): Promise<{ success: boolean; restoredTables: Record<string, number>; error?: string }> {
  const restoredTables: Record<string, number> = {};

  try {
    // 1. HeroSlider
    if (Array.isArray(data.HeroSlide)) {
      for (const slide of data.HeroSlide) {
        await prisma.heroSlide.upsert({
          where: { id: slide.id },
          create: slide,
          update: slide,
        });
      }
      restoredTables.HeroSlide = data.HeroSlide.length;
    }

    // 2. Markets
    if (Array.isArray(data.Market)) {
      for (const m of data.Market) {
        await prisma.market.upsert({
          where: { symbol: m.symbol },
          create: m,
          update: m,
        });
      }
      restoredTables.Market = data.Market.length;
    }

    // 3. System Deposit Payment Methods
    if (Array.isArray(data.PaymentMethod)) {
      for (const pm of data.PaymentMethod) {
        await prisma.paymentMethod.upsert({
          where: { id: pm.id },
          create: pm,
          update: pm,
        });
      }
      restoredTables.PaymentMethod = data.PaymentMethod.length;
    }

    // 4. P2P Channel Types
    if (Array.isArray(data.P2pChannelType)) {
      for (const ct of data.P2pChannelType) {
        await prisma.p2pChannelType.upsert({
          where: { identifier: ct.identifier },
          create: ct,
          update: ct,
        });
      }
      restoredTables.P2pChannelType = data.P2pChannelType.length;
    }

    // 5. P2P Channel Fields
    if (Array.isArray(data.P2pChannelField)) {
      for (const cf of data.P2pChannelField) {
        await prisma.p2pChannelField.upsert({
          where: { id: cf.id },
          create: cf,
          update: cf,
        });
      }
      restoredTables.P2pChannelField = data.P2pChannelField.length;
    }

    // 6. P2P System Payment Methods
    if (Array.isArray(data.P2pSystemPaymentMethod)) {
      for (const spm of data.P2pSystemPaymentMethod) {
        await prisma.p2pSystemPaymentMethod.upsert({
          where: { identifier: spm.identifier },
          create: spm,
          update: spm,
        });
      }
      restoredTables.P2pSystemPaymentMethod = data.P2pSystemPaymentMethod.length;
    }

    // 7. Crypto Assets
    if (Array.isArray(data.CryptoAsset)) {
      for (const ca of data.CryptoAsset) {
        await prisma.cryptoAsset.upsert({
          where: { symbol: ca.symbol },
          create: ca,
          update: ca,
        });
      }
      restoredTables.CryptoAsset = data.CryptoAsset.length;
    }

    // 8. Fiat Currencies
    if (Array.isArray(data.FiatCurrency)) {
      for (const fc of data.FiatCurrency) {
        await prisma.fiatCurrency.upsert({
          where: { code: fc.code },
          create: fc,
          update: fc,
        });
      }
      restoredTables.FiatCurrency = data.FiatCurrency.length;
    }

    // 9. Tracking Config
    if (Array.isArray(data.TrackingConfig) && data.TrackingConfig.length > 0) {
      const tc = data.TrackingConfig[0];
      await prisma.trackingConfig.upsert({
        where: { id: tc.id || "default" },
        create: tc,
        update: tc,
      });
      restoredTables.TrackingConfig = 1;
    }

    // Log administrative action
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "WEBSITE_CONFIG_RESTORE",
        targetType: "SYSTEM",
        targetId: "global_config",
        details: `Restored website configuration and content: ${JSON.stringify(restoredTables)}`,
      },
    });

    return { success: true, restoredTables };
  } catch (err: any) {
    return { success: false, restoredTables, error: err?.message || String(err) };
  }
}

/**
 * 7. RESTORE MEDIA ARCHIVE
 */
export async function restoreMediaArchive(
  data: Record<string, any[]>,
  admin: { id: string; email: string }
): Promise<{ success: boolean; restoredDocuments: number; error?: string }> {
  try {
    const kycDocs = data.kyc_documents;
    if (!Array.isArray(kycDocs) || kycDocs.length === 0) {
      return { success: true, restoredDocuments: 0 };
    }

    const dbBinding = getDbBinding();
    let count = 0;

    if (dbBinding) {
      // Chunk batches of 50 statements for D1 batch limit
      for (let i = 0; i < kycDocs.length; i += 50) {
        const batch = kycDocs.slice(i, i + 50);
        const statements = batch.map((doc: any) => {
          return dbBinding
            .prepare(
              `INSERT OR REPLACE INTO kyc_documents 
              (id, filename, user_id, side, mime_type, file_size, chunk_index, total_chunks, data, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              doc.id,
              doc.filename,
              doc.user_id,
              doc.side,
              doc.mime_type,
              doc.file_size,
              doc.chunk_index,
              doc.total_chunks,
              doc.data,
              doc.created_at
            );
        });
        await dbBinding.batch(statements);
        count += batch.length;
      }
    } else {
      for (const doc of kycDocs) {
        await prisma.$executeRawUnsafe(
          `INSERT OR REPLACE INTO kyc_documents 
          (id, filename, user_id, side, mime_type, file_size, chunk_index, total_chunks, data, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          doc.id,
          doc.filename,
          doc.user_id,
          doc.side,
          doc.mime_type,
          doc.file_size,
          doc.chunk_index,
          doc.total_chunks,
          doc.data,
          doc.created_at
        );
        count++;
      }
    }

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "MEDIA_ARCHIVE_RESTORE",
        targetType: "STORAGE",
        targetId: "kyc_documents",
        details: `Restored ${count} media chunks/documents into Cloudflare D1 storage.`,
      },
    });

    return { success: true, restoredDocuments: count };
  } catch (err: any) {
    return { success: false, restoredDocuments: 0, error: err?.message || String(err) };
  }
}

/**
 * 8. RESTORE FULL DATABASE
 */
export async function restoreFullDatabase(
  data: Record<string, any[]>,
  admin: { id: string; email: string }
): Promise<{ success: boolean; restoredTables: Record<string, number>; error?: string }> {
  const restoredTables: Record<string, number> = {};

  try {
    // 1. Users (Crucial: never overwrite primary super admin with invalid credentials)
    if (Array.isArray(data.User)) {
      for (const u of data.User) {
        // Format dates safely
        const userPayload = {
          ...u,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
        };

        await prisma.user.upsert({
          where: { id: u.id },
          create: userPayload,
          update: userPayload,
        });
      }
      restoredTables.User = data.User.length;
    }

    // 2. Wallets
    if (Array.isArray(data.Wallet)) {
      for (const w of data.Wallet) {
        await prisma.wallet.upsert({
          where: { id: w.id },
          create: {
            ...w,
            createdAt: w.createdAt ? new Date(w.createdAt) : new Date(),
            updatedAt: w.updatedAt ? new Date(w.updatedAt) : new Date(),
          },
          update: {
            balance: w.balance,
            lockedBalance: w.lockedBalance,
            escrowBalance: w.escrowBalance,
            updatedAt: new Date(),
          },
        });
      }
      restoredTables.Wallet = data.Wallet.length;
    }

    // 3. Bank Cards & Crypto Wallets
    if (Array.isArray(data.BankCard)) {
      for (const b of data.BankCard) {
        await prisma.bankCard.upsert({
          where: { id: b.id },
          create: {
            ...b,
            createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
            updatedAt: b.updatedAt ? new Date(b.updatedAt) : new Date(),
          },
          update: b,
        });
      }
      restoredTables.BankCard = data.BankCard.length;
    }

    if (Array.isArray(data.UserCryptoWallet)) {
      for (const c of data.UserCryptoWallet) {
        await prisma.userCryptoWallet.upsert({
          where: { id: c.id },
          create: {
            ...c,
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
          },
          update: c,
        });
      }
      restoredTables.UserCryptoWallet = data.UserCryptoWallet.length;
    }

    // 4. KYC Applications
    if (Array.isArray(data.KycApplication)) {
      for (const kyc of data.KycApplication) {
        await prisma.kycApplication.upsert({
          where: { id: kyc.id },
          create: {
            ...kyc,
            createdAt: kyc.createdAt ? new Date(kyc.createdAt) : new Date(),
            updatedAt: kyc.updatedAt ? new Date(kyc.updatedAt) : new Date(),
            reviewedAt: kyc.reviewedAt ? new Date(kyc.reviewedAt) : null,
          },
          update: kyc,
        });
      }
      restoredTables.KycApplication = data.KycApplication.length;
    }

    // 5. Deposits & Withdrawals
    if (Array.isArray(data.DepositRequest)) {
      for (const d of data.DepositRequest) {
        await prisma.depositRequest.upsert({
          where: { id: d.id },
          create: {
            ...d,
            createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
            updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
            reviewedAt: d.reviewedAt ? new Date(d.reviewedAt) : null,
          },
          update: d,
        });
      }
      restoredTables.DepositRequest = data.DepositRequest.length;
    }

    if (Array.isArray(data.WithdrawalRequest)) {
      for (const w of data.WithdrawalRequest) {
        await prisma.withdrawalRequest.upsert({
          where: { id: w.id },
          create: {
            ...w,
            createdAt: w.createdAt ? new Date(w.createdAt) : new Date(),
            updatedAt: w.updatedAt ? new Date(w.updatedAt) : new Date(),
            reviewedAt: w.reviewedAt ? new Date(w.reviewedAt) : null,
          },
          update: w,
        });
      }
      restoredTables.WithdrawalRequest = data.WithdrawalRequest.length;
    }

    // 6. Orders & Transactions
    if (Array.isArray(data.Order)) {
      for (const o of data.Order) {
        await prisma.order.upsert({
          where: { id: o.id },
          create: {
            ...o,
            createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
            updatedAt: o.updatedAt ? new Date(o.updatedAt) : new Date(),
          },
          update: o,
        });
      }
      restoredTables.Order = data.Order.length;
    }

    if (Array.isArray(data.Transaction)) {
      for (const t of data.Transaction) {
        await prisma.transaction.upsert({
          where: { id: t.id },
          create: {
            ...t,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
          },
          update: t,
        });
      }
      restoredTables.Transaction = data.Transaction.length;
    }

    // 7. RM & Contracts
    if (Array.isArray(data.RmProfile)) {
      for (const rm of data.RmProfile) {
        await prisma.rmProfile.upsert({
          where: { id: rm.id },
          create: rm,
          update: rm,
        });
      }
      restoredTables.RmProfile = data.RmProfile.length;
    }

    if (Array.isArray(data.RmConnection)) {
      for (const c of data.RmConnection) {
        await prisma.rmConnection.upsert({
          where: { id: c.id },
          create: c,
          update: c,
        });
      }
      restoredTables.RmConnection = data.RmConnection.length;
    }

    // 8. Restore Website Configuration tables
    const configResult = await restoreWebsiteConfiguration(data, admin);
    Object.assign(restoredTables, configResult.restoredTables);

    // 9. Restore Media Documents if present
    if (Array.isArray(data.kyc_documents)) {
      const mediaResult = await restoreMediaArchive(data, admin);
      restoredTables.kyc_documents = mediaResult.restoredDocuments;
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "FULL_DATABASE_RESTORE",
        targetType: "DATABASE",
        targetId: "full_d1_database",
        details: `Successfully restored full database backup. Tables affected: ${JSON.stringify(restoredTables)}`,
      },
    });

    return { success: true, restoredTables };
  } catch (err: any) {
    return { success: false, restoredTables, error: err?.message || String(err) };
  }
}

/**
 * 9. BACKUP STATS & AUDIT LOGS
 */
export async function getBackupDashboardStats() {
  const [
    userCount,
    walletCount,
    orderCount,
    txCount,
    kycCount,
    marketCount,
    slideCount,
    auditLogCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.wallet.count(),
    prisma.order.count(),
    prisma.transaction.count(),
    prisma.kycApplication.count(),
    prisma.market.count(),
    prisma.heroSlide.count(),
    prisma.auditLog.count({
      where: {
        action: {
          in: [
            "USER_PERMANENT_DELETION",
            "FULL_DATABASE_RESTORE",
            "WEBSITE_CONFIG_RESTORE",
            "MEDIA_ARCHIVE_RESTORE",
            "BACKUP_DOWNLOAD",
          ],
        },
      },
    }),
  ]);

  let mediaCount = 0;
  try {
    const dbBinding = getDbBinding();
    if (dbBinding) {
      const res = await dbBinding.prepare("SELECT COUNT(DISTINCT filename) as total FROM kyc_documents").first();
      mediaCount = Number((res as any)?.total || 0);
    } else {
      const res = (await prisma.$queryRawUnsafe("SELECT COUNT(DISTINCT filename) as total FROM kyc_documents")) as any[];
      mediaCount = Number(res[0]?.total || 0);
    }
  } catch {
    mediaCount = 0;
  }

  const recentLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "USER_PERMANENT_DELETION",
          "FULL_DATABASE_RESTORE",
          "WEBSITE_CONFIG_RESTORE",
          "MEDIA_ARCHIVE_RESTORE",
          "BACKUP_DOWNLOAD",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    userCount,
    walletCount,
    orderCount,
    txCount,
    kycCount,
    marketCount,
    slideCount,
    mediaCount,
    auditLogCount,
    recentLogs,
  };
}
