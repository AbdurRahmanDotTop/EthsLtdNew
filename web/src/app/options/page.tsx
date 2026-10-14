"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { 
  ChevronLeft, 
  Menu, 
  ChevronDown, 
  TrendingUp, 
  TrendingDown, 
  Check, 
  Clock, 
  Loader2 
} from "lucide-react";
import { useMarketData, formatCryptoPrice } from "@/hooks/useMarketData";
import { 
  placeOrder, 
  getOpenOrders, 
  getClosedOrders, 
  settleOptionOrder, 
  getUserTradingInfo 
} from "@/actions/trade";
import { getActiveMarkets } from "@/actions/markets";
import { toast } from "sonner";
import TradingChart from "@/components/trading/TradingChart";
import { LoginPromptModal } from "@/components/ui/LoginPromptModal";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export interface TradingMarket {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayName: string;
  binanceSymbol: string;
  category: string;
  tradingModes: string;
  status: string;
  pricePrecision: number;
  qtyPrecision: number;
  minOrderQty: number;
  maxOrderQty: number;
  minMargin: number;
  maxLeverage: number;
  payoutRate: number;
  isListedOnHome: boolean;
  isTopTicker: boolean;
  displayOrder: number;
}

export default function OptionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#121212] text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
      </div>
    }>
      <OptionsContent />
    </Suspense>
  );
}

function OptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get("symbol");

  // Dynamic Markets from database
  const [markets, setMarkets] = useState<TradingMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<TradingMarket | null>(null);
  const [loadingMarkets, setLoadingMarkets] = useState(true);

  const [interval, setInterval] = useState("1m");
  const [showAssetSelector, setShowAssetSelector] = useState(true);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);

  // Fetch active markets on mount
  useEffect(() => {
    let isDisposed = false;
    async function loadMarkets() {
      try {
        const active: TradingMarket[] = await getActiveMarkets("OPTION");
        if (isDisposed) return;
        setMarkets(active);

        if (active.length > 0) {
          let found: TradingMarket | undefined = undefined;
          if (urlSymbol) {
            const cleanUrl = urlSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
            found = active.find(
              (m: TradingMarket) =>
                m.binanceSymbol.toUpperCase() === cleanUrl ||
                m.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanUrl
            );
          }
          const chosen = found || active[0];
          setSelectedMarket(chosen);
          if (chosen.payoutRate) {
            setPayoutRate(chosen.payoutRate);
          }
        }
      } catch (err) {
        console.error("Failed to load option markets:", err);
      } finally {
        if (!isDisposed) setLoadingMarkets(false);
      }
    }
    loadMarkets();
    return () => { isDisposed = true; };
  }, [urlSymbol]);

  // Derived symbols
  const binanceSymbol = selectedMarket?.binanceSymbol || "BTCUSDT";
  const displayPair = selectedMarket?.symbol || "BTC/USDT";
  const precision = selectedMarket?.pricePrecision ?? 2;

  // Real-time market feed
  const { data: marketData } = useMarketData(binanceSymbol, precision);
  const currentPrice = marketData ? parseFloat(marketData.price) : 0;
  const isNegative = marketData?.changePercent?.startsWith("-") ?? false;

  // User balance
  const [userBalance, setUserBalance] = useState<number>(0);
  const [userUid, setUserUid] = useState<number | null>(null);

  // Form State
  const [betAmount, setBetAmount] = useState<string>("100");
  const [duration, setDuration] = useState<number>(60); // 30s, 60s, 120s, 300s
  const [payoutRate, setPayoutRate] = useState<number>(1.8); // 80% profit
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Tabs: Awaiting vs History
  const [optionTab, setOptionTab] = useState<"Awaiting" | "History">("Awaiting");
  const [awaitingOrders, setAwaitingOrders] = useState<any[]>([]);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);

  // Fetch orders and balances strictly for authenticated user
  const loadData = async () => {
    try {
      const info = await getUserTradingInfo();
      if (info.success) {
        setUserBalance(info.balance);
        setUserUid(info.uid);
        const [opens, closeds] = await Promise.all([
          getOpenOrders("Option"),
          getClosedOrders("Option"),
        ]);
        setAwaitingOrders(opens || []);
        setHistoryOrders(closeds || []);
      } else {
        setUserBalance(0);
        setUserUid(null);
        setAwaitingOrders([]);
        setHistoryOrders([]);
      }
    } catch (err) {
      console.error("Error loading options data:", err);
    }
  };

  useEffect(() => {
    let inFlight = false;
    const fetchSafe = async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        await loadData();
      } finally {
        inFlight = false;
      }
    };

    fetchSafe();
    const timer = window.setInterval(fetchSafe, 8000);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchSafe();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Handle Switch Market Click
  const handleSelectMarket = (m: TradingMarket) => {
    setSelectedMarket(m);
    if (m.payoutRate) {
      setPayoutRate(m.payoutRate);
    }
    router.replace(`/options?symbol=${m.binanceSymbol}`, { scroll: false });
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#options-more-container")) {
        setShowMoreDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // In-flight settlement tracking to prevent concurrent settlement requests
  const settlingRef = useRef<Set<string>>(new Set());

  // Countdown timer & auto-settlement for awaiting options
  useEffect(() => {
    if (awaitingOrders.length === 0) return;

    const timerId = window.setInterval(async () => {
      const now = Date.now();
      for (const order of awaitingOrders) {
        if (settlingRef.current.has(order.id)) continue;

        const orderTime = new Date(order.createdAt).getTime();
        const expiryDurationMs = (order.duration || 60) * 1000;
        const diffMs = now - (orderTime + expiryDurationMs);

        // If contract time reached expiration
        if (diffMs >= 0) {
          settlingRef.current.add(order.id);
          const settlementPrice = currentPrice > 0 ? currentPrice : order.price;
          try {
            const res = await settleOptionOrder(order.id, settlementPrice);
            if (res.success) {
              if (res.status === "Win") {
                toast.success(`Option Expired: WIN! +${(res.pnl ?? 0).toFixed(2)} USDT`);
              } else if (res.status === "Closed") {
                toast.info(`Option Expired: TIE / Refunded ${order.amount.toFixed(2)} USDT`);
              } else {
                toast.error(`Option Expired: LOSS (${order.amount.toFixed(2)} USDT)`);
              }
              await loadData();
            }
          } catch (err) {
            console.error("Settlement error:", err);
          } finally {
            settlingRef.current.delete(order.id);
          }
        }
      }
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [awaitingOrders, currentPrice]);

  // Submit Binary Option Trade (Rise or Fall)
  const handleOptionTrade = async (direction: "Rise" | "Fall") => {
    if (!userUid) {
      setShowLoginPrompt(true);
      return;
    }
    if (loadingType) return;

    const investment = parseFloat(betAmount);
    if (!investment || investment <= 0) {
      toast.error("Please enter a valid investment amount.");
      return;
    }

    if (selectedMarket?.minMargin && investment < selectedMarket.minMargin) {
      toast.error(`Minimum investment is ${selectedMarket.minMargin} USDT.`);
      return;
    }

    if (investment > userBalance) {
      toast.error(`Insufficient balance. Required: ${investment.toFixed(2)} USDT, Available: ${userBalance.toFixed(2)} USDT`);
      return;
    }

    setLoadingType(direction);
    const clientOrderId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await placeOrder({
        category: "Option",
        symbol: displayPair,
        type: direction,
        amount: investment,
        price: currentPrice,
        duration,
        payout: payoutRate,
        margin: investment,
        clientOrderId,
      });

      if (res.success) {
        toast.success(
          res.duplicatePrevented
            ? `Option order already placed: #${res.orderId}`
            : `Option ${direction} placed on ${displayPair}!`
        );
        await loadData();
      } else {
        toast.error(res.error || "Failed to place option trade.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#121212] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-1 -ml-1 text-gray-400 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center bg-[#1A1C24] p-0.5 rounded-lg border border-white/5">
            <div className="px-5 py-1 text-sm font-bold rounded-md bg-[#00A070] text-white shadow-sm">
              Option
            </div>
            <Link
              href={`/trade?symbol=${binanceSymbol}`}
              className="px-5 py-1 text-sm font-semibold rounded-md text-gray-400 hover:text-gray-200 transition-colors"
            >
              Perpetual
            </Link>
          </div>
        </div>
        <button 
          onClick={() => setShowAssetSelector(!showAssetSelector)} 
          className={`p-1.5 rounded transition-colors ${showAssetSelector ? "text-[#00A070] bg-white/5" : "text-gray-400 hover:text-white"}`}
          title="Switch Market"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Switch Market Bar */}
      {showAssetSelector && (
        <div 
          id="switch-market-bar" 
          className="bg-[#1A1C24] border-b border-white/10 px-4 py-2.5 flex items-center gap-2 text-xs overflow-x-auto hide-scrollbar z-20 select-none animate-in fade-in duration-200"
        >
          <span className="text-gray-400 self-center mr-1 text-[11px] uppercase tracking-wider font-bold whitespace-nowrap">
            SWITCH MARKET:
          </span>
          <div className="flex items-center gap-2 flex-nowrap">
            {markets.map((item: TradingMarket) => (
              <button
                key={item.id}
                onClick={() => handleSelectMarket(item)}
                className={`px-3 py-1.5 rounded font-mono font-bold transition-all text-xs whitespace-nowrap active:scale-95 cursor-pointer ${
                  selectedMarket?.id === item.id 
                    ? "bg-[#00A070] text-white shadow-md ring-1 ring-emerald-400/50" 
                    : "bg-[#252836] text-gray-300 hover:text-white hover:bg-[#2e3244]"
                }`}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ticker & Price Header */}
      <div className="flex justify-between px-4 py-3 bg-[#1A1C24] items-center border-b border-white/5">
        <button
          id="options-asset-toggle"
          onClick={() => setShowAssetSelector(!showAssetSelector)}
          className="flex items-center gap-1.5 text-xl font-bold font-mono tracking-tight text-white hover:text-gray-300 group"
        >
          <span>{displayPair}</span>
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
        </button>

        <div className="flex items-center gap-2 font-mono">
          <span className={`text-xl font-bold ${isNegative ? "text-[#F6465D]" : "text-[#00A070]"}`}>
            {currentPrice > 0 ? formatCryptoPrice(currentPrice, precision) : "--"}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 ${
            isNegative ? "text-[#F6465D] bg-[#F6465D]/10" : "text-[#00A070] bg-[#00A070]/10"
          }`}>
            {marketData?.changePercent || "0.00%"}
            {isNegative ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
          </span>
        </div>
      </div>

      {/* Timeframe Bar */}
      <div className="relative flex justify-between items-center text-xs text-gray-400 px-4 py-2 bg-[#1A1C24] border-b border-white/5 font-medium select-none z-20">
        <span className="text-gray-500">Time</span>
        {[
          { label: "1 min", value: "1m" },
          { label: "5 min", value: "5m" },
          { label: "30 min", value: "30m" },
          { label: "1 H", value: "1h" },
        ].map((tf) => {
          const isActive = interval === tf.value;
          return (
            <button
              key={tf.value}
              onClick={() => {
                setInterval(tf.value);
                setShowMoreDropdown(false);
              }}
              className={`transition-colors cursor-pointer ${
                isActive ? "text-[#00A070] font-bold border-b border-[#00A070] pb-0.5" : "hover:text-gray-200"
              }`}
            >
              {tf.label}
            </button>
          );
        })}

        {/* More Dropdown */}
        <div id="options-more-container" className="relative">
          <button
            type="button"
            onClick={() => setShowMoreDropdown(!showMoreDropdown)}
            className={`flex items-center gap-0.5 transition-colors cursor-pointer ${
              !["1m", "5m", "30m", "1h"].includes(interval) || showMoreDropdown
                ? "text-[#00A070] font-bold border-b border-[#00A070] pb-0.5"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span>
              {!["1m", "5m", "30m", "1h"].includes(interval)
                ? ([
                    { label: "15 min", value: "15m" },
                    { label: "2 hours", value: "2h" },
                    { label: "4 hours", value: "4h" },
                    { label: "1 day", value: "1d" },
                    { label: "1 week", value: "1w" },
                    { label: "1 month", value: "1M" },
                  ].find((m) => m.value === interval)?.label || "More")
                : "More"}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showMoreDropdown ? "rotate-180" : ""}`} />
          </button>

          {showMoreDropdown && (
            <div className="absolute right-0 top-full mt-2 w-36 bg-[#1A1C24] border border-white/10 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-white/5">
                Timeframe
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {[
                  { label: "1 min", value: "1m" },
                  { label: "5 min", value: "5m" },
                  { label: "15 min", value: "15m" },
                  { label: "30 min", value: "30m" },
                  { label: "1 hour", value: "1h" },
                  { label: "2 hours", value: "2h" },
                  { label: "4 hours", value: "4h" },
                  { label: "1 day", value: "1d" },
                  { label: "1 week", value: "1w" },
                  { label: "1 month", value: "1M" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setInterval(item.value);
                      setShowMoreDropdown(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
                      interval === item.value
                        ? "bg-[#00A070]/20 text-[#00A070] font-bold"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    {interval === item.value && <Check className="w-3 h-3 text-[#00A070]" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real Live Area Chart for Options */}
      <div className="bg-[#121212] border-b border-white/5">
        <TradingChart symbol={binanceSymbol} interval={interval} type="area" precision={precision} />
      </div>

      {/* Bottom Panel */}
      <div className="p-4 bg-[#1A1C24] flex-1 flex flex-col justify-between">
        {/* Awaiting / History Tabs */}
        <div>
          <div className="flex justify-center items-center gap-6 pb-3 border-b border-white/5 text-sm">
            <button
              onClick={() => setOptionTab("Awaiting")}
              className={`font-bold transition-colors relative py-1 ${
                optionTab === "Awaiting" ? "text-[#00A070]" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Awaiting
              {awaitingOrders.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-[#00A070] text-black text-[10px] font-mono rounded-full font-bold">
                  {awaitingOrders.length}
                </span>
              )}
            </button>
            <span className="text-gray-600">/</span>
            <button
              onClick={() => setOptionTab("History")}
              className={`font-bold transition-colors relative py-1 ${
                optionTab === "History" ? "text-[#00A070]" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              History
            </button>
          </div>

          {/* Tab Content */}
          <div className="py-3 min-h-[120px] max-h-[180px] overflow-y-auto space-y-2">
            {optionTab === "Awaiting" ? (
              awaitingOrders.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500">
                  No active awaiting contracts
                </div>
              ) : (
                awaitingOrders.map((order) => {
                  const orderTime = new Date(order.createdAt).getTime();
                  const expiryDurationMs = (order.duration || 60) * 1000;
                  const remainingSec = Math.max(0, Math.ceil((orderTime + expiryDurationMs - Date.now()) / 1000));
                  const isRise = order.type === "Rise" || order.type === "Buy Long";

                  return (
                    <div key={order.id} className="p-2.5 bg-[#252836] rounded-lg border border-white/5 flex items-center justify-between text-xs font-mono">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isRise ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                            {isRise ? "RISE" : "FALL"}
                          </span>
                          <span className="text-white font-semibold">{order.amount.toFixed(2)} USDT</span>
                          <span className="text-[11px] text-gray-400 font-bold">({order.symbol})</span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Entry: <span className="text-gray-200">{order.price.toFixed(precision)}</span> | Current: <span className="text-gray-200">{currentPrice > 0 ? currentPrice.toFixed(precision) : "--"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#1A1C24] text-yellow-400 font-bold text-xs">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>{remainingSec}s</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              historyOrders.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500">
                  No options history records
                </div>
              ) : (
                historyOrders.map((order) => {
                  const isWin = order.status === "Win";
                  const isRise = order.type === "Rise" || order.type === "Buy Long";

                  return (
                    <div key={order.id} className="p-2.5 bg-[#252836] rounded-lg border border-white/5 flex items-center justify-between text-xs font-mono">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isRise ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                            {isRise ? "RISE" : "FALL"}
                          </span>
                          <span className="text-white">{order.amount.toFixed(2)} USDT</span>
                          <span className="text-[10px] text-gray-400">
                            ({order.symbol} | Entry: {order.price.toFixed(precision)} → Exit: {order.closePrice?.toFixed(precision) || "..."})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isWin ? "bg-[#00A070]/20 text-[#00A070] border border-[#00A070]/50" : "bg-[#F6465D]/20 text-[#F6465D] border border-[#F6465D]/50"
                        }`}>
                          {order.status}
                        </span>
                        <span className={`font-bold ${isWin ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                          {(order.realizedPnl ?? 0) >= 0 ? `+${(order.realizedPnl ?? 0).toFixed(2)}` : (order.realizedPnl ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Investment Form */}
        <div className="mt-2 space-y-3 pt-3 border-t border-white/5">
          {/* Expiration Time Selector */}
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Contract Duration:</span>
            <div className="flex gap-2">
              {[
                { sec: 30, yield: "75%" },
                { sec: 60, yield: "80%" },
                { sec: 120, yield: "85%" },
                { sec: 300, yield: "90%" }
              ].map((item) => (
                <button
                  key={item.sec}
                  onClick={() => {
                    setDuration(item.sec);
                    setPayoutRate(1 + parseFloat(item.yield) / 100);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    duration === item.sec
                      ? "bg-[#00A070] text-white font-bold"
                      : "bg-[#2A2D38] text-gray-400 hover:text-white"
                  }`}
                >
                  {item.sec}s ({item.yield})
                </button>
              ))}
            </div>
          </div>

          {/* Investment Amount Input & Balance */}
          <div className="flex justify-between items-center bg-[#2A2D38] px-3 py-2.5 rounded-lg border border-white/5">
            <div className="flex flex-col">
              <span className="text-[11px] text-gray-400">Investment (USDT)</span>
              {userUid ? (
                <span className="text-[10px] text-gray-500 font-mono">
                  Balance: {userBalance.toFixed(2)} USDT
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginPrompt(true)}
                  className="text-[10px] text-[#00A070] hover:underline font-medium text-left cursor-pointer"
                >
                  Log In to View Balance
                </button>
              )}
            </div>
            <input
              type="number"
              placeholder="0.00"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="bg-transparent text-right w-32 outline-none text-base font-bold text-white font-mono placeholder:text-gray-500"
            />
          </div>

          {/* Quick Amount Chips */}
          <div className="flex gap-2">
            {[10, 50, 100, 500, 1000].map((val) => (
              <button
                key={val}
                onClick={() => setBetAmount(val.toString())}
                className="flex-1 py-1 rounded bg-[#252836] hover:bg-[#2e3244] text-[11px] font-mono text-gray-300 transition-colors"
              >
                ${val}
              </button>
            ))}
          </div>

          {/* Big Action Buttons: RISE / FALL */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => handleOptionTrade("Rise")}
              disabled={loadingType !== null}
              className="py-3.5 bg-gradient-to-r from-[#00A070] to-emerald-500 rounded-lg text-white font-bold text-base shadow-lg shadow-[#00A070]/25 flex flex-col items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loadingType === "Rise" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>RISE</span>
                  </div>
                  <span className="text-[10px] font-mono font-normal opacity-90">
                    Payout: +{Math.round((payoutRate - 1) * 100)}%
                  </span>
                </>
              )}
            </button>

            <button
              onClick={() => handleOptionTrade("Fall")}
              disabled={loadingType !== null}
              className="py-3.5 bg-gradient-to-r from-[#F6465D] to-rose-500 rounded-lg text-white font-bold text-base shadow-lg shadow-[#F6465D]/25 flex flex-col items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loadingType === "Fall" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-4 h-4" />
                    <span>FALL</span>
                  </div>
                  <span className="text-[10px] font-mono font-normal opacity-90">
                    Payout: +{Math.round((payoutRate - 1) * 100)}%
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Login Required Authentication Modal */}
      <LoginPromptModal
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        title="Log In to Trade Options"
        description={`Please log in to your account to place binary option contracts on ${displayPair}.`}
        returnUrl={`/options?symbol=${binanceSymbol}`}
      />
    </div>
  );
}
