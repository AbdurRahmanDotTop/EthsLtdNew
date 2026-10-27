"use client";

import React, { useEffect, useRef, useState } from "react";

import { formatCryptoPrice } from "@/hooks/useMarketData";

interface OrderBookProps {
  symbol: string;
  currentPrice: number;
  precision?: number;
}

interface DepthLevel {
  price: string;
  qty: string;
}

export default function OrderBook({ symbol, currentPrice, precision }: OrderBookProps) {
  const [asks, setAsks] = useState<DepthLevel[]>([]);
  const [bids, setBids] = useState<DepthLevel[]>([]);
  const prevPriceRef = useRef<number>(currentPrice);
  const isUp = currentPrice >= prevPriceRef.current;

  useEffect(() => {
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  useEffect(() => {
    let isDisposed = false;
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const lowerSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
    const upperSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Initial fetch from Binance REST API for depth
    const fetchDepth = async () => {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/depth?symbol=${upperSymbol}&limit=6`
        );
        if (!res.ok) return;
        const data = (await res.json()) as any;
        if (data.asks && data.bids && !isDisposed) {
          setAsks(
            data.asks.slice(0, 5).reverse().map((a: string[]) => ({
              price: formatCryptoPrice(parseFloat(a[0]), precision),
              qty: parseFloat(a[1]).toFixed(2),
            }))
          );
          setBids(
            data.bids.slice(0, 5).map((b: string[]) => ({
              price: formatCryptoPrice(parseFloat(b[0]), precision),
              qty: parseFloat(b[1]).toFixed(2),
            }))
          );
        }
      } catch {
        // silent catch
      }
    };

    fetchDepth();

    // Fallback polling helper
    const startPolling = () => {
      if (pollInterval || isDisposed) return;
      pollInterval = setInterval(() => {
        if (!document.hidden) {
          fetchDepth();
        }
      }, 4000);
    };

    // WebSocket for continuous live depth
    try {
      ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${lowerSymbol}@depth5@1000ms`
      );

      ws.onmessage = (event) => {
        if (isDisposed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.asks && data.bids) {
            setAsks(
              data.asks.slice(0, 5).reverse().map((a: string[]) => ({
                price: formatCryptoPrice(parseFloat(a[0]), precision),
                qty: parseFloat(a[1]).toFixed(2),
              }))
            );
            setBids(
              data.bids.slice(0, 5).map((b: string[]) => ({
                price: formatCryptoPrice(parseFloat(b[0]), precision),
                qty: parseFloat(b[1]).toFixed(2),
              }))
            );
          }
        } catch {
          // ignore parsing
        }
      };

      ws.onerror = () => {
        startPolling();
      };

      ws.onclose = () => {
        if (!isDisposed) {
          startPolling();
        }
      };
    } catch {
      startPolling();
    }

    return () => {
      isDisposed = true;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (ws) {
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.close(1000, "Clean close");
          } catch {
            // ignore
          }
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            try {
              ws?.close(1000, "Clean close");
            } catch {
              // ignore
            }
          };
        }
      }
    };
  }, [symbol, precision]);

  return (
    <div className="flex flex-col text-xs font-mono select-none">
      <div className="flex justify-between text-gray-400 text-[10px] pb-1 border-b border-white/5">
        <span>Price</span>
        <span>Quantity</span>
      </div>

      {/* Asks (Sell orders - Red) */}
      <div className="flex flex-col gap-1 py-1">
        {asks.map((ask, i) => (
          <div key={`ask-${i}`} className="flex justify-between relative overflow-hidden py-0.5">
            <div
              className="absolute right-0 top-0 bottom-0 bg-red-500/10 z-0 pointer-events-none"
              style={{ width: `${Math.min(parseFloat(ask.qty) * 2, 90)}%` }}
            />
            <span className="text-[#F6465D] z-10">{ask.price}</span>
            <span className="text-gray-300 z-10">{ask.qty}</span>
          </div>
        ))}
      </div>

      {/* Current Middle Price */}
      <div className={`py-2 text-center border-y border-white/5 font-bold text-sm tracking-wider ${
        isUp ? "text-[#00A070]" : "text-[#F6465D]"
      }`}>
        {currentPrice > 0 ? formatCryptoPrice(currentPrice, precision) : "--"}
      </div>

      {/* Bids (Buy orders - Green) */}
      <div className="flex flex-col gap-1 py-1">
        {bids.map((bid, i) => (
          <div key={`bid-${i}`} className="flex justify-between relative overflow-hidden py-0.5">
            <div
              className="absolute right-0 top-0 bottom-0 bg-[#00A070]/10 z-0 pointer-events-none"
              style={{ width: `${Math.min(parseFloat(bid.qty) * 2, 90)}%` }}
            />
            <span className="text-[#00A070] z-10">{bid.price}</span>
            <span className="text-gray-300 z-10">{bid.qty}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
