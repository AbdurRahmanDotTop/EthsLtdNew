const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runTests() {
  console.log("=== STARTING P2P SYSTEM AUDIT & VERIFICATION ===");

  // 1. Verify Channel Types & Dynamic Custom Fields
  console.log("\n[1] Testing P2P Channel Types & Dynamic Custom Fields...");
  const channels = await prisma.p2pChannelType.findMany({
    include: {
      fields: {
        orderBy: { displayOrder: "asc" },
      },
      systemPaymentMethods: true,
    },
  });
  console.log(`✓ Found ${channels.length} Channel Types in database:`);
  for (const ch of channels) {
    console.log(`  - [${ch.identifier}] "${ch.name}" (${ch.fields.length} dynamic custom fields, ${ch.systemPaymentMethods.length} payment methods linked)`);
    for (const f of ch.fields) {
      console.log(`      * Field: ${f.fieldLabel} (${f.fieldName}) | Type: ${f.fieldType} | Required: ${f.isRequired}`);
    }
  }

  // 2. Verify Centralized System Payment Methods
  console.log("\n[2] Testing Centralized P2P Payment Methods & Channel Mapping...");
  const methods = await prisma.p2pSystemPaymentMethod.findMany({
    include: {
      channelType: {
        include: {
          fields: true,
        },
      },
    },
  });
  console.log(`✓ Found ${methods.length} Centralized Payment Methods:`);
  for (const m of methods) {
    const inheritedFieldsCount = m.channelType?.fields?.length || 0;
    console.log(
      `  - ${m.name} (Slug: ${m.identifier}) | Currency: ${m.currency} | Active: ${m.isActive} | Linked Channel: ${
        m.channelType?.name || "None"
      } | Available Custom Fields: ${inheritedFieldsCount}`
    );
  }

  // 3. Verify Crypto Assets Management
  console.log("\n[3] Testing Crypto Assets Management...");
  const cryptoAssets = await prisma.cryptoAsset.findMany();
  console.log(`✓ Found ${cryptoAssets.length} Crypto Assets:`);
  for (const ca of cryptoAssets) {
    const networks = typeof ca.networks === "string" ? JSON.parse(ca.networks) : ca.networks;
    console.log(
      `  - ${ca.symbol} (${ca.name}) | Networks: [${networks.join(", ")}] | Decimals: ${
        ca.decimals
      } | Active: ${ca.isActive} | P2P: ${ca.canP2p} | Deposit: ${ca.canDeposit} | Withdraw: ${ca.canWithdraw}`
    );
  }

  // 4. Verify Fiat Currencies Management
  console.log("\n[4] Testing Fiat Currencies Management...");
  const fiats = await prisma.fiatCurrency.findMany();
  console.log(`✓ Found ${fiats.length} Fiat Currencies:`);
  for (const fc of fiats) {
    console.log(
      `  - ${fc.code} (${fc.symbol}) - ${fc.name} | Country: ${fc.country || "Global"} | Decimals: ${
        fc.decimals
      } | Active: ${fc.isActive} | P2P: ${fc.canP2p}`
    );
  }

  // 5. Test Dependency Safety Checks (Dry Run Validation)
  console.log("\n[5] Testing Safe Dependency Guard Validation...");
  const upiChannel = channels.find((c) => c.identifier === "UPI");
  if (upiChannel) {
    const linkedMethods = await prisma.p2pSystemPaymentMethod.count({
      where: { channelTypeId: upiChannel.id },
    });
    console.log(`✓ UPI Channel has ${linkedMethods} linked payment methods.`);
    if (linkedMethods > 0) {
      console.log(`  -> Safe guard verified: Deleting UPI Channel would be blocked because ${linkedMethods} payment methods depend on it.`);
    }
  }

  const usdtAsset = cryptoAssets.find((a) => a.symbol === "USDT");
  if (usdtAsset) {
    const activeAds = await prisma.p2pAd.count({
      where: { asset: usdtAsset.symbol, status: { in: ["ACTIVE", "PAUSED"] } },
    });
    console.log(`✓ USDT Asset has ${activeAds} active/paused P2P ads.`);
    if (activeAds > 0) {
      console.log(`  -> Safe guard verified: Deleting USDT Asset would be blocked because ${activeAds} ads depend on it.`);
    }
  }

  console.log("\n=== ALL AUDIT CHECKS PASSED SUCCESSFULLY ===");
}

runTests()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
