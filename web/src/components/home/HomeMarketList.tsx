"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCryptoPrice } from "@/hooks/useMarketData";

interface MarketItem {
  id: string;
  symbol: string;
  displayName: string;
  binanceSymbol: string;
  pricePrecision: number;
  status: string;
}

interface HomeMarketListProps {
  topTickers: MarketItem[];
  homeListings: MarketItem[];
  children?: React.ReactNode;
}

export default function HomeMarketList({
  topTickers,
  homeListings,
  children,
}: HomeMarketListProps) {
  const router = useRouter();
  const [tickers, setTickers] = useState<Record<string, { price: string; changePercent: string }>>({});

  // Fetch real-time tickers from live backend API (Binance connected)
  useEffect(() => {
    let isDisposed = false;
    let inFlight = false;

    const fetchLiveTickers = async () => {
      if (document.hidden || inFlight || isDisposed) return;
      inFlight = true;
      try {
        const res = await fetch("/api/markets/tickers");
        if (!res.ok) return;
        const data = (await res.json()) as any;
        if (data.success && data.tickers && !isDisposed) {
          setTickers(data.tickers);
        }
      } catch {
        // Suppress background poll error
      } finally {
        inFlight = false;
      }
    };

    fetchLiveTickers();
    const interval = setInterval(fetchLiveTickers, 6000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLiveTickers();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const getTickerData = (market: MarketItem) => {
    const live = tickers[market.binanceSymbol];
    if (live) {
      const numPrice = parseFloat(live.price);
      return {
        price: formatCryptoPrice(numPrice, market.pricePrecision),
        change: live.changePercent,
        isPositive: !live.changePercent.startsWith("-"),
      };
    }
    // Fallback while loading
    return {
      price: "--",
      change: "--",
      isPositive: true,
    };
  };

  return (
    <>
      {/* Top 3 Tickers Horizontal Cards */}
      <div className="flex justify-between px-4 py-4 overflow-x-auto hide-scrollbar gap-2">
        {topTickers.map((ticker) => {
          const data = getTickerData(ticker);
          return (
            <Link
              key={ticker.id}
              href={`/trade?symbol=${ticker.binanceSymbol}`}
              className="flex flex-col flex-1 min-w-[100px] items-center justify-center bg-[#1A1C24] hover:bg-[#222530] p-3 rounded-lg border border-white/5 transition-all cursor-pointer group active:scale-95"
            >
              <span className="text-gray-400 group-hover:text-white text-xs font-medium transition-colors">
                {ticker.symbol}
              </span>
              <span className={`font-mono text-lg font-bold mt-1 ${data.isPositive ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                {data.price}
              </span>
              <span className={`text-xs font-semibold ${data.isPositive ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                {data.change}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Content Placed Above Gainers (Quick Actions) */}
      {children}

      {/* Gainers / Market Listing Section */}
      <div className="mt-4 px-4">
        <div className="flex items-center justify-center mb-6">
          <div className="h-px bg-gradient-to-r from-transparent via-[#00A070]/50 to-transparent flex-1" />
          <span className="px-4 text-[#00A070] font-bold text-sm tracking-wide">Gainers</span>
          <div className="h-px bg-gradient-to-r from-[#00A070]/50 via-[#00A070]/50 to-transparent flex-1" />
        </div>

        {/* Table Column Headers */}
        <div className="grid grid-cols-3 text-xs text-gray-500 mb-3 px-2 font-medium">
          <span>Pair</span>
          <span className="text-right">Latest Price</span>
          <span className="text-right">24H Change</span>
        </div>

        {/* Dynamic Markets List */}
        <div className="flex flex-col gap-2">
          {homeListings.map((market) => {
            const data = getTickerData(market);
            return (
              <div
                key={market.id}
                onClick={() => router.push(`/trade?symbol=${market.binanceSymbol}`)}
                className="grid grid-cols-3 items-center py-2.5 px-2 hover:bg-[#1A1C24] active:bg-[#20232e] rounded-lg transition-colors cursor-pointer group"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-white group-hover:text-[#00A070] text-sm transition-colors">
                    {market.symbol}
                  </span>
                  {market.displayName && (
                    <span className="text-[10px] text-gray-400 font-medium">
                      {market.displayName}
                    </span>
                  )}
                </div>

                <span className="text-right font-mono text-sm text-gray-200">
                  {data.price}
                </span>

                <div className="flex justify-end">
                  <span
                    className={`px-3 py-1.5 rounded text-xs font-bold w-[78px] text-center font-mono transition-transform group-hover:scale-105 ${
                      data.isPositive
                        ? "bg-[#00A070] text-white"
                        : "bg-[#F6465D] text-white"
                    }`}
                  >
                    {data.change}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
