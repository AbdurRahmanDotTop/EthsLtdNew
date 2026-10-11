import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Short cache to avoid hitting Binance on every single client polling tick
let cachedTickers: Record<string, { price: string; changePercent: string; high: string; low: string }> = {};
let lastFetchTime = 0;
const CACHE_TTL_MS = 2500; // 2.5 seconds cache

export async function GET() {
  try {
    const now = Date.now();

    if (now - lastFetchTime < CACHE_TTL_MS && Object.keys(cachedTickers).length > 0) {
      return NextResponse.json({ success: true, tickers: cachedTickers, cached: true });
    }

    // Fetch from Binance public 24hr ticker API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/24hr", {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const map: Record<string, { price: string; changePercent: string; high: string; low: string }> = {};
          for (const item of data) {
            map[item.symbol] = {
              price: item.lastPrice,
              changePercent: parseFloat(item.priceChangePercent).toFixed(2) + "%",
              high: item.highPrice,
              low: item.lowPrice,
            };
          }
          cachedTickers = map;
          lastFetchTime = now;
        }
      }
    } catch (fetchErr) {
      // If Binance fetch fails/times out, use cachedTickers
      console.warn("Binance ticker fetch failed, using stale cache:", fetchErr);
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
