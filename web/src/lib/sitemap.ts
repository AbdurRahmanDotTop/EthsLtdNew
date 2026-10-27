import prisma from "@/lib/prisma";
import { getAppUrlSync } from "@/lib/app-url";

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
  category: "core" | "trading" | "options" | "asset" | "auth" | "advisory";
}

export const BASE_SITE_URL = getAppUrlSync();

export async function fetchEligibleSitemapEntries(baseUrl: string = BASE_SITE_URL): Promise<SitemapEntry[]> {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const nowIso = new Date().toISOString();

  const entries: SitemapEntry[] = [
    // 1. Primary Public Core Pages
    {
      loc: `${cleanBase}/`,
      lastmod: nowIso,
      changefreq: "daily",
      priority: 1.0,
      category: "core",
    },
    {
      loc: `${cleanBase}/trade`,
      lastmod: nowIso,
      changefreq: "always",
      priority: 0.9,
      category: "trading",
    },
    {
      loc: `${cleanBase}/options`,
      lastmod: nowIso,
      changefreq: "always",
      priority: 0.9,
      category: "options",
    },
    {
      loc: `${cleanBase}/p2p`,
      lastmod: nowIso,
      changefreq: "hourly",
      priority: 0.8,
      category: "core",
    },
    {
      loc: `${cleanBase}/trust`,
      lastmod: nowIso,
      changefreq: "weekly",
      priority: 0.8,
      category: "core",
    },
    {
      loc: `${cleanBase}/relationship-managers`,
      lastmod: nowIso,
      changefreq: "weekly",
      priority: 0.7,
      category: "advisory",
    },

    // 2. Authentication & Recovery Entrypoints (Public)
    {
      loc: `${cleanBase}/login`,
      lastmod: nowIso,
      changefreq: "monthly",
      priority: 0.6,
      category: "auth",
    },
    {
      loc: `${cleanBase}/register`,
      lastmod: nowIso,
      changefreq: "monthly",
      priority: 0.7,
      category: "auth",
    },
    {
      loc: `${cleanBase}/forgot-password`,
      lastmod: nowIso,
      changefreq: "monthly",
      priority: 0.3,
      category: "auth",
    },
    {
      loc: `${cleanBase}/forgot-pin`,
      lastmod: nowIso,
      changefreq: "monthly",
      priority: 0.3,
      category: "auth",
    },
  ];

  // 3. Dynamic Active Markets (Spot & Perpetual & Option pairs)
  try {
    const markets = await prisma.market.findMany({
      where: { status: "ACTIVE" },
      select: {
        symbol: true,
        displayName: true,
        tradingModes: true,
        updatedAt: true,
      },
      orderBy: { displayOrder: "asc" },
    });

    for (const m of markets) {
      const marketLastMod = m.updatedAt ? new Date(m.updatedAt).toISOString() : nowIso;
      const encodedSymbol = encodeURIComponent(m.symbol);

      // Perpetual / Trade Page entry
      if (m.tradingModes === "ALL" || m.tradingModes === "PERPETUAL") {
        entries.push({
          loc: `${cleanBase}/trade?symbol=${encodedSymbol}`,
          lastmod: marketLastMod,
          changefreq: "hourly",
          priority: 0.8,
          category: "trading",
        });
      }

      // Options Page entry
      if (m.tradingModes === "ALL" || m.tradingModes === "OPTION") {
        entries.push({
          loc: `${cleanBase}/options?symbol=${encodedSymbol}`,
          lastmod: marketLastMod,
          changefreq: "hourly",
          priority: 0.8,
          category: "options",
        });
      }
    }
  } catch (err) {
    console.warn("fetchEligibleSitemapEntries: markets query fallback:", err);
  }

  // 4. Dynamic Active Crypto Assets
  try {
    const assets = await prisma.cryptoAsset.findMany({
      where: { isActive: true },
      select: {
        symbol: true,
        updatedAt: true,
      },
      orderBy: { displayOrder: "asc" },
    });

    for (const a of assets) {
      const assetLastMod = a.updatedAt ? new Date(a.updatedAt).toISOString() : nowIso;
      entries.push({
        loc: `${cleanBase}/trade?asset=${encodeURIComponent(a.symbol)}`,
        lastmod: assetLastMod,
        changefreq: "daily",
        priority: 0.7,
        category: "asset",
      });
    }
  } catch (err) {
    console.warn("fetchEligibleSitemapEntries: cryptoAsset query fallback:", err);
  }

  return entries;
}

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urlsXml = entries
    .map(
      (item) => `  <url>
    <loc>${item.loc}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority.toFixed(1)}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlsXml}
</urlset>`;
}
