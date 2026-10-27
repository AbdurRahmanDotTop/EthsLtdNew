import { PrismaClient } from "@prisma/client";
import { getAvailableRms, invalidatePublicRmsCache } from "../src/actions/rm";
import { getHeroSlides, invalidateHeroSlidesCache } from "../src/actions/slider";
import { getHomepageMarkets, invalidateMarketsCache } from "../src/actions/markets";
import { getP2pAds } from "../src/actions/p2p";
import { getUserAssetSummary } from "../src/actions/user";

process.env.CLI_TEST_MODE = "true";

const prisma = new PrismaClient();

async function runDataVerificationTests() {
  console.log("=================================================");
  console.log("🔍 AUDIT: REAL DATABASE DATA & SYNCHRONIZATION");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${title} - ${detail || "Assertion failed"}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: Relationship Managers (rm.ts) Live DB Query & Cache
    // ----------------------------------------------------
    console.log("TEST SUITE 1: Relationship Managers Real DB Integration");
    
    // Invalidate cache first to force live fetch
    await invalidatePublicRmsCache();
    const rmsRes = await getAvailableRms();

    assert(rmsRes.success === true, "getAvailableRms returns success: true");
    const rms = rmsRes.rms || [];
    assert(Array.isArray(rms) && rms.length > 0, `Returned array of RMs from database (count: ${rms.length})`);

    // Verify all active RMs in database are returned
    const dbRms = await prisma.user.findMany({
      where: { role: "RM", status: "ACTIVE" },
      include: { rmProfile: true },
    });
    console.log(`  Database has ${dbRms.length} active RMs: ${dbRms.map((r) => `${r.name || r.email} (${r.rmProfile?.rmCode || r.uid})`).join(", ")}`);

    assert(rms.length === dbRms.length, `RM count matches real DB active RMs (Expected ${dbRms.length}, got ${rms.length})`);

    // Verify no mock data: None of the RMs should have the hardcoded 38, 29, 44, 52 reviews unless approved in DB
    for (const rm of rms) {
      const realReviewsCount = await prisma.rmReview.count({
        where: { rmId: rm.id, status: "APPROVED" },
      });
      assert(
        rm.totalRatings === realReviewsCount,
        `RM ${rm.name} (${rm.rmCode}) review count matches real DB (Got: ${rm.totalRatings}, DB: ${realReviewsCount})`
      );

      const realActiveConnections = await prisma.rmConnection.count({
        where: { rmId: rm.id, status: "ACTIVE" },
      });
      assert(
        rm.activeClientsCount === realActiveConnections,
        `RM ${rm.name} (${rm.rmCode}) active clients count matches real DB (Got: ${rm.activeClientsCount}, DB: ${realActiveConnections})`
      );
    }

    // Verify cache invalidation & refetch
    await invalidatePublicRmsCache();
    const refreshedRms = await getAvailableRms();
    assert(refreshedRms.rms?.length === rms.length, "Fresh fetch after invalidatePublicRmsCache returns accurate count");

    // ----------------------------------------------------
    // TEST SUITE 2: Hero Slider (slider.ts) Real DB Data
    // ----------------------------------------------------
    console.log("\nTEST SUITE 2: Hero Slider Real Database Integration");
    await invalidateHeroSlidesCache();
    const slides = await getHeroSlides();

    assert(Array.isArray(slides), "getHeroSlides returns an array");
    // Verify none have fallback IDs like fallback-0
    const hasFallbackId = slides.some((s: any) => String(s.id).startsWith("fallback-"));
    assert(!hasFallbackId, "No mock or fallback-ID slides in hero slider result");

    const dbSlidesCount = await prisma.heroSlide.count({ where: { enabled: true } });
    assert(slides.length === dbSlidesCount, `Hero slides count matches DB enabled count (${dbSlidesCount})`);

    // ----------------------------------------------------
    // TEST SUITE 3: Markets (markets.ts) Real DB Data
    // ----------------------------------------------------
    console.log("\nTEST SUITE 3: Markets Real Database Integration");
    await invalidateMarketsCache();
    const marketsData = await getHomepageMarkets();

    assert(Boolean(marketsData && marketsData.topTickers && marketsData.homeListings), "getHomepageMarkets returns topTickers and homeListings");
    assert(Array.isArray(marketsData.topTickers), "topTickers is an array");
    assert(Array.isArray(marketsData.homeListings), "homeListings is an array");

    const dbTopCount = await prisma.market.count({ where: { isTopTicker: true, status: "ACTIVE" } });
    assert(marketsData.topTickers.length <= 3 && marketsData.topTickers.length === dbTopCount, `topTickers count matches DB (${dbTopCount})`);

    // ----------------------------------------------------
    // TEST SUITE 4: P2P Ads (p2p.ts) Real DB Data
    // ----------------------------------------------------
    console.log("\nTEST SUITE 4: P2P Ads Live Data");
    const p2pRes = await getP2pAds();
    assert(p2pRes.success === true, "getP2pAds returns success: true");
    const dbP2pCount = await prisma.p2pAd.count({ where: { status: "ACTIVE" } });
    assert(p2pRes.data?.length === dbP2pCount, `P2P active ads count matches DB active ads (${dbP2pCount})`);

    // ----------------------------------------------------
    // TEST SUITE 5: User Assets & Wallets (user.ts) Real DB Data
    // ----------------------------------------------------
    console.log("\nTEST SUITE 5: User Asset Summary Live Calculation");
    const sampleUser = await prisma.user.findFirst({
      where: { role: "USER" },
    });
    if (sampleUser) {
      const assetSummary = await getUserAssetSummary(sampleUser.id);
      assert(assetSummary !== null, `getUserAssetSummary returns real asset summary for user #${sampleUser.uid}`);
      assert(typeof assetSummary?.totalAssetsUsdt === "number", `totalAssetsUsdt is a valid numeric value (${assetSummary?.totalAssetsUsdt})`);
      assert(typeof assetSummary?.totalAssetsUsd === "number", `totalAssetsUsd is a valid numeric value (${assetSummary?.totalAssetsUsd})`);
      assert(Boolean(assetSummary?.categories?.currency && assetSummary?.categories?.currency?.assets), "categories.currency contains real asset list");
    }

    console.log("\n=================================================");
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test runner encountered an unexpected error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDataVerificationTests();
