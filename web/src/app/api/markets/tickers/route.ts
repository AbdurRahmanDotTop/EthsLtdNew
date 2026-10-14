import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Platforms supported active trading and display symbols
const TARGET_SYMBOLS = new Set([
  "BTCUSDT",
  "ETHUSDT",
  "XRPUSDT",
  "SOLUSDT",
  "DOGEUSDT",
  "TRXUSDT",
  "QTUMUSDT",
  "ETCUSDT",
  "NEOUSDT",
  "DOTUSDT",
  "LINKUSDT",
  "BNBUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "SUIUSDT",
]);

const TARGET_SYMBOLS_ARRAY = Array.from(TARGET_SYMBOLS);

// Resilient edge memory cache
let cachedTickers: Record<string, { price: string; changePercent: string; high: string; low: string }> = {};
let lastFetchTime = 0;
const CACHE_TTL_MS = 4000; // 4 seconds memory cache

export async function GET() {
  try {
    const now = Date.now();

    // Serve from edge memory cache if still fresh
    if (now - lastFetchTime < CACHE_TTL_MS && Object.keys(cachedTickers).length > 0) {
      return NextResponse.json(
        { success: true, tickers: cachedTickers, cached: true },
        {
          headers: {
            "Cache-Control": "public, max-age=3, s-maxage=5, stale-while-revalidate=15",
          },
        }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const fetchedMap: Record<string, { price: string; changePercent: string; high: string; low: string }> = {};

    // 1. Try Binance batch endpoint first (returns ONLY requested symbols, tiny ~2KB payload, minimal CPU)
    try {
      const symbolsParam = encodeURIComponent(JSON.stringify(TARGET_SYMBOLS_ARRAY));
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            if (!item || !item.symbol) continue;
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
      // Fallback below
    }

    // 2. Fallback to MEXC if Binance failed (filter strictly during loop to avoid CPU & memory bloat)
    if (Object.keys(fetchedMap).length === 0) {
      try {
        const res = await fetch("https://api.mexc.com/api/v3/ticker/24hr", {
          signal: controller.signal,
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            for (const item of data) {
              if (!item || !item.symbol || !TARGET_SYMBOLS.has(item.symbol)) continue;
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
        // Suppress error and use cached fallback
      }
    }

    clearTimeout(timeoutId);

    // Update cache if new data obtained
    if (Object.keys(fetchedMap).length > 0) {
      cachedTickers = fetchedMap;
      lastFetchTime = now;
    }

    return NextResponse.json(
      {
        success: true,
        tickers: cachedTickers,
        lastUpdated: new Date(lastFetchTime).toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3, s-maxage=5, stale-while-revalidate=15",
        },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load tickers";
    // If cache exists, return stale cache instead of 500 error
    if (Object.keys(cachedTickers).length > 0) {
      return NextResponse.json(
        { success: true, tickers: cachedTickers, stale: true },
        {
          headers: {
            "Cache-Control": "public, max-age=2, s-maxage=3",
          },
        }
      );
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
