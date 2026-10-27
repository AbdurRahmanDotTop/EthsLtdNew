"use server";

import prisma, { DBMarketWhereInput, DBMarketUpdateInput } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function safeRevalidate(path: string) {
  invalidateMarketsCache();
  try {
    revalidatePath(path);
  } catch {
    // Suppress outside request context
  }
}

async function verifyAdmin() {
  const currentUser = await getCurrentUser();
  if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN")) {
    throw new Error("Unauthorized: Admin privileges required.");
  }
  return currentUser;
}

// Production default markets seeded if table is empty
const DEFAULT_MARKETS = [
  // Top 3 Tickers (Homepage Top Banners)
  {
    symbol: "BTC/USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    displayName: "Bitcoin",
    binanceSymbol: "BTCUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 2,
    qtyPrecision: 4,
    minOrderQty: 0.0001,
    maxOrderQty: 100,
    minMargin: 1.0,
    maxLeverage: 100,
    payoutRate: 1.8,
    isListedOnHome: false,
    isTopTicker: true,
    displayOrder: 1,
  },
  {
    symbol: "ETH/USDT",
    baseAsset: "ETH",
    quoteAsset: "USDT",
    displayName: "Ethereum",
    binanceSymbol: "ETHUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 2,
    qtyPrecision: 4,
    minOrderQty: 0.001,
    maxOrderQty: 1000,
    minMargin: 1.0,
    maxLeverage: 100,
    payoutRate: 1.8,
    isListedOnHome: false,
    isTopTicker: true,
    displayOrder: 2,
  },
  {
    symbol: "XRP/USDT",
    baseAsset: "XRP",
    quoteAsset: "USDT",
    displayName: "Ripple",
    binanceSymbol: "XRPUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 4,
    qtyPrecision: 2,
    minOrderQty: 1.0,
    maxOrderQty: 1000000,
    minMargin: 1.0,
    maxLeverage: 50,
    payoutRate: 1.8,
    isListedOnHome: false,
    isTopTicker: true,
    displayOrder: 3,
  },
  // Switch Market Pairs (Trade / Options Fast Switch Bar)
  {
    symbol: "SOL/USDT",
    baseAsset: "SOL",
    quoteAsset: "USDT",
    displayName: "Solana",
    binanceSymbol: "SOLUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 2,
    qtyPrecision: 3,
    minOrderQty: 0.01,
    maxOrderQty: 10000,
    minMargin: 1.0,
    maxLeverage: 50,
    payoutRate: 1.8,
    isListedOnHome: false,
    isTopTicker: false,
    displayOrder: 4,
  },
  {
    symbol: "DOGE/USDT",
    baseAsset: "DOGE",
    quoteAsset: "USDT",
    displayName: "Dogecoin",
    binanceSymbol: "DOGEUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 5,
    qtyPrecision: 1,
    minOrderQty: 10.0,
    maxOrderQty: 5000000,
    minMargin: 1.0,
    maxLeverage: 50,
    payoutRate: 1.8,
    isListedOnHome: false,
    isTopTicker: false,
    displayOrder: 5,
  },
  // Homepage Gainers / Listings (from user screenshot)
  {
    symbol: "TRX/USDT",
    baseAsset: "TRX",
    quoteAsset: "USDT",
    displayName: "TRON",
    binanceSymbol: "TRXUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 5,
    qtyPrecision: 1,
    minOrderQty: 10.0,
    maxOrderQty: 10000000,
    minMargin: 1.0,
    maxLeverage: 50,
    payoutRate: 1.8,
    isListedOnHome: true,
    isTopTicker: false,
    displayOrder: 6,
  },
  {
    symbol: "QTUM/USDT",
    baseAsset: "QTUM",
    quoteAsset: "USDT",
    displayName: "Qtum",
    binanceSymbol: "QTUMUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 4,
    qtyPrecision: 2,
    minOrderQty: 1.0,
    maxOrderQty: 500000,
    minMargin: 1.0,
    maxLeverage: 50,
    payoutRate: 1.8,
    isListedOnHome: true,
    isTopTicker: false,
    displayOrder: 7,
  },
  {
    symbol: "GT/USDT",
    baseAsset: "GT",
    quoteAsset: "USDT",
    displayName: "GateToken",
    binanceSymbol: "ETCUSDT", // Mapped fallback on Binance
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 4,
    qtyPrecision: 2,
    minOrderQty: 1.0,
    maxOrderQty: 100000,
    minMargin: 1.0,
    maxLeverage: 20,
    payoutRate: 1.8,
    isListedOnHome: true,
    isTopTicker: false,
    displayOrder: 8,
  },
  {
    symbol: "ETC/USDT",
    baseAsset: "ETC",
    quoteAsset: "USDT",
    displayName: "Ethereum Classic",
    binanceSymbol: "ETCUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 4,
    qtyPrecision: 2,
    minOrderQty: 0.1,
    maxOrderQty: 100000,
    minMargin: 1.0,
    maxLeverage: 50,
    payoutRate: 1.8,
    isListedOnHome: true,
    isTopTicker: false,
    displayOrder: 9,
  },
  {
    symbol: "NEO/USDT",
    baseAsset: "NEO",
    quoteAsset: "USDT",
    displayName: "NEO",
    binanceSymbol: "NEOUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 4,
    qtyPrecision: 2,
    minOrderQty: 0.1,
    maxOrderQty: 100000,
    minMargin: 1.0,
    maxLeverage: 50,
    payoutRate: 1.8,
    isListedOnHome: true,
    isTopTicker: false,
    displayOrder: 10,
  },
  {
    symbol: "DOT/USDT",
    baseAsset: "DOT",
    quoteAsset: "USDT",
    displayName: "Polkadot",
    binanceSymbol: "DOTUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 4,
    qtyPrecision: 2,
    minOrderQty: 0.1,
    maxOrderQty: 100000,
    minMargin: 1.0,
    maxLeverage: 50,
    payoutRate: 1.8,
    isListedOnHome: true,
    isTopTicker: false,
    displayOrder: 11,
  },
  {
    symbol: "LINK/USDT",
    baseAsset: "LINK",
    quoteAsset: "USDT",
    displayName: "Chainlink",
    binanceSymbol: "LINKUSDT",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 4,
    qtyPrecision: 2,
    minOrderQty: 0.1,
    maxOrderQty: 100000,
    minMargin: 1.0,
    maxLeverage: 50,
    payoutRate: 1.8,
    isListedOnHome: true,
    isTopTicker: false,
    displayOrder: 12,
  },
];

