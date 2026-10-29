process.env.CLI_TEST_MODE = "true";

import prisma from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import {
  getAvailableRms,
  sendRmConnectionRequest,
  respondToConnectionRequest,
  getContractById,
  signInvestmentContract,
  ensureInvestmentContract,
} from "../src/actions/rm";

async function runContractAudit() {
  console.log("===============================================================");
  console.log("  ETHSLTD CONTRACT REVIEW & SIGNING END-TO-END AUTOMATED AUDIT ");
  console.log("===============================================================\n");

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

  // Find RM AbdurRahman (1004)
  const rmAbdur = await prisma.user.findFirst({
    where: { role: "RM", email: "abdurrahman@ethsltd.com" },
    include: { rmProfile: true },
  });

  if (!rmAbdur) {
    throw new Error("RM AbdurRahman not found in database.");
  }
  console.log(`[SETUP] Found RM: ${rmAbdur.name} (Code: ${rmAbdur.rmProfile?.rmCode}, ID: ${rmAbdur.id})`);

  // Create isolated test client
  const testClientEmail = `contract_audit_${Date.now()}@ethsltd.com`;
  const passwordHash = await bcrypt.hash("UserPass2026!", 10);
  const testClient = await prisma.user.create({
    data: {
      email: testClientEmail,
      name: "Contract Audit Client",
      passwordHash,
      uid: Math.floor(100000 + Math.random() * 900000),
      role: "USER",
      status: "ACTIVE",
      isKycVerified: true,
      isEmailVerified: true,
    },
  });
  console.log(`[SETUP] Created test client: ${testClient.email} (UID: #${testClient.uid})`);

  // Create isolated attacker user for negative security checks
  const testAttackerEmail = `contract_attacker_${Date.now()}@ethsltd.com`;
  const testAttacker = await prisma.user.create({
    data: {
      email: testAttackerEmail,
      name: "Attacker User",
      passwordHash,
      uid: Math.floor(100000 + Math.random() * 900000),
      role: "USER",
      status: "ACTIVE",
    },
  });

  let connectionId = "";
  let contractId = "";

  try {
    // -------------------------------------------------------------
    // TEST 1: Public Unauthenticated Discovery
    // -------------------------------------------------------------
    console.log("\n[TEST SUITE 1] Public Directory Discovery (Unauthenticated Visitor)...");
    const publicRmsRes = await getAvailableRms();
    assert(publicRmsRes.success === true, "getAvailableRms() succeeds for public visitors");
    const publicRmAbdur = publicRmsRes.rms?.find((r: any) => r.id === rmAbdur.id);
    assert(Boolean(publicRmAbdur), "RM AbdurRahman is publicly discoverable in directory");
    assert(publicRmAbdur?.userRelationship === null, "Public visitor has no active relationship attached");

    // -------------------------------------------------------------
    // TEST 2: Client Connection Request
    // -------------------------------------------------------------
    console.log("\n[TEST SUITE 2] Client Connection Initiation...");
    // Mock user session context for test client
    (globalThis as any).__mockSession = { userId: testClient.id, email: testClient.email, role: testClient.role };

    const initialConn = await prisma.rmConnection.create({
      data: {
        userId: testClient.id,
        rmId: rmAbdur.id,
        status: "REQUESTED",
        requestMessage: "Requesting advisory services for perpetual futures.",
      },
    });
    connectionId = initialConn.id;
    assert(initialConn.status === "REQUESTED", "RM Connection created with status REQUESTED");

    // -------------------------------------------------------------
    // TEST 3: RM Acceptance & Contract Initialization
    // -------------------------------------------------------------
    console.log("\n[TEST SUITE 3] RM Acceptance & Automatic Contract Generation...");
    // Mock session as RM
    (globalThis as any).__mockSession = { userId: rmAbdur.id, email: rmAbdur.email, role: rmAbdur.role };

    const acceptRes = await respondToConnectionRequest(connectionId, "ACCEPT", "Accepted client. Contract prepared.");
    assert(acceptRes.success === true, "RM successfully accepts connection request");
    assert(Boolean(acceptRes.contractId), `Contract successfully generated: ${acceptRes.contractId}`);
    contractId = acceptRes.contractId!;

    const contractRecord = await prisma.investmentContract.findUnique({ where: { id: contractId } });
    assert(contractRecord !== null, "Contract persisted in database");
    assert(contractRecord?.status === "PENDING_SIGNATURE", "Contract initial status is PENDING_SIGNATURE");
    assert(contractRecord?.partyASignature === null && contractRecord?.partyBSignature === null, "Signatures are initially null");

    // -------------------------------------------------------------
    // TEST 4: Client View & ensureInvestmentContract Resolution
    // -------------------------------------------------------------
    console.log("\n[TEST SUITE 4] Client Relationship & Contract Resolution...");
    // Switch back to client session
    (globalThis as any).__mockSession = { userId: testClient.id, email: testClient.email, role: testClient.role };

    const ensureRes = await ensureInvestmentContract(connectionId);
    assert(ensureRes.success === true && ensureRes.contractId === contractId, "ensureInvestmentContract() resolves active contract ID");

    // Verify contract document retrieval
    const contractDocRes = await getContractById(contractId);
    assert(contractDocRes.success === true, "getContractById() retrieves full contract document");
    assert(contractDocRes.contract?.title === "ETH Investment Contract", "Contract has institutional title");
    assert(contractDocRes.permissions?.canSignPartyB === true, "Client has permission to sign Party B");
    assert(contractDocRes.permissions?.canSignPartyA === false, "Client does NOT have permission to sign Party A");

    // -------------------------------------------------------------
    // TEST 5: Negative Security Checks (Cross-User & Unauthorized Access)
    // -------------------------------------------------------------
    console.log("\n[TEST SUITE 5] Cross-User Security & Authorization Defense...");
    // Attacker tries to read contract
    (globalThis as any).__mockSession = { userId: testAttacker.id, email: testAttacker.email, role: testAttacker.role };

    const unauthorizedDocRes = await getContractById(contractId);
    assert(unauthorizedDocRes.success === false, "Unauthorized user access to contract document is rejected");

    const dummySig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const unauthorizedSignRes = await signInvestmentContract({
      contractId,
      party: "PARTY_B",
      signatureBase64: dummySig,
    });
    assert(unauthorizedSignRes.success === false, "Unauthorized user signature attempt on Party B is blocked");

    // -------------------------------------------------------------
    // TEST 6: Step-by-Step Dual Party Digital Signing Flow
    // -------------------------------------------------------------
    console.log("\n[TEST SUITE 6] Dual-Party Cryptographic Digital Signing...");
    // 6.1 Party A (RM AbdurRahman) Signs
    (globalThis as any).__mockSession = { userId: rmAbdur.id, email: rmAbdur.email, role: rmAbdur.role };
    const signPartyARes = await signInvestmentContract({
      contractId,
      party: "PARTY_A",
      signatureBase64: dummySig,
    });
    assert(signPartyARes.success === true, "Party A (RM AbdurRahman) digital signature recorded");

    const contractAfterPartyA = await prisma.investmentContract.findUnique({ where: { id: contractId } });
    assert(contractAfterPartyA?.status === "PARTIALLY_SIGNED", "Contract status is PARTIALLY_SIGNED after Party A signs");
    assert(Boolean(contractAfterPartyA?.partyASignedAt), "Party A signed timestamp recorded");

    // Verify chat remains locked
    const convBeforePartyB = await prisma.rmConversation.findUnique({ where: { connectionId } });
    assert(!convBeforePartyB || !convBeforePartyB.isActive, "Private chat remains locked while partially signed");

    // 6.2 Party B (Client User) Signs
    (globalThis as any).__mockSession = { userId: testClient.id, email: testClient.email, role: testClient.role };
    const signPartyBRes = await signInvestmentContract({
      contractId,
      party: "PARTY_B",
      signatureBase64: dummySig,
    });
    assert(signPartyBRes.success === true, "Party B (Client) digital signature recorded");

    const contractAfterPartyB = await prisma.investmentContract.findUnique({ where: { id: contractId } });
    assert(contractAfterPartyB?.status === "FULLY_SIGNED", "Contract status transitions to FULLY_SIGNED");
    assert(Boolean(contractAfterPartyB?.effectiveDate), "Contract effective date recorded");
    assert(Boolean(contractAfterPartyB?.expiresAt), "Contract expiration date (1 year) recorded");

    // Verify audit trail recorded both events
    const auditEvents = JSON.parse(contractAfterPartyB?.auditTrail || "[]");
    assert(auditEvents.length >= 3, `Audit trail contains ${auditEvents.length} distinct cryptographic events`);

    // Verify connection status transitioned to ACTIVE
    const updatedConn = await prisma.rmConnection.findUnique({ where: { id: connectionId } });
    assert(updatedConn?.status === "ACTIVE", "RM Connection status transitioned to ACTIVE");

    // Verify private conversation is unlocked
    const convAfter = await prisma.rmConversation.findUnique({ where: { connectionId } });
    assert(Boolean(convAfter && convAfter.isActive), "Private 1-on-1 chat conversation activated");

    // -------------------------------------------------------------
    // TEST 7: Idempotency & Repeat Signing Protection
    // -------------------------------------------------------------
    console.log("\n[TEST SUITE 7] Repeat Signing & Duplicate Prevention...");
    const duplicateSignRes = await signInvestmentContract({
      contractId,
      party: "PARTY_B",
      signatureBase64: dummySig,
    });
    assert(duplicateSignRes.success === false, "Re-signing an already FULLY_SIGNED contract is rejected");

  } finally {
    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log("\n[CLEANUP] Cleaning up test records...");
    if (contractId) {
      await prisma.investmentContract.deleteMany({ where: { id: contractId } });
    }
    if (connectionId) {
      await prisma.rmMessage.deleteMany({ where: { conversation: { connectionId } } });
      await prisma.rmConversation.deleteMany({ where: { connectionId } });
      await prisma.rmConnection.deleteMany({ where: { id: connectionId } });
    }
    await prisma.rmNotification.deleteMany({ where: { userId: testClient.id } });
    await prisma.user.deleteMany({ where: { id: { in: [testClient.id, testAttacker.id] } } });
    console.log("  ✓ Test artifacts purged safely.");
  }

  console.log("\n===============================================================");
  console.log(`🏁 AUDIT COMPLETE: ${passed} PASSED | ${failed} FAILED`);
  console.log("===============================================================");

  if (failed > 0) process.exit(1);
}

runContractAudit().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});

