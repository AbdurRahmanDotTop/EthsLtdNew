import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Short cache to avoid hitting external APIs on every single client polling tick
let cachedTickers: Record<string, { price: string; changePercent: string; high: string; low: string }> = {};
let lastFetchTime = 0;
const CACHE_TTL_MS = 2500; // 2.5 seconds cache

export async function GET() {
  try {
    const now = Date.now();

    if (now - lastFetchTime < CACHE_TTL_MS && Object.keys(cachedTickers).length > 0) {
      return NextResponse.json({ success: true, tickers: cachedTickers, cached: true });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    let fetchedMap: Record<string, { price: string; changePercent: string; high: string; low: string }> = {};

    // 1. Try MEXC first (extremely reliable on Cloudflare Workers edge network)
    try {
      const res = await fetch("https://api.mexc.com/api/v3/ticker/24hr", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            const pctVal = parseFloat(item.priceChangePercent || "0") * 100;
            const formattedPct = (pctVal >= 0 ? "+" : "") + pctVal.toFixed(2) + "%";
            fetchedMap[item.symbol] = {
              price: item.lastPrice || "0",
              changePercent: formattedPct,
              high: item.highPrice || item.lastPrice || "0",
              low: item.lowPrice || item.lastPrice || "0",
            };
          }
        }
      }
    } catch {
      // Fallback below
    }

    // 2. Fallback to Binance if MEXC failed
    if (Object.keys(fetchedMap).length === 0) {
      try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/24hr", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            for (const item of data) {
              const pctVal = parseFloat(item.priceChangePercent || "0");
              const formattedPct = (pctVal >= 0 ? "+" : "") + pctVal.toFixed(2) + "%";
              fetchedMap[item.symbol] = {
                price: item.lastPrice || "0",
                changePercent: formattedPct,
                high: item.highPrice || "0",
                low: item.lowPrice || "0",
              };
            }
          }
        }
      } catch {
        // Suppress fallback error
      }
    }

    clearTimeout(timeoutId);

    if (Object.keys(fetchedMap).length > 0) {
      cachedTickers = fetchedMap;
      lastFetchTime = now;
    }

    return NextResponse.json({
      success: true,
      tickers: cachedTickers,
      lastUpdated: new Date(lastFetchTime).toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load tickers" },
      { status: 500 }
    );
  }
}
