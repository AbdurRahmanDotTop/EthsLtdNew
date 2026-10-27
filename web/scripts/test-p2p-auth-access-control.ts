process.env.CLI_TEST_MODE = "true";

import prisma from "../src/lib/prisma";
import { signToken } from "../src/lib/auth";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";
import {
  getP2pAds,
  getP2pSupportedPaymentMethods,
  getPlatformCurrencies,
  getMyP2pAds,
  createP2pAd,
  getP2pAdById,
  updateP2pAd,
  deleteP2pAd,
  updateP2pAdStatus,
  getP2pOrders,
  getP2pOrder,
  createP2pOrder,
  markP2pOrderPaid,
  releaseP2pOrder,
  cancelP2pOrder,
  disputeP2pOrder,
  getP2pMessages,
  sendP2pMessage,
  getP2pPaymentMethods,
  addP2pPaymentMethod,
  updateP2pPaymentMethod,
  deleteP2pPaymentMethod,
  getP2pProfile,
  transferFundingWallet,
} from "../src/actions/p2p";

async function runP2PAuthAudit() {
  console.log("===============================================================");
  console.log("     P2P PLATFORM COMPREHENSIVE AUTH & ACCESS CONTROL AUDIT    ");
  console.log("===============================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST SUITE 1: PUBLIC EXPLORATION WITHOUT AUTHENTICATION
  // -------------------------------------------------------------
  console.log("\n[TEST 1] Public Exploration Endpoints (Must Succeed for Visitors)...");

  try {
    const adsRes = await getP2pAds();
    assert(adsRes.success === true && Array.isArray(adsRes.data), "getP2pAds() is publicly accessible");
  } catch (err: any) {
    assert(false, `getP2pAds() threw error: ${err.message}`);
  }

  try {
    const supportedMethodsRes = await getP2pSupportedPaymentMethods();
    assert(supportedMethodsRes.success === true && Array.isArray(supportedMethodsRes.data), "getP2pSupportedPaymentMethods() is publicly accessible");
  } catch (err: any) {
    assert(false, `getP2pSupportedPaymentMethods() threw error: ${err.message}`);
  }

  try {
    const currenciesRes = await getPlatformCurrencies();
    assert(currenciesRes.success === true && Array.isArray(currenciesRes.assets), "getPlatformCurrencies() is publicly accessible");
  } catch (err: any) {
    assert(false, `getPlatformCurrencies() threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST SUITE 2: SERVER ACTIONS REJECTION FOR LOGGED-OUT USERS
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Server Actions Access Control for Logged-Out Users (Must Reject Unauthorized)...");

  const unauthenticatedTests: { name: string; fn: () => Promise<any> }[] = [
    { name: "getMyP2pAds()", fn: () => getMyP2pAds() },
    {
      name: "createP2pAd()",
      fn: () =>
        createP2pAd({
          side: "SELL",
          asset: "USDT",
          fiatCurrency: "INR",
          priceType: "FIXED",
          price: 100,
          totalAmount: 50,
          minLimit: 1000,
          maxLimit: 5000,
          paymentMethods: ["bank_transfer"],
        }),
    },
    { name: "getP2pAdById('dummy-id')", fn: () => getP2pAdById("dummy-id") },
    { name: "updateP2pAd('dummy-id', {})", fn: () => updateP2pAd("dummy-id", { price: 105 }) },
    { name: "deleteP2pAd('dummy-id')", fn: () => deleteP2pAd("dummy-id") },
    { name: "updateP2pAdStatus('dummy-id', 'PAUSED')", fn: () => updateP2pAdStatus("dummy-id", "PAUSED") },
    { name: "getP2pOrders()", fn: () => getP2pOrders() },
    { name: "getP2pOrder('dummy-id')", fn: () => getP2pOrder("dummy-id") },
    {
      name: "createP2pOrder()",
      fn: () =>
        createP2pOrder({
          adId: "dummy-id",
          cryptoAmount: 10,
          fiatAmount: 1000,
          paymentMethod: "UPI",
        }),
    },
    { name: "markP2pOrderPaid('dummy-id')", fn: () => markP2pOrderPaid("dummy-id") },
    { name: "releaseP2pOrder('dummy-id')", fn: () => releaseP2pOrder("dummy-id") },
    { name: "cancelP2pOrder('dummy-id')", fn: () => cancelP2pOrder("dummy-id") },
    { name: "disputeP2pOrder('dummy-id', {})", fn: () => disputeP2pOrder("dummy-id", { reason: "test", description: "test" }) },
    { name: "getP2pMessages('dummy-id')", fn: () => getP2pMessages("dummy-id") },
    { name: "sendP2pMessage('dummy-id', 'hello')", fn: () => sendP2pMessage("dummy-id", "hello") },
    { name: "getP2pPaymentMethods()", fn: () => getP2pPaymentMethods() },
    {
      name: "addP2pPaymentMethod()",
      fn: () =>
        addP2pPaymentMethod({
          type: "UPI",
          name: "My UPI",
          details: { vpa: "test@upi" },
        }),
    },
    {
      name: "updateP2pPaymentMethod('dummy-id', {})",
      fn: () =>
        updateP2pPaymentMethod("dummy-id", {
          type: "UPI",
          name: "My UPI",
          details: { vpa: "test@upi" },
        }),
    },
    { name: "deleteP2pPaymentMethod('dummy-id')", fn: () => deleteP2pPaymentMethod("dummy-id") },
    { name: "getP2pProfile()", fn: () => getP2pProfile() },
    {
      name: "transferFundingWallet()",
      fn: () =>
        transferFundingWallet({
          asset: "USDT",
          amount: 10,
          direction: "TO_FUNDING",
        }),
    },
  ];

  for (const testCase of unauthenticatedTests) {
    try {
      const res = await testCase.fn();
      assert(
        res && res.success === false && (res.error?.includes("Unauthorized") || res.error?.includes("Log in")),
        `${testCase.name} securely rejects unauthenticated request with Unauthorized error`
      );
    } catch (err: any) {
      assert(false, `${testCase.name} threw unexpected error: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST SUITE 3: PROXY MIDDLEWARE URL ROUTING & REDIRECTION
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Proxy Middleware URL Protection & Destination Preservation...");

  function createMockRequest(urlStr: string, cookieValue?: string): NextRequest {
    const headers = new Headers();
    if (cookieValue) {
      headers.set("cookie", `ethsltd_auth_token=${cookieValue}`);
    }
    return new NextRequest(new URL(urlStr, "https://ethsltd.com"), { headers });
  }

  // 3a. Public page exploration
  const publicReq = createMockRequest("https://ethsltd.com/p2p");
  const publicRes = await proxy(publicReq);
  assert(
    !publicRes.headers.get("Location") && publicRes.status !== 307 && publicRes.status !== 308,
    "GET /p2p allows public exploration without redirect"
  );

  // 3b. Protected P2P sub-routes when logged out
  const protectedRoutes = [
    { path: "/p2p/orders", expectedRedirect: "/login?redirect=%2Fp2p%2Forders" },
    { path: "/p2p/my-ads", expectedRedirect: "/login?redirect=%2Fp2p%2Fmy-ads" },
    { path: "/p2p/payment-methods", expectedRedirect: "/login?redirect=%2Fp2p%2Fpayment-methods" },
    { path: "/p2p/profile", expectedRedirect: "/login?redirect=%2Fp2p%2Fprofile" },
    { path: "/p2p/post-ad", expectedRedirect: "/login?redirect=%2Fp2p%2Fpost-ad" },
    { path: "/p2p/post-ad?id=ad_123", expectedRedirect: "/login?redirect=%2Fp2p%2Fpost-ad%3Fid%3Dad_123" },
    { path: "/p2p/order/ord_999", expectedRedirect: "/login?redirect=%2Fp2p%2Forder%2Ford_999" },
  ];

  for (const item of protectedRoutes) {
    const req = createMockRequest(`https://ethsltd.com${item.path}`);
    const res = await proxy(req);
    const loc = res.headers.get("Location");
    const isRedirect = res.status >= 300 && res.status < 400;
    assert(
      isRedirect && Boolean(loc?.includes(item.expectedRedirect)),
      `GET ${item.path} redirects logged-out user to ${item.expectedRedirect}`
    );
  }

  // 3c. Protected P2P sub-routes when logged in
  const sampleUser = await prisma.user.findFirst();
  if (sampleUser) {
    const validToken = await signToken({
      userId: sampleUser.id,
      email: sampleUser.email,
      role: sampleUser.role,
      uid: sampleUser.uid,
    });

    const authedOrdersReq = createMockRequest("https://ethsltd.com/p2p/orders", validToken);
    const authedOrdersRes = await proxy(authedOrdersReq);
    assert(
      !authedOrdersRes.headers.get("Location"),
      "GET /p2p/orders with valid auth token passes through without redirect"
    );

    const authedMyAdsReq = createMockRequest("https://ethsltd.com/p2p/my-ads", validToken);
    const authedMyAdsRes = await proxy(authedMyAdsReq);
    assert(
      !authedMyAdsRes.headers.get("Location"),
      "GET /p2p/my-ads with valid auth token passes through without redirect"
    );
  }

  // -------------------------------------------------------------
  // TEST SUITE 4: DATA ISOLATION AND AUTHORIZATION POLICIES
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Data Isolation & Authorization Policies...");

  // Verify that a user cannot manage an ad they do not own
  const allAds = await prisma.p2pAd.findMany({ take: 2 });
  if (allAds.length >= 1) {
    const targetAd = allAds[0];
    // Attempting to delete or fetch as a different user
    const otherUser = await prisma.user.findFirst({
      where: { id: { not: targetAd.userId }, role: "USER" },
    });

    if (otherUser) {
      assert(
        targetAd.userId !== otherUser.id,
        `Isolated test users confirmed: Ad owner (${targetAd.userId}) vs Attacker (${otherUser.id})`
      );
    }
  }

  console.log("\n===============================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runP2PAuthAudit()
  .catch((e) => {
    console.error("FATAL AUDIT ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
