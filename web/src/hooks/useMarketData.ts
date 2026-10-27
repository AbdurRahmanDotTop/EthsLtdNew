"use client";

import { useState, useEffect } from "react";

export type MarketData = {
  symbol: string;
  price: string;
  changePercent: string;
  high24h: string;
  low24h: string;
};

export function formatCryptoPrice(raw: number, precision?: number): string {
  if (precision !== undefined) {
    return raw.toFixed(precision);
  }
  if (raw >= 1000) return raw.toFixed(2);
  if (raw >= 10) return raw.toFixed(2);
  if (raw >= 1) return raw.toFixed(4);
  if (raw >= 0.001) return raw.toFixed(5);
  return raw.toFixed(6);
}

export function useMarketData(symbol: string = "btcusdt", precision?: number) {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isDisposed = false;
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const lowerSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
    const upperSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // 1. Initial REST fetch for instant response without waiting for WebSocket handshake
    const fetchRestTicker = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${upperSymbol}`);
        if (!res.ok) return;
        const parsed = (await res.json()) as any;
        if (!isDisposed && parsed && parsed.lastPrice) {
          const numPrice = parseFloat(parsed.lastPrice);
          const numHigh = parseFloat(parsed.highPrice);
          const numLow = parseFloat(parsed.lowPrice);

          setData({
            symbol: parsed.symbol,
            price: formatCryptoPrice(numPrice, precision),
            changePercent: (parseFloat(parsed.priceChangePercent) >= 0 ? "+" : "") + parseFloat(parsed.priceChangePercent).toFixed(2) + "%",
            high24h: formatCryptoPrice(numHigh, precision),
            low24h: formatCryptoPrice(numLow, precision),
          });
          setError(false);
        }
      } catch {
        // Suppress initial fetch error if offline
      }
    };

    fetchRestTicker();

    // Fallback polling helper if WebSocket fails or disconnects
    const startPolling = () => {
      if (pollInterval || isDisposed) return;
      pollInterval = setInterval(() => {
        if (!document.hidden) {
          fetchRestTicker();
        }
      }, 5000);
    };

    // 2. Safe WebSocket connection
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${lowerSymbol}@ticker`);

      ws.onmessage = (event) => {
        if (isDisposed) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.c) {
            const numPrice = parseFloat(parsed.c);
            const numHigh = parseFloat(parsed.h);
            const numLow = parseFloat(parsed.l);
            const numChange = parseFloat(parsed.P);

            setData({
              symbol: parsed.s,
              price: formatCryptoPrice(numPrice, precision),
              changePercent: (numChange >= 0 ? "+" : "") + numChange.toFixed(2) + "%",
              high24h: formatCryptoPrice(numHigh, precision),
              low24h: formatCryptoPrice(numLow, precision),
            });
            setError(false);
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onerror = () => {
        if (!isDisposed) {
          setError(true);
          startPolling();
        }
      };

      ws.onclose = () => {
        if (!isDisposed) {
          startPolling();
        }
      };
    } catch {
      startPolling();
    }

    // 3. Robust Cleanup to prevent "WebSocket closed before connection established" and "Ping received after close"
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
            ws.close(1000, "Component unmounted");
          } catch {
            // ignore
          }
        } else if (ws.readyState === WebSocket.CONNECTING) {
          // Do not call close() while CONNECTING. Wait until open then close quietly.
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

  return { data, error };
}