const DEFAULT_HOMEPAGE_MARKETS = {
  topTickers: DEFAULT_MARKETS.filter((m) => m.isTopTicker),
  homeListings: DEFAULT_MARKETS.filter((m) => m.isListedOnHome),
};

// Edge in-memory cache pre-warmed to guarantee zero cold-start overhead
let cachedHomepageMarkets: { topTickers: any[]; homeListings: any[] } = DEFAULT_HOMEPAGE_MARKETS;
let lastHomepageFetch = Date.now();
const MARKETS_CACHE_TTL = 120000; // 2 minutes
let isFetchingHomepageMarkets = false;

const cachedActiveMarkets: Record<string, any[] | undefined> = {};
const lastActiveMarketsFetch: Record<string, number | undefined> = {};

let marketsSeededChecked = true;

export async function invalidateMarketsCache() {
  cachedHomepageMarkets = DEFAULT_HOMEPAGE_MARKETS;
  lastHomepageFetch = 0;
  for (const k of Object.keys(cachedActiveMarkets)) {
    delete cachedActiveMarkets[k];
    delete lastActiveMarketsFetch[k];
  }
}

/**
 * Auto-seeds default production markets if table is empty (runs at most once)
 */
export async function seedDefaultMarketsIfEmpty() {
  if (marketsSeededChecked) return;
  try {
    const count = await prisma.market.count();
    if (count === 0) {
      for (const m of DEFAULT_MARKETS) {
        await prisma.market.create({ data: m });
      }
    }
    marketsSeededChecked = true;
  } catch {
    // Non-fatal
  }
}

