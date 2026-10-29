process.env.CLI_TEST_MODE = "true";

import prisma from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import {
  createP2pAd,
  createP2pOrder,
  markP2pOrderPaid,
  releaseP2pOrder,
  cancelP2pOrder,
  disputeP2pOrder,
  submitP2pDisputeEvidence,
  getP2pOrder,
} from "../src/actions/p2p";
import {
  getAdminStats,
  getAdminP2pStats,
  getAdminP2pDisputes,
  getAdminP2pDisputeDetails,
  updateAdminP2pDisputeStatus,
  assignAdminP2pDispute,
  addAdminDisputeNote,
  resolveAdminP2pDispute,
  reopenAdminP2pDispute,
} from "../src/actions/admin";

async function runDisputeAudit() {
  console.log("=======================================================================");
  console.log("     ETHSLTD COMPREHENSIVE P2P DISPUTE MANAGEMENT SYSTEM E2E AUDIT     ");
  console.log("=======================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc} - ${detail || "Condition not met"}`);
      failed++;
    }
  }

  // 1. SETUP: Create Admin, Buyer, and Seller test users
  const timestamp = Date.now();
  const passwordHash = await bcrypt.hash("DisputePass2026!", 10);

  const testAdmin = await prisma.user.create({
    data: {
      email: `dispute_admin_${timestamp}@ethsltd.com`,
      name: "Dispute Compliance Admin",
      role: "ADMIN",
      passwordHash,
      uid: Math.floor(100000 + Math.random() * 900000),
    },
  });

  const testSeller = await prisma.user.create({
    data: {
      email: `dispute_seller_${timestamp}@ethsltd.com`,
      name: "Dispute Merchant Seller",
      role: "USER",
      passwordHash,
      uid: Math.floor(100000 + Math.random() * 900000),
    },
  });

  const testBuyer = await prisma.user.create({
    data: {
      email: `dispute_buyer_${timestamp}@ethsltd.com`,
      name: "Dispute Trader Buyer",
      role: "USER",
      passwordHash,
      uid: Math.floor(100000 + Math.random() * 900000),
    },
  });

  console.log(`[SETUP] Created Test Admin: ${testAdmin.email}`);
  console.log(`[SETUP] Created Test Seller: ${testSeller.email}`);
  console.log(`[SETUP] Created Test Buyer: ${testBuyer.email}`);

  // Create P2P wallets with initial balances
  await prisma.wallet.create({
    data: {
      userId: testSeller.id,
      asset: "USDT",
      type: "P2P",
      balance: 1000,
      escrowBalance: 0,
    },
  });

  await prisma.wallet.create({
    data: {
      userId: testBuyer.id,
      asset: "USDT",
      type: "P2P",
      balance: 0,
      escrowBalance: 0,
    },
  });

  // Seller creates a P2P Sell Ad
  (globalThis as any).__mockSession = {
    userId: testSeller.id,
    email: testSeller.email,
    role: "USER",
  };

  const adRes = await createP2pAd({
    type: "SELL",
    asset: "USDT",
    fiat: "INR",
    priceType: "FIXED",
    fixedPrice: 100,
    totalCrypto: 500,
    minLimit: 500,
    maxLimit: 50000,
    paymentMethods: [
      {
        name: "UPI",
        details: { upiId: "seller@upi", payeeName: "Seller Account" },
      },
    ],
    terms: "Fast release upon receipt",
  });

  assert(adRes.success === true && Boolean(adRes.data?.id), "Seller successfully creates P2P Sell Ad");
  const adId = adRes.data.id;

  // Buyer creates a P2P Order
  (globalThis as any).__mockSession = {
    userId: testBuyer.id,
    email: testBuyer.email,
    role: "USER",
  };

  const orderRes = await createP2pOrder({
    adId,
    cryptoAmount: 100,
    fiatAmount: 10000,
    paymentMethod: "UPI",
  });

  assert(orderRes.success === true && Boolean(orderRes.data?.id), "Buyer initiates 100 USDT purchase order");
  const orderId = orderRes.data.id;

  // Verify Seller's wallet escrow locked
  const sellerWalletAfterOrder = await prisma.wallet.findFirst({
    where: { userId: testSeller.id, asset: "USDT", type: "P2P" },
  });
  assert(sellerWalletAfterOrder?.escrowBalance === 100, "100 USDT escrow is locked from seller balance");

  // Buyer marks payment as transferred
  const markPaidRes = await markP2pOrderPaid(orderId);
  assert(markPaidRes.success === true, "Buyer marks payment sent to seller");

  // -------------------------------------------------------------
  // TEST SUITE 1: DISPUTE CREATION, VALIDATION, AND TIMELINE
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 1: DISPUTE CREATION & VALIDATION ---");

  // Unrelated third party attempts to dispute -> Must be rejected
  const intruder = await prisma.user.create({
    data: {
      email: `intruder_${timestamp}@ethsltd.com`,
      name: "Malicious Intruder",
      role: "USER",
      passwordHash,
      uid: Math.floor(100000 + Math.random() * 900000),
    },
  });
  (globalThis as any).__mockSession = {
    userId: intruder.id,
    email: intruder.email,
    role: "USER",
  };
  const intruderDispute = await disputeP2pOrder(orderId, {
    reason: "Fake claim",
    description: "Trying to hijack order",
  });
  assert(intruderDispute.success === false, "Unauthorized user cannot dispute someone else's order");

  // Buyer raises valid dispute with evidence
  (globalThis as any).__mockSession = {
    userId: testBuyer.id,
    email: testBuyer.email,
    role: "USER",
  };

  const disputeRes = await disputeP2pOrder(orderId, {
    reason: "Payment Sent - Seller Refusing Release",
    description: "I transferred 10,000 INR to the seller's UPI account at 06:14 PM. UTR: 82910472.",
    evidenceUrls: [
      {
        url: "/api/p2p/evidence/upi_payment_proof.png",
        name: "upi_payment_proof.png",
      },
    ],
  });

  assert(disputeRes.success === true && Boolean(disputeRes.data?.id), "Buyer successfully opens formal dispute with evidence");
  const disputeId = disputeRes.data.id;
  const disputeNumber = disputeRes.data.displayId;
  assert(Boolean(disputeNumber && disputeNumber.startsWith("DSP-")), `Dispute assigned readable tracking ID: ${disputeNumber}`);

  // Duplicate dispute attempt on same order -> Must be rejected
  const duplicateDispute = await disputeP2pOrder(orderId, {
    reason: "Another claim",
    description: "Duplicate attempt",
  });
  assert(duplicateDispute.success === false, "Duplicate dispute creation on already disputed order is strictly blocked");

  // Verify order status changed to DISPUTED
  const disputedOrder = await prisma.p2pOrder.findUnique({ where: { id: orderId } });
  assert(disputedOrder?.status === "DISPUTED", "Order status atomically updated to DISPUTED in database");

  // Verify system chat message posted
  const sysMsg = await prisma.p2pMessage.findFirst({
    where: { orderId, type: "SYSTEM", content: { contains: disputeNumber } },
  });
  assert(Boolean(sysMsg), "System announcement posted into trade chat channel with dispute ID");

  // -------------------------------------------------------------
  // TEST SUITE 2: ESCROW LOCKS & FINANCIAL PROTECTION
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 2: FINANCIAL INTEGRITY & ESCROW LOCKS ---");

  // Seller attempts to release crypto while under dispute -> Must be blocked
  (globalThis as any).__mockSession = {
    userId: testSeller.id,
    email: testSeller.email,
    role: "USER",
  };
  const blockedRelease = await releaseP2pOrder(orderId);
  assert(blockedRelease.success === false, "Seller cannot release escrow while under active admin dispute");

  // Counterparty attempts to cancel order while under dispute -> Must be blocked
  (globalThis as any).__mockSession = {
    userId: testBuyer.id,
    email: testBuyer.email,
    role: "USER",
  };
  const blockedCancel = await cancelP2pOrder(orderId);
  assert(blockedCancel.success === false, "Trader cannot cancel order while under active admin dispute");

  // -------------------------------------------------------------
  // TEST SUITE 3: ADMIN DASHBOARD COUNTERS & ALERTS
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 3: ADMIN DASHBOARD COUNTERS & ALERTS ---");

  (globalThis as any).__mockSession = {
    userId: testAdmin.id,
    email: testAdmin.email,
    role: "ADMIN",
  };

  const adminStats = await getAdminStats();
  assert(
    typeof (adminStats as any).pendingDisputesCount === "number" && (adminStats as any).pendingDisputesCount >= 1,
    `Main Admin Dashboard reports ${(adminStats as any).pendingDisputesCount} pending dispute(s)`
  );

  const p2pStats = await getAdminP2pStats();
  assert(
    p2pStats.openDisputes >= 1 && p2pStats.activeDisputes >= 1,
    `P2P Oversight Dashboard accurately reports ${p2pStats.openDisputes} open dispute(s)`
  );

  const adminDisputes = await getAdminP2pDisputes({ status: "OPEN" });
  const foundInList = adminDisputes.some((d: any) => d.id === disputeId);
  assert(foundInList, "Dispute appears correctly in getAdminP2pDisputes({ status: 'OPEN' })");

  // -------------------------------------------------------------
  // TEST SUITE 4: ADMIN INVESTIGATION WORKSPACE & EVIDENCE
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 4: INVESTIGATION WORKSPACE, NOTES & EVIDENCE ---");

  const caseDetails = await getAdminP2pDisputeDetails(disputeId);
  assert(caseDetails.success === true && Boolean(caseDetails.data), "Admin successfully loads complete case details dossier");
  assert(caseDetails.data?.evidenceList?.length >= 1, "Evidence files parsed and attached in case details");
  assert(Array.isArray(caseDetails.data?.chatMessages), "Complete trade chat transcript loaded for moderator audit");

  // Admin self-assigns dispute
  const assignRes = await assignAdminP2pDispute(disputeId);
  assert(assignRes.success === true, "Admin assigns dispute to self");

  // Admin adds internal confidential note
  const noteRes = await addAdminDisputeNote(disputeId, "Verified seller bank branch is State Bank of India. Checking UTR.");
  assert(noteRes.success === true, "Admin successfully attaches internal audit note to case");

  // Admin requests additional evidence from seller
  const reqEvidenceRes = await updateAdminP2pDisputeStatus(disputeId, {
    status: "AWAITING_EVIDENCE",
    requestEvidenceFrom: "SELLER",
    messageToParties: "Please provide PDF statement from 06:00 PM to 06:30 PM.",
  });
  assert(reqEvidenceRes.success === true, "Admin transitions status to AWAITING_EVIDENCE and requests proof from seller");

  // Seller submits requested evidence
  (globalThis as any).__mockSession = {
    userId: testSeller.id,
    email: testSeller.email,
    role: "USER",
  };
  const sellerEvidenceRes = await submitP2pDisputeEvidence(orderId, {
    fileUrl: "/api/p2p/evidence/seller_statement.pdf",
    fileName: "seller_statement.pdf",
    description: "Account statement showing no credit received between 06:00 PM and 06:30 PM.",
  });
  assert(sellerEvidenceRes.success === true, "Seller uploads requested PDF statement into dispute evidence vault");

  // Verify buyer views updated dispute on order page
  (globalThis as any).__mockSession = {
    userId: testBuyer.id,
    email: testBuyer.email,
    role: "USER",
  };
  const buyerOrderView = await getP2pOrder(orderId);
  assert(buyerOrderView.success === true && Boolean(buyerOrderView.data?.dispute), "Buyer retrieves order containing full dispute details");
  assert(buyerOrderView.data?.dispute?.evidenceUrls?.length >= 2, "Dispute evidence vault contains both buyer and seller documents");

  // -------------------------------------------------------------
  // TEST SUITE 5: FINAL ADJUDICATION, ESCROW DISPOSITION & IDEMPOTENCY
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 5: ADJUDICATION, ESCROW DISPOSITION & IDEMPOTENCY ---");

  (globalThis as any).__mockSession = {
    userId: testAdmin.id,
    email: testAdmin.email,
    role: "ADMIN",
  };

  // Admin rules in favor of BUYER (e.g. valid bank UTR confirmed)
  const resolutionRes = await resolveAdminP2pDispute(disputeId, {
    decision: "BUYER_WINS",
    resolutionNotes: "Official bank confirmation verified UTR 82910472 settled into seller account. Releasing escrow to buyer.",
    releaseEscrowTo: "BUYER",
  });

  assert(resolutionRes.success === true, "Admin successfully authorizes resolution ruling: BUYER_WINS");

  // Check buyer wallet received the 100 USDT
  const buyerWalletAfterRuling = await prisma.wallet.findFirst({
    where: { userId: testBuyer.id, asset: "USDT", type: "P2P" },
  });
  assert(buyerWalletAfterRuling?.balance === 100, "100 USDT credited to buyer's P2P wallet balance");

  // Check seller escrow was deducted
  const sellerWalletAfterRuling = await prisma.wallet.findFirst({
    where: { userId: testSeller.id, asset: "USDT", type: "P2P" },
  });
  assert(sellerWalletAfterRuling?.escrowBalance === 0, "Seller escrow reduced to 0");

  // Check double-entry ledger transactions
  const buyerTx = await prisma.transaction.findFirst({
    where: { userId: testBuyer.id, type: "P2P", amount: 100 },
  });
  const sellerTx = await prisma.transaction.findFirst({
    where: { userId: testSeller.id, type: "P2P", amount: -100 },
  });
  assert(Boolean(buyerTx && sellerTx), "Double-entry accounting transaction records created for both counterparties");

  // Check order status is COMPLETED
  const finalOrder = await prisma.p2pOrder.findUnique({ where: { id: orderId } });
  assert(finalOrder?.status === "COMPLETED", "P2P order status finalized to COMPLETED");

  // Check dispute status is RESOLVED_BUYER
  const finalDispute = await prisma.p2pDispute.findUnique({ where: { id: disputeId } });
  assert(finalDispute?.status === "RESOLVED_BUYER", "Dispute record status finalized to RESOLVED_BUYER");

  // IDEMPOTENCY TEST: Attempting to resolve again must be strictly rejected
  const duplicateResolution = await resolveAdminP2pDispute(disputeId, {
    decision: "BUYER_WINS",
    resolutionNotes: "Duplicate replay attempt",
    releaseEscrowTo: "BUYER",
  });
  assert(duplicateResolution.success === false, "Idempotency enforced: Replaying resolution on finalized dispute is rejected");

  // -------------------------------------------------------------
  // TEST SUITE 6: REOPENING A DISPUTE
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 6: DISPUTE REOPENING WORKFLOW ---");

  const reopenRes = await reopenAdminP2pDispute(
    disputeId,
    "Seller produced counter-evidence from bank ombudsman requiring secondary review."
  );
  assert(reopenRes.success === true, "Authorized administrator reopens finalized dispute with recorded justification");

  const reopenedDispute = await prisma.p2pDispute.findUnique({ where: { id: disputeId } });
  assert(reopenedDispute?.status === "UNDER_REVIEW", "Reopened dispute transitions back to UNDER_REVIEW");

  const reopenedOrder = await prisma.p2pOrder.findUnique({ where: { id: orderId } });
  assert(reopenedOrder?.status === "DISPUTED", "Associated order returns to DISPUTED status for review");

  // CLEANUP: Clean test data
  console.log("\n[CLEANUP] Removing isolated test records...");
  try {
    await prisma.transaction.deleteMany({
      where: { userId: { in: [testBuyer.id, testSeller.id, testAdmin.id, intruder.id] } },
    });
    await prisma.p2pMessage.deleteMany({ where: { orderId } });
    await prisma.p2pDispute.deleteMany({ where: { orderId } });
    await prisma.p2pOrder.deleteMany({ where: { id: orderId } });
    await prisma.p2pAd.deleteMany({ where: { id: adId } });
    await prisma.wallet.deleteMany({
      where: { userId: { in: [testBuyer.id, testSeller.id, testAdmin.id, intruder.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { adminId: testAdmin.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testBuyer.id, testSeller.id, testAdmin.id, intruder.id] } },
    });
    console.log("[CLEANUP] Cleaned test records successfully.");
  } catch (err) {
    console.warn("[CLEANUP] Note during cleanup:", err);
  }

  console.log("\n=======================================================================");
  console.log(`TOTAL AUDIT ASSERTIONS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runDisputeAudit()
  .catch((e) => {
    console.error("FATAL DISPUTE AUDIT ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

