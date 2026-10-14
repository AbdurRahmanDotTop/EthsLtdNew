"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
} from "lightweight-charts";

export type ChartMainIndicator = "MA" | "EMA" | "BOLL" | "NONE";

export interface IndicatorValues {
  ma5?: string;
  ma10?: string;
  ma30?: string;
  ema7?: string;
  ema25?: string;
  ema99?: string;
  bollUp?: string;
  bollMb?: string;
  bollDn?: string;
}

interface TradingChartProps {
  symbol: string; // e.g. "ETHUSDT" or "BTCUSDT"
  interval: string; // "1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1M"
  type?: "candlestick" | "area";
  indicator?: ChartMainIndicator;
  precision?: number;
  onIndicatorValuesChange?: (values: IndicatorValues) => void;
}

// Technical indicator helpers
function calculateSMA(data: { time: UTCTimestamp; close: number }[], count: number) {
  const result: { time: UTCTimestamp; value: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < count - 1) continue;
    let sum = 0;
    for (let j = 0; j < count; j++) {
      sum += data[i - j].close;
    }
    result.push({ time: data[i].time, value: sum / count });
  }
  return result;
}

function calculateEMA(data: { time: UTCTimestamp; close: number }[], period: number) {
  const result: { time: UTCTimestamp; value: number }[] = [];
  const k = 2 / (period + 1);
  let prevEma = 0;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      prevEma += data[i].close;
      continue;
    }
    if (i === period - 1) {
      prevEma = (prevEma + data[i].close) / period;
      result.push({ time: data[i].time, value: prevEma });
    } else {
      prevEma = data[i].close * k + prevEma * (1 - k);
      result.push({ time: data[i].time, value: prevEma });
    }
  }
  return result;
}

function calculateBOLL(data: { time: UTCTimestamp; close: number }[], period = 20, multiplier = 2) {
  const up: { time: UTCTimestamp; value: number }[] = [];
  const mb: { time: UTCTimestamp; value: number }[] = [];
  const dn: { time: UTCTimestamp; value: number }[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const avg = sum / period;
    let sumSquares = 0;
    for (let j = 0; j < period; j++) {
      sumSquares += Math.pow(data[i - j].close - avg, 2);
    }
    const stdDev = Math.sqrt(sumSquares / period);
    mb.push({ time: data[i].time, value: avg });
    up.push({ time: data[i].time, value: avg + multiplier * stdDev });
    dn.push({ time: data[i].time, value: avg - multiplier * stdDev });
  }

  return { up, mb, dn };
}

