process.env.CLI_TEST_MODE = "true";

import prisma from "../src/lib/prisma";
import { getAvailableRms } from "../src/actions/rm";

async function testRelContract() {
  console.log("=== Testing getAvailableRms userRelationship.contract populated ===");

  const rm = await prisma.user.findFirst({ where: { role: "RM" } });
  if (!rm) throw new Error("No RM found");

  const testUser = await prisma.user.create({
    data: {
      email: `test_rel_contract_${Date.now()}@ethsltd.com`,
      name: "Rel Contract Tester",
      passwordHash: "hash",
      uid: Math.floor(100000 + Math.random() * 900000),
      role: "USER",
    },
  });

  const conn = await prisma.rmConnection.create({
    data: {
      userId: testUser.id,
      rmId: rm.id,
      status: "CONTRACT_PENDING",
    },
  });

  const contract = await prisma.investmentContract.create({
    data: {
      contractNumber: `TEST-AGR-${Date.now()}`,
      connectionId: conn.id,
      userId: testUser.id,
      rmId: rm.id,
      title: "ETH Test Contract",
      partyAName: "Party A",
      partyBName: "Party B",
      termsText: "Terms...",
      status: "PENDING_SIGNATURE",
    },
  });

  (globalThis as any).__mockSession = { userId: testUser.id, email: testUser.email, role: "USER" };

  const res = await getAvailableRms();
  const matchedRm = res.rms?.find((r: any) => r.id === rm.id);

  console.log("matchedRm userRelationship status:", matchedRm?.userRelationship?.status);
  const contractId = matchedRm?.userRelationship?.contract?.id;
  console.log("Returned contract id:", contractId);
  console.log("Expected contract id:", contract.id);

  if (contractId === contract.id) {
    console.log("✅ SUCCESS: contract is properly attached to userRelationship and has matching id!");
  } else {
    console.error("❌ FAILED: contract is missing or id does not match");
    process.exit(1);
  }

  // Cleanup
  await prisma.investmentContract.delete({ where: { id: contract.id } });
  await prisma.rmConnection.delete({ where: { id: conn.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("Cleaned up successfully.");
}

testRelContract().catch((e) => {
  console.error(e);
  process.exit(1);
});

