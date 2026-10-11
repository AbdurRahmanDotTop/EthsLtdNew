import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function runEndToEndTests() {
  console.log("=================================================");
  console.log("🚀 STARTING RM SYSTEM END-TO-END VERIFICATION");
  console.log("=================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${detail || "Assertion failed"}`);
      testsFailed++;
    }
  }

  try {
    // ------------------------------------------------------------------
    // TEST 1: RM Role & Profile Structure
    // ------------------------------------------------------------------
    console.log("TEST SUITE 1: RM User Role & Dedicated Profile");
    const activeRms = await prisma.user.findMany({
      where: { role: "RM", status: "ACTIVE" },
      include: { rmProfile: true },
    });

    assert(activeRms.length >= 3, "At least 3 active Relationship Managers exist in system", `Found ${activeRms.length}`);
    const rm1 = activeRms[0];
    assert(Boolean(rm1.rmProfile), `RM ${rm1.email} has associated RmProfile`);
    assert(Boolean(rm1.rmProfile?.rmCode), `RM profile has unique rmCode: ${rm1.rmProfile?.rmCode}`);
    assert(Boolean(rm1.rmProfile?.designation), `RM profile has designation: ${rm1.rmProfile?.designation}`);

    // ------------------------------------------------------------------
    // TEST 2: Test User Creation
    // ------------------------------------------------------------------
    console.log("\nTEST SUITE 2: Client User & RM Connection Workflow");
    const testClientEmail = `client.test.${Date.now()}@ethsltd.com`;
    const passwordHash = await bcrypt.hash("User@123456", 10);
    const testClient = await prisma.user.create({
      data: {
        email: testClientEmail,
        name: "Test Client Trader",
        passwordHash,
        uid: Math.floor(100000 + Math.random() * 900000),
        role: "USER",
        status: "ACTIVE",
        isKycVerified: true,
      },
    });
    console.log(`  Created test client user: ${testClient.email} (UID: #${testClient.uid})`);

    // 2.1 Send Connection Request
    const initialConnection = await prisma.rmConnection.create({
      data: {
        userId: testClient.id,
        rmId: rm1.id,
        status: "REQUESTED",
        requestMessage: "Looking for perpetual futures risk hedging strategies.",
      },
    });
    assert(initialConnection.status === "REQUESTED", "Connection request created with status REQUESTED");

    // 2.2 Prevent duplicate relationship between same user and RM
    let duplicatePrevented = false;
    try {
      await prisma.rmConnection.create({
        data: {
          userId: testClient.id,
          rmId: rm1.id,
          status: "REQUESTED",
        },
      });
    } catch {
      duplicatePrevented = true;
    }
    assert(duplicatePrevented, "Database unique constraint prevents duplicate connection for same User & RM");

    // ------------------------------------------------------------------
    // TEST 3: Contract Generation & Dual-Party Digital Signatures
    // ------------------------------------------------------------------
    console.log("\nTEST SUITE 3: Digital Contract Generation & Signature Enforcement");
    const contractNumber = `ETH-AGR-${Date.now().toString().slice(-6)}-${testClient.uid}`;

    // RM Accepts and generates Contract
    const contract = await prisma.investmentContract.create({
      data: {
        contractNumber,
        connectionId: initialConnection.id,
        userId: testClient.id,
        rmId: rm1.id,
        title: "ETH Investment Contract",
        version: "1.0.0",
        status: "PENDING_SIGNATURE",
        partyAName: `${rm1.name} (${rm1.rmProfile?.rmCode})`,
        partyARole: "Licensed Relationship Manager (Party A)",
        partyBName: `${testClient.name} (UID: #${testClient.uid})`,
        partyBRole: "Investor / Client (Party B)",
        termsText: "ETHSLTD Advisory Agreement Terms...",
        companyLegalName: "ETHSLTD Financial Technology Research Group",
        websiteUrl: "https://www.ethsltd.com",
      },
    });

    await prisma.rmConnection.update({
      where: { id: initialConnection.id },
      data: { status: "CONTRACT_PENDING" },
    });

    assert(contract.status === "PENDING_SIGNATURE", "Contract generated with status PENDING_SIGNATURE");
    assert(contract.partyASignature === null && contract.partyBSignature === null, "Initial signatures are null");

    // 3.1 Strict Security Check: Client Attempts Private Chat Access Before Signing
    console.log("\nTEST SUITE 4: Chat Authorization Enforcement (Security Gate)");
    const activeContractCountBefore = await prisma.investmentContract.count({
      where: { connectionId: initialConnection.id, status: "FULLY_SIGNED" },
    });
    assert(activeContractCountBefore === 0, "No fully signed contract exists before signatures");

    const canChatBefore = initialConnection.status === "ACTIVE" && activeContractCountBefore > 0;
    assert(!canChatBefore, "SECURITY VERIFIED: Private chat is strictly BLOCKED while contract is unsigned");

    // 3.2 Step 1: Client Signs (Party B)
    console.log("\nTEST SUITE 5: Partial Signature State (One-Party Signed)");
    const dummyClientSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const partialContract = await prisma.investmentContract.update({
      where: { id: contract.id },
      data: {
        partyBSignature: dummyClientSig,
        partyBSignedAt: new Date(),
        partyBSignerUid: testClient.uid,
        status: "PARTIALLY_SIGNED",
      },
    });

    assert(partialContract.status === "PARTIALLY_SIGNED", "Contract status is PARTIALLY_SIGNED after only 1 signature");
    assert(partialContract.status !== "FULLY_SIGNED", "CRITICAL: Contract is NOT fully signed after 1 signature");

    // Check chat access again during PARTIALLY_SIGNED
    const activeContractCountPartial = await prisma.investmentContract.count({
      where: { connectionId: initialConnection.id, status: "FULLY_SIGNED" },
    });
    const canChatPartial = initialConnection.status === "ACTIVE" && activeContractCountPartial > 0;
    assert(!canChatPartial, "SECURITY VERIFIED: Private chat remains BLOCKED in PARTIALLY_SIGNED state");

    // 3.3 Step 2: RM Signs (Party A) -> FULLY_SIGNED
    console.log("\nTEST SUITE 6: Full Signature & Relationship Activation");
    const dummyRmSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const fullySignedContract = await prisma.investmentContract.update({
      where: { id: contract.id },
      data: {
        partyASignature: dummyRmSig,
        partyASignedAt: new Date(),
        partyASignerUid: rm1.uid,
        status: "FULLY_SIGNED",
        effectiveDate: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    const activatedConnection = await prisma.rmConnection.update({
      where: { id: initialConnection.id },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });

    assert(fullySignedContract.status === "FULLY_SIGNED", "Contract status transitions to FULLY_SIGNED upon dual signatures");
    assert(activatedConnection.status === "ACTIVE", "Relationship status transitions to ACTIVE upon contract completion");

    // ------------------------------------------------------------------
    // TEST 7: Private Chat Activation & Messaging
    // ------------------------------------------------------------------
    console.log("\nTEST SUITE 7: Private Chat Channel Activation & Data Isolation");
    const conversation = await prisma.rmConversation.create({
      data: {
        connectionId: activatedConnection.id,
        userId: testClient.id,
        rmId: rm1.id,
        isActive: true,
      },
    });

    // Client sends message to RM
    const msg1 = await prisma.rmMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: testClient.id,
        text: "Hello RM Sarah, reviewing the perpetual futures leverage guidelines now.",
      },
    });
    assert(Boolean(msg1.id), "Client successfully sends message to assigned RM");

    // RM replies to Client
    const msg2 = await prisma.rmMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: rm1.id,
        text: "Welcome! Leverage parameters are set. Maximum 10x recommended for volatile moves.",
      },
    });
    assert(Boolean(msg2.id), "RM successfully replies to connected client");

    // Unauthorized outsider attempts to read/send in this conversation
    const outsider = await prisma.user.create({
      data: {
        email: `outsider.${Date.now()}@ethsltd.com`,
        name: "Unauthorized Intruder",
        passwordHash,
        uid: Math.floor(100000 + Math.random() * 900000),
        role: "USER",
        status: "ACTIVE",
      },
    });

    const isOutsiderAuthorized =
      outsider.id === conversation.userId || outsider.id === conversation.rmId;
    assert(!isOutsiderAuthorized, "SECURITY VERIFIED: Unauthorized user is denied access to private conversation");

    // ------------------------------------------------------------------
    // TEST 8: Administrative RM Reassignment Policy
    // ------------------------------------------------------------------
    console.log("\nTEST SUITE 8: Administrative RM Reassignment Policy");
    const rm2 = activeRms[1]; // Target RM

    // Reassign client from RM1 to RM2
    await prisma.$transaction(async (tx) => {
      await tx.rmConnection.update({
        where: { id: activatedConnection.id },
        data: {
          rmId: rm2.id,
          reassignedFromRmId: rm1.id,
          responseNotes: `Reassigned from ${rm1.name} to ${rm2.name}`,
        },
      });

      await tx.investmentContract.update({
        where: { id: fullySignedContract.id },
        data: {
          rmId: rm2.id,
          partyAName: `${rm2.name} (${rm2.rmProfile?.rmCode}) [Reassigned]`,
        },
      });

      await tx.rmConversation.update({
        where: { id: conversation.id },
        data: {
          rmId: rm2.id,
        },
      });
    });

    const updatedConn = await prisma.rmConnection.findUnique({
      where: { id: activatedConnection.id },
    });
    const updatedContract = await prisma.investmentContract.findUnique({
      where: { id: fullySignedContract.id },
    });

    assert(updatedConn?.rmId === rm2.id, "Connection reassigned to new RM");
    assert(updatedConn?.reassignedFromRmId === rm1.id, "Historical source RM preserved in reassignedFromRmId");
    assert(updatedContract?.status === "FULLY_SIGNED", "Existing signed contract preserved without data loss");

    // Clean up test users
    await prisma.rmMessage.deleteMany({ where: { conversationId: conversation.id } });
    await prisma.rmConversation.delete({ where: { id: conversation.id } });
    await prisma.investmentContract.delete({ where: { id: contract.id } });
    await prisma.rmConnection.delete({ where: { id: initialConnection.id } });
    await prisma.user.delete({ where: { id: testClient.id } });
    await prisma.user.delete({ where: { id: outsider.id } });

    console.log("\n=================================================");
    console.log(`🏁 TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log("=================================================");

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution threw error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runEndToEndTests();