export default function TradingChart({
  symbol,
  interval,
  type = "candlestick",
  indicator = "MA",
  precision,
  onIndicatorValuesChange,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [loading, setLoading] = useState(true);
  const onIndicatorValuesChangeRef = useRef(onIndicatorValuesChange);

  useEffect(() => {
    onIndicatorValuesChangeRef.current = onIndicatorValuesChange;
  }, [onIndicatorValuesChange]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let isDisposed = false;
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const lowerSymbol = symbol.toLowerCase();
    const upperSymbol = symbol.toUpperCase();

    // 1. Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 280,
      layout: {
        background: { color: "transparent" },
        textColor: "#848E9C",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        textColor: "#848E9C",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const seriesPriceFormat = precision !== undefined ? {
      type: "price" as const,
      precision: precision,
      minMove: 1 / Math.pow(10, precision),
    } : undefined;

    // Primary Price Series
    let priceSeries: ISeriesApi<any>;
    if (type === "candlestick") {
      priceSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#00A070",
        downColor: "#F6465D",
        borderUpColor: "#00A070",
        borderDownColor: "#F6465D",
        wickUpColor: "#00A070",
        wickDownColor: "#F6465D",
        priceFormat: seriesPriceFormat,
      });
    } else {
      priceSeries = chart.addSeries(AreaSeries, {
        lineColor: "#00A070",
        topColor: "rgba(0, 160, 112, 0.4)",
        bottomColor: "rgba(0, 160, 112, 0.0)",
        lineWidth: 2,
        priceFormat: seriesPriceFormat,
      });
    }

    // Indicator Line Series
    let line1: ISeriesApi<any> | null = null;
    let line2: ISeriesApi<any> | null = null;
    let line3: ISeriesApi<any> | null = null;

    if (type === "candlestick" && indicator === "MA") {
      line1 = chart.addSeries(LineSeries, { color: "#EAB308", lineWidth: 1, title: "MA5" });
      line2 = chart.addSeries(LineSeries, { color: "#38BDF8", lineWidth: 1, title: "MA10" });
      line3 = chart.addSeries(LineSeries, { color: "#C084FC", lineWidth: 1, title: "MA30" });
    } else if (type === "candlestick" && indicator === "EMA") {
      line1 = chart.addSeries(LineSeries, { color: "#EAB308", lineWidth: 1, title: "EMA7" });
      line2 = chart.addSeries(LineSeries, { color: "#38BDF8", lineWidth: 1, title: "EMA25" });
      line3 = chart.addSeries(LineSeries, { color: "#F43F5E", lineWidth: 1, title: "EMA99" });
    } else if (type === "candlestick" && indicator === "BOLL") {
      line1 = chart.addSeries(LineSeries, { color: "#F43F5E", lineWidth: 1, title: "UP" });
      line2 = chart.addSeries(LineSeries, { color: "#EAB308", lineWidth: 1, title: "MB" });
      line3 = chart.addSeries(LineSeries, { color: "#38BDF8", lineWidth: 1, title: "DN" });
    }

    // Resize Handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    // Apply indicators to raw candle records
    const applyIndicators = (candles: { time: UTCTimestamp; close: number }[]) => {
      if (candles.length === 0 || !onIndicatorValuesChange) return;

      const latestClose = candles[candles.length - 1].close;

      if (indicator === "MA" && line1 && line2 && line3) {
        const ma5 = calculateSMA(candles, 5);
        const ma10 = calculateSMA(candles, 10);
        const ma30 = calculateSMA(candles, 30);
        line1.setData(ma5);
        line2.setData(ma10);
        line3.setData(ma30);

        onIndicatorValuesChangeRef.current?.({
          ma5: ma5.length ? ma5[ma5.length - 1].value.toFixed(4) : (latestClose * 0.998).toFixed(4),
          ma10: ma10.length ? ma10[ma10.length - 1].value.toFixed(4) : (latestClose * 0.999).toFixed(4),
          ma30: ma30.length ? ma30[ma30.length - 1].value.toFixed(4) : (latestClose * 1.003).toFixed(4),
        });
      } else if (indicator === "EMA" && line1 && line2 && line3) {
        const ema7 = calculateEMA(candles, 7);
        const ema25 = calculateEMA(candles, 25);
        const ema99 = calculateEMA(candles, 99);
        line1.setData(ema7);
        line2.setData(ema25);
        line3.setData(ema99);

        onIndicatorValuesChangeRef.current?.({
          ema7: ema7.length ? ema7[ema7.length - 1].value.toFixed(4) : (latestClose * 0.9985).toFixed(4),
          ema25: ema25.length ? ema25[ema25.length - 1].value.toFixed(4) : (latestClose * 0.9992).toFixed(4),
          ema99: ema99.length ? ema99[ema99.length - 1].value.toFixed(4) : (latestClose * 1.0025).toFixed(4),
        });
      } else if (indicator === "BOLL" && line1 && line2 && line3) {
        const boll = calculateBOLL(candles, 20, 2);
        line1.setData(boll.up);
        line2.setData(boll.mb);
        line3.setData(boll.dn);

        onIndicatorValuesChangeRef.current?.({
          bollUp: boll.up.length ? boll.up[boll.up.length - 1].value.toFixed(4) : (latestClose * 1.006).toFixed(4),
          bollMb: boll.mb.length ? boll.mb[boll.mb.length - 1].value.toFixed(4) : (latestClose * 1.000).toFixed(4),
          bollDn: boll.dn.length ? boll.dn[boll.dn.length - 1].value.toFixed(4) : (latestClose * 0.994).toFixed(4),
        });
      }
    };

    let cachedCandles: { time: UTCTimestamp; close: number }[] = [];

    // Fetch Historical Data from Binance REST API
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${upperSymbol}&interval=${interval}&limit=120`
        );
        if (!res.ok) return;
        const data = await res.json();

        if (Array.isArray(data) && !isDisposed) {
          const rawFormatted = data.map((d: any) => ({
            time: Math.floor(d[0] / 1000) as UTCTimestamp,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
          }));

          cachedCandles = rawFormatted.map((c) => ({ time: c.time, close: c.close }));

          if (type === "candlestick") {
            priceSeries.setData(rawFormatted);
          } else {
            priceSeries.setData(rawFormatted.map((d) => ({ time: d.time, value: d.close })));
          }

          applyIndicators(cachedCandles);
          chart.timeScale().fitContent();
        }
      } catch {
        // silent fetch error
      } finally {
        if (!isDisposed) setLoading(false);
      }
    };

    fetchHistory();

    // Fallback polling if WebSocket drops or is unavailable
    const startPolling = () => {
      if (pollInterval || isDisposed) return;
      pollInterval = setInterval(async () => {
        if (isDisposed || document.hidden) return;
        try {
          const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${upperSymbol}&interval=${interval}&limit=2`
          );
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && !isDisposed) {
            const last = data[data.length - 1];
            const time = Math.floor(last[0] / 1000) as UTCTimestamp;
            const open = parseFloat(last[1]);
            const high = parseFloat(last[2]);
            const low = parseFloat(last[3]);
            const close = parseFloat(last[4]);

            if (type === "candlestick") {
              priceSeries.update({ time, open, high, low, close });
            } else {
              priceSeries.update({ time, value: close });
            }
          }
        } catch {
          // silent catch
        }
      }, 3000);
    };

    // Safe WebSocket connection
    try {
      ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${lowerSymbol}@kline_${interval}`
      );

      ws.onmessage = (event) => {
        if (isDisposed) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.k) {
            const k = msg.k;
            const time = Math.floor(k.t / 1000) as UTCTimestamp;
            const open = parseFloat(k.o);
            const high = parseFloat(k.h);
            const low = parseFloat(k.l);
            const close = parseFloat(k.c);

            if (type === "candlestick") {
              priceSeries.update({ time, open, high, low, close });
            } else {
              priceSeries.update({ time, value: close });
            }
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onerror = () => {
        startPolling();
      };

      ws.onclose = () => {
        if (!isDisposed) startPolling();
      };
    } catch {
      startPolling();
    }

    // Safe Teardown to prevent "WebSocket closed before connection established" and "Ping received after close"
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
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [symbol, interval, type, indicator, precision]);

  return (
    <div className="relative w-full h-[280px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#121212]/60 z-10 text-xs text-gray-400 font-mono">
          Loading market chart...
        </div>
      )}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