/**
 * Public: Get active markets for trade/options pages
 */
export async function getActiveMarkets(tradingMode: string = "ALL") {
  const cacheKey = tradingMode.toUpperCase();
  const now = Date.now();

  if (cachedActiveMarkets[cacheKey] && now - (lastActiveMarketsFetch[cacheKey] || 0) < MARKETS_CACHE_TTL) {
    return cachedActiveMarkets[cacheKey];
  }

  try {
    const where: DBMarketWhereInput = { status: "ACTIVE" };
    if (tradingMode && tradingMode !== "ALL") {
      where.OR = [
        { tradingModes: "ALL" },
        { tradingModes: tradingMode.toUpperCase() },
      ];
    }

    const markets = await prisma.market.findMany({
      where,
      orderBy: { displayOrder: "asc" },
    });

    if (markets.length > 0) {
      cachedActiveMarkets[cacheKey] = markets;
      lastActiveMarketsFetch[cacheKey] = now;
      return markets;
    }

    // If empty, fallback to default markets filtered by mode
    const fallback = DEFAULT_MARKETS.filter(
      (m) => m.status === "ACTIVE" && (m.tradingModes === "ALL" || m.tradingModes === tradingMode.toUpperCase())
    );
    cachedActiveMarkets[cacheKey] = fallback;
    lastActiveMarketsFetch[cacheKey] = now;
    return fallback;
  } catch (err: unknown) {
    console.error("getActiveMarkets Error:", err);
    return DEFAULT_MARKETS.filter(
      (m) => m.status === "ACTIVE" && (m.tradingModes === "ALL" || m.tradingModes === tradingMode.toUpperCase())
    );
  }
}

/**
 * Public: Get homepage markets (top tickers and gainers/listings)
 */
export async function getHomepageMarkets() {
  const now = Date.now();
  if (cachedHomepageMarkets && (now - lastHomepageFetch < MARKETS_CACHE_TTL || isFetchingHomepageMarkets)) {
    return cachedHomepageMarkets;
  }

  isFetchingHomepageMarkets = true;
  try {
    const [topTickers, homeListings] = await Promise.all([
      prisma.market.findMany({
        where: { isTopTicker: true, status: "ACTIVE" },
        orderBy: { displayOrder: "asc" },
        take: 3,
      }),
      prisma.market.findMany({
        where: { isListedOnHome: true, status: "ACTIVE" },
        orderBy: { displayOrder: "asc" },
      }),
    ]);

    if (topTickers.length > 0 || homeListings.length > 0) {
      cachedHomepageMarkets = { topTickers, homeListings };
      lastHomepageFetch = now;
      return cachedHomepageMarkets;
    }

    // Fallback in-memory defaults
    const fallback = {
      topTickers: DEFAULT_MARKETS.filter((m) => m.isTopTicker),
      homeListings: DEFAULT_MARKETS.filter((m) => m.isListedOnHome),
    };
    cachedHomepageMarkets = fallback;
    lastHomepageFetch = now;
    return fallback;
  } catch (err: unknown) {
    console.error("getHomepageMarkets Error:", err);
    return {
      topTickers: DEFAULT_MARKETS.filter((m) => m.isTopTicker),
      homeListings: DEFAULT_MARKETS.filter((m) => m.isListedOnHome),
    };
  } finally {
    isFetchingHomepageMarkets = false;
  }
}

/**
 * Admin: Get all markets (including Inactive / Suspended)
 */
export async function getAllMarketsAdmin() {
  await verifyAdmin();
  await seedDefaultMarketsIfEmpty();

  return prisma.market.findMany({
    orderBy: { displayOrder: "asc" },
  });
}

/**
 * Admin: Create a new trading market
 */
export async function createMarket(data: {
  symbol: string;
  baseAsset: string;
  quoteAsset?: string;
  displayName: string;
  binanceSymbol: string;
  category?: string;
  tradingModes?: string;
  status?: string;
  pricePrecision?: number;
  qtyPrecision?: number;
  minOrderQty?: number;
  maxOrderQty?: number;
  minMargin?: number;
  maxLeverage?: number;
  payoutRate?: number;
  isListedOnHome?: boolean;
  isTopTicker?: boolean;
  displayOrder?: number;
}) {
  const admin = await verifyAdmin();

  const formattedSymbol = data.symbol.trim().toUpperCase();
  const existing = await prisma.market.findUnique({
    where: { symbol: formattedSymbol },
  });

  if (existing) {
    return { success: false, error: `Market with symbol "${formattedSymbol}" already exists.` };
  }

  const highest = await prisma.market.findFirst({
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  const nextOrder = (highest?.displayOrder ?? 0) + 1;

  const market = await prisma.market.create({
    data: {
      symbol: formattedSymbol,
      baseAsset: data.baseAsset.trim().toUpperCase(),
      quoteAsset: (data.quoteAsset || "USDT").trim().toUpperCase(),
      displayName: data.displayName.trim(),
      binanceSymbol: data.binanceSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
      category: data.category || "CRYPTO",
      tradingModes: data.tradingModes || "ALL",
      status: data.status || "ACTIVE",
      pricePrecision: data.pricePrecision ?? 2,
      qtyPrecision: data.qtyPrecision ?? 4,
      minOrderQty: data.minOrderQty ?? 0.001,
      maxOrderQty: data.maxOrderQty ?? 1000000,
      minMargin: data.minMargin ?? 1.0,
      maxLeverage: data.maxLeverage ?? 100,
      payoutRate: data.payoutRate ?? 1.8,
      isListedOnHome: data.isListedOnHome ?? true,
      isTopTicker: data.isTopTicker ?? false,
      displayOrder: data.displayOrder ?? nextOrder,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "MARKET_CREATED",
      targetType: "MARKET",
      targetId: market.id,
      details: `Created market ${market.symbol} (${market.displayName})`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/trade");
  safeRevalidate("/options");
  safeRevalidate("/admin/markets");

  return { success: true, market };
}

/**
 * Admin: Update an existing market
 */
export async function updateMarket(
  id: string,
  data: {
    symbol?: string;
    baseAsset?: string;
    quoteAsset?: string;
    displayName?: string;
    binanceSymbol?: string;
    category?: string;
    tradingModes?: string;
    status?: string;
    pricePrecision?: number;
    qtyPrecision?: number;
    minOrderQty?: number;
    maxOrderQty?: number;
    minMargin?: number;
    maxLeverage?: number;
    payoutRate?: number;
    isListedOnHome?: boolean;
    isTopTicker?: boolean;
    displayOrder?: number;
  }
) {
  const admin = await verifyAdmin();

  const current = await prisma.market.findUnique({ where: { id } });
  if (!current) {
    return { success: false, error: "Market not found." };
  }

  const updateData: DBMarketUpdateInput = {};
  if (data.symbol) updateData.symbol = data.symbol.trim().toUpperCase();
  if (data.baseAsset) updateData.baseAsset = data.baseAsset.trim().toUpperCase();
  if (data.quoteAsset) updateData.quoteAsset = data.quoteAsset.trim().toUpperCase();
  if (data.displayName) updateData.displayName = data.displayName.trim();
  if (data.binanceSymbol) updateData.binanceSymbol = data.binanceSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (data.category !== undefined) updateData.category = data.category;
  if (data.tradingModes !== undefined) updateData.tradingModes = data.tradingModes;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.pricePrecision !== undefined) updateData.pricePrecision = Number(data.pricePrecision);
  if (data.qtyPrecision !== undefined) updateData.qtyPrecision = Number(data.qtyPrecision);
  if (data.minOrderQty !== undefined) updateData.minOrderQty = Number(data.minOrderQty);
  if (data.maxOrderQty !== undefined) updateData.maxOrderQty = Number(data.maxOrderQty);
  if (data.minMargin !== undefined) updateData.minMargin = Number(data.minMargin);
  if (data.maxLeverage !== undefined) updateData.maxLeverage = Number(data.maxLeverage);
  if (data.payoutRate !== undefined) updateData.payoutRate = Number(data.payoutRate);
  if (data.isListedOnHome !== undefined) updateData.isListedOnHome = Boolean(data.isListedOnHome);
  if (data.isTopTicker !== undefined) updateData.isTopTicker = Boolean(data.isTopTicker);
  if (data.displayOrder !== undefined) updateData.displayOrder = Number(data.displayOrder);

  const updated = await prisma.market.update({
    where: { id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "MARKET_UPDATED",
      targetType: "MARKET",
      targetId: id,
      details: `Updated market ${updated.symbol}: ${JSON.stringify(data)}`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/trade");
  safeRevalidate("/options");
  safeRevalidate("/admin/markets");

  return { success: true, market: updated };
}

/**
 * Admin: Delete or Archive a market
 * If historical orders exist with this market's symbol, archive/delist to protect financial integrity!
 */
export async function deleteMarket(id: string) {
  const admin = await verifyAdmin();

  const market = await prisma.market.findUnique({ where: { id } });
  if (!market) {
    return { success: false, error: "Market not found." };
  }

  // Check if historical orders reference this symbol
  const existingOrdersCount = await prisma.order.count({
    where: { symbol: market.symbol },
  });

  if (existingOrdersCount > 0) {
    // Soft-delete / Delist to protect order history and financial reports
    await prisma.market.update({
      where: { id },
      data: { status: "DELISTED", isListedOnHome: false, isTopTicker: false },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: "MARKET_ARCHIVED",
        targetType: "MARKET",
        targetId: id,
        details: `Market ${market.symbol} delisted/archived due to ${existingOrdersCount} existing trade orders`,
      },
    });

    safeRevalidate("/");
    safeRevalidate("/trade");
    safeRevalidate("/options");
    safeRevalidate("/admin/markets");

    return {
      success: true,
      archived: true,
      message: `Market ${market.symbol} has ${existingOrdersCount} linked orders and was safely archived (Delisted).`,
    };
  }

  // Safe to hard delete if no orders reference it
  await prisma.market.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "MARKET_DELETED",
      targetType: "MARKET",
      targetId: id,
      details: `Deleted market ${market.symbol}`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/trade");
  safeRevalidate("/options");
  safeRevalidate("/admin/markets");

  return { success: true, message: `Market ${market.symbol} deleted successfully.` };
}

/**
 * Admin: Toggle Active / Inactive status
 */
export async function toggleMarketStatus(id: string) {
  const admin = await verifyAdmin();

  const market = await prisma.market.findUnique({ where: { id } });
  if (!market) return { success: false, error: "Market not found." };

  const newStatus = market.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  const updated = await prisma.market.update({
    where: { id },
    data: { status: newStatus },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "MARKET_STATUS_TOGGLED",
      targetType: "MARKET",
      targetId: id,
      details: `Changed status of ${market.symbol} to ${newStatus}`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/trade");
  safeRevalidate("/options");
  safeRevalidate("/admin/markets");

  return { success: true, market: updated };
}

/**
 * Admin: Toggle Home Listing visibility
 */
export async function toggleMarketHomeListing(id: string) {
  const admin = await verifyAdmin();

  const market = await prisma.market.findUnique({ where: { id } });
  if (!market) return { success: false, error: "Market not found." };

  const updated = await prisma.market.update({
    where: { id },
    data: { isListedOnHome: !market.isListedOnHome },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "MARKET_HOME_VISIBILITY_TOGGLED",
      targetType: "MARKET",
      targetId: id,
      details: `Toggled home listing for ${market.symbol} to ${updated.isListedOnHome}`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/admin/markets");

  return { success: true, market: updated };
}

/**
 * Admin: Reorder markets
 */
export async function reorderMarkets(orderedIds: string[]) {
  const admin = await verifyAdmin();

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.market.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "MARKETS_REORDERED",
      targetType: "MARKET",
      targetId: "BULK",
      details: `Reordered ${orderedIds.length} markets`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/trade");
  safeRevalidate("/options");
  safeRevalidate("/admin/markets");

  return { success: true };
}
