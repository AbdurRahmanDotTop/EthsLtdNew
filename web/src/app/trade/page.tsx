"use client";

import { useState, useEffect, Suspense } from "react";
import { 
  ChevronLeft, 
  SlidersHorizontal, 
  Loader2, 
  Check, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown,
  Minus,
  Plus
} from "lucide-react";
import { useMarketData, formatCryptoPrice } from "@/hooks/useMarketData";
import { 
  placeOrder, 
  getOpenOrders, 
  getClosedOrders, 
  closePosition, 
  updateStopProfitLoss, 
  getUserTradingInfo 
} from "@/actions/trade";
import { getActiveMarkets } from "@/actions/markets";
import { toast } from "sonner";
import TradingChart, { ChartMainIndicator, IndicatorValues } from "@/components/trading/TradingChart";
import OrderBook from "@/components/trading/OrderBook";
import { LoginPromptModal } from "@/components/ui/LoginPromptModal";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function TradePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#121212] text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
      </div>
    }>
      <TradeContent />
    </Suspense>
  );
}

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

function TradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get("symbol");

  // Dynamic Markets from database
  const [markets, setMarkets] = useState<TradingMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<TradingMarket | null>(null);
  const [loadingMarkets, setLoadingMarkets] = useState(true);

  // Timeframe and Dropdowns
  const [interval, setInterval] = useState("30m");
  const [showAssetSelector, setShowAssetSelector] = useState(true);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [showIndexDropdown, setShowIndexDropdown] = useState(false);
  const [activeMainIndicator, setActiveMainIndicator] = useState<ChartMainIndicator>("MA");
  const [activeSubIndicator, setActiveSubIndicator] = useState<string | null>("VOL");
  const [indicatorValues, setIndicatorValues] = useState<IndicatorValues>({});

  // Fetch active markets on mount
  useEffect(() => {
    let isDisposed = false;
    async function loadMarkets() {
      try {
        const active: TradingMarket[] = await getActiveMarkets("PERPETUAL");
        if (isDisposed) return;
        setMarkets(active);

        // Determine initial market
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
          setSelectedMarket(found || active[0]);
        }
      } catch (err) {
        console.error("Failed to load markets:", err);
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
  const assetBase = selectedMarket?.baseAsset || "BTC";
  const precision = selectedMarket?.pricePrecision ?? 2;

  // Real-time market feed (Binance REST & WebSocket)
  const { data: marketData } = useMarketData(binanceSymbol, precision);
  const currentPrice = marketData ? parseFloat(marketData.price) : 0;
  const isNegative = marketData?.changePercent?.startsWith("-") ?? false;

  // User balance & UID
  const [userBalance, setUserBalance] = useState<number>(0);
  const [userUid, setUserUid] = useState<number | null>(null);

  // Form State - Perpetual Trading
  const [tradeDirection, setTradeDirection] = useState<"Buy Long" | "Buy Short">("Buy Long");
  const [leverage, setLeverage] = useState<number>(selectedMarket?.maxLeverage ? Math.min(5, selectedMarket.maxLeverage) : 5);
  const [showMultipleDropdown, setShowMultipleDropdown] = useState(false);
  const [customMultipleInput, setCustomMultipleInput] = useState<string>("");
  const [lotInput, setLotInput] = useState<string>("");
  const lotAmount = parseFloat(lotInput) || 0;
  
  // Dynamic financial calculations
  const notionalValue = lotAmount * currentPrice;
  const marginRequired = leverage > 0 ? notionalValue / leverage : 0;
  const maxAllowedLeverage = selectedMarket?.maxLeverage || 100;
  const defaultPresets = [5, 10, 20, 30, 50, 75, 100, 125];
  const presetMultiples = defaultPresets.filter((lvl) => lvl <= maxAllowedLeverage);
  if (!presetMultiples.includes(maxAllowedLeverage) && maxAllowedLeverage > 0) {
    presetMultiples.push(maxAllowedLeverage);
  }

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [stopProfitStep, setStopProfitStep] = useState<number>(0);
  const [stopLossStep, setStopLossStep] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stop Profit / Stop Loss Edit Modal for active positions
  const [editingPosition, setEditingPosition] = useState<any | null>(null);
  const [editStopProfit, setEditStopProfit] = useState<number>(0);
  const [editStopLoss, setEditStopLoss] = useState<number>(0);
  const [isUpdatingSLTP, setIsUpdatingSLTP] = useState(false);

  // Bottom Tabs: "Market order" vs "Transaction Record"
  const [activeTab, setActiveTab] = useState<"Market order" | "Transaction Record">("Market order");
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [closedOrders, setClosedOrders] = useState<any[]>([]);
  const [closingOrderId, setClosingOrderId] = useState<string | null>(null);

  // Fetch balances & orders strictly for authenticated user
  const loadData = async () => {
    try {
      const info = await getUserTradingInfo();
      if (info.success) {
        setUserBalance(info.balance);
        setUserUid(info.uid);
      } else {
        setUserBalance(0);
        setUserUid(null);
      }
      const opens = await getOpenOrders("Perpetual");
      setOpenOrders(opens || []);
      const closeds = await getClosedOrders("Perpetual");
      setClosedOrders(closeds || []);
    } catch (err) {
      console.error("Error loading trade data:", err);
    }
  };

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("#more-dropdown-container") &&
        !target.closest("#index-dropdown-container") &&
        !target.closest("#multiple-dropdown-container")
      ) {
        setShowMoreDropdown(false);
        setShowIndexDropdown(false);
        setShowMultipleDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Handle Market Selection Switch
  const handleSelectMarket = (m: TradingMarket) => {
    setSelectedMarket(m);
    router.replace(`/trade?symbol=${m.binanceSymbol}`, { scroll: false });
  };

  // Handle clicking "Buy Long" / "Buy Short" submit button -> Opens Confirm Modal
  const handleOpenConfirm = () => {
    if (!userUid) {
      setShowLoginPrompt(true);
      return;
    }
    if (!lotAmount || lotAmount <= 0) {
      toast.error("Please enter a valid lot amount.");
      return;
    }
    if (selectedMarket?.minOrderQty && lotAmount < selectedMarket.minOrderQty) {
      toast.error(`Minimum order amount is ${selectedMarket.minOrderQty} ${assetBase}.`);
      return;
    }
    if (marginRequired > userBalance) {
      toast.error(`Insufficient balance. Required: ${marginRequired.toFixed(4)} USDT, Available: ${userBalance.toFixed(4)} USDT`);
      return;
    }
    setStopProfitStep(0);
    setStopLossStep(0);
    setShowConfirmModal(true);
  };

  // Confirm order execution from modal
  const handleConfirmOrder = async () => {
    if (!userUid) {
      setShowConfirmModal(false);
      setShowLoginPrompt(true);
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    const clientOrderId = `perp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await placeOrder({
        category: "Perpetual",
        symbol: displayPair,
        type: tradeDirection,
        amount: lotAmount,
        price: currentPrice,
        leverage,
        margin: marginRequired,
        stopProfit: stopProfitStep > 0 ? stopProfitStep : null,
        stopLoss: stopLossStep > 0 ? stopLossStep : null,
        clientOrderId,
      });

      if (res.success) {
        toast.success(
          res.duplicatePrevented
            ? `Order already placed: #${res.orderId}`
            : `${tradeDirection} order on ${displayPair} submitted!`
        );
        setShowConfirmModal(false);
        setLotInput("");
        await loadData();
      } else {
        toast.error(res.error || "Failed to place order.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close Out Position
  const handleClosePosition = async (orderId: string) => {
    if (!userUid) {
      setShowLoginPrompt(true);
      return;
    }
    setClosingOrderId(orderId);
    try {
      const res = await closePosition(orderId, currentPrice);
      if (res.success) {
        toast.success("Position closed successfully!");
        await loadData();
      } else {
        toast.error(res.error || "Failed to close position.");
      }
    } catch (err) {
      toast.error("An error occurred while closing position.");
    } finally {
      setClosingOrderId(null);
    }
  };

  // Update Stop Profit & Stop Loss
  const handleSaveStopProfitLoss = async () => {
    if (!userUid) {
      setEditingPosition(null);
      setShowLoginPrompt(true);
      return;
    }
    if (!editingPosition) return;
    setIsUpdatingSLTP(true);
    try {
      const res = await updateStopProfitLoss(
        editingPosition.id,
        editStopProfit > 0 ? editStopProfit : null,
        editStopLoss > 0 ? editStopLoss : null
      );
      if (res.success) {
        toast.success("Stop profit & loss updated!");
        setEditingPosition(null);
        await loadData();
      } else {
        toast.error(res.error || "Failed to update values.");
      }
    } catch (err) {
      toast.error("Error updating stop profit/loss.");
    } finally {
      setIsUpdatingSLTP(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 select-none font-sans">
      {/* Top Header Navigation */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#121212] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-1 -ml-1 text-gray-400 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </Link>

          {/* Option | Perpetual Segmented Toggle */}
          <div className="flex items-center bg-[#1A1C24] p-0.5 rounded-lg border border-white/5">
            <Link
              href={`/options?symbol=${binanceSymbol}`}
              className="px-5 py-1 text-sm font-semibold rounded-md text-gray-400 hover:text-gray-200 transition-colors"
            >
              Option
            </Link>
            <div className="px-5 py-1 text-sm font-bold rounded-md bg-[#00A070] text-white shadow-sm">
              Perpetual
            </div>
          </div>
        </div>

        {/* Top Right Tool Icon */}
        <button 
          onClick={() => setShowAssetSelector(!showAssetSelector)} 
          className={`p-1.5 rounded transition-colors ${showAssetSelector ? "text-[#00A070] bg-white/5" : "text-gray-400 hover:text-white"}`}
          title="Switch Market"
        >
          <SlidersHorizontal className="w-5 h-5 rotate-90" />
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

      {/* Symbol Price & 24h Ticker Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121212] border-b border-white/5">
        <div className="flex items-baseline gap-2">
          <button 
            id="asset-selector-toggle"
            onClick={() => setShowAssetSelector(!showAssetSelector)}
            className="flex items-center gap-1.5 text-lg font-bold font-mono tracking-tight text-white hover:text-gray-300 group"
          >
            <span>{displayPair}</span>
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          </button>
        </div>

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

      {/* Chart Timeframe Bar */}
      <div className="relative flex items-center justify-between px-4 py-2 text-xs text-gray-400 bg-[#121212] border-b border-white/5 font-medium select-none z-20">
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
              onClick={() => setInterval(tf.value)}
              className={`relative px-2 py-0.5 transition-colors cursor-pointer ${
                isActive ? "text-[#00A070] font-bold" : "hover:text-white"
              }`}
            >
              {tf.label}
              {isActive && (
                <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#00A070]" />
              )}
            </button>
          );
        })}

        {/* More Dropdown Toggle */}
        <div id="more-dropdown-container" className="relative">
          <button
            type="button"
            onClick={() => {
              setShowMoreDropdown(!showMoreDropdown);
              setShowIndexDropdown(false);
            }}
            className={`flex items-center gap-0.5 transition-colors cursor-pointer ${
              showMoreDropdown || !["1m", "5m", "30m", "1h"].includes(interval)
                ? "text-[#00A070] font-bold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span>{["1m", "5m", "30m", "1h"].includes(interval) ? "More" : interval}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showMoreDropdown ? "rotate-180" : ""}`} />
          </button>

          {showMoreDropdown && (
            <div className="absolute right-0 top-full mt-2 w-32 bg-[#1A1C24] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-white/5">
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

        {/* Index Dropdown Toggle */}
        <div id="index-dropdown-container" className="relative">
          <button
            type="button"
            onClick={() => {
              setShowIndexDropdown(!showIndexDropdown);
              setShowMoreDropdown(false);
            }}
            className={`flex items-center gap-0.5 transition-colors cursor-pointer ${
              showIndexDropdown || activeMainIndicator !== "NONE" || activeSubIndicator !== null
                ? "text-[#00A070] font-bold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span>Index</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showIndexDropdown ? "rotate-180" : ""}`} />
          </button>

          {showIndexDropdown && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-[#1A1C24] border border-white/10 rounded-lg shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95">
              <div className="mb-2.5">
                <div className="px-1 py-1 text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-white/5 mb-1.5">
                  Main Chart (Overlay)
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { id: "MA" as ChartMainIndicator, label: "MA" },
                    { id: "EMA" as ChartMainIndicator, label: "EMA" },
                    { id: "BOLL" as ChartMainIndicator, label: "BOLL" },
                    { id: "NONE" as ChartMainIndicator, label: "Hide" },
                  ].map((ind) => (
                    <button
                      key={ind.id}
                      type="button"
                      onClick={() => {
                        setActiveMainIndicator(ind.id);
                        setShowIndexDropdown(false);
                      }}
                      className={`px-2 py-1.5 rounded text-left flex items-center justify-between transition-colors ${
                        activeMainIndicator === ind.id
                          ? "bg-[#00A070]/20 text-[#00A070] font-bold"
                          : "text-gray-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{ind.label}</span>
                      {activeMainIndicator === ind.id && <Check className="w-3 h-3 text-[#00A070]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="px-1 py-1 text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-white/5 mb-1.5">
                  Sub-Chart Indicator
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { id: "VOL", label: "VOL" },
                    { id: "MACD", label: "MACD" },
                    { id: "KDJ", label: "KDJ" },
                    { id: "RSI", label: "RSI" },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        setActiveSubIndicator(activeSubIndicator === sub.id ? null : sub.id);
                        setShowIndexDropdown(false);
                      }}
                      className={`px-2 py-1.5 rounded text-left flex items-center justify-between transition-colors ${
                        activeSubIndicator === sub.id
                          ? "bg-[#00A070]/20 text-[#00A070] font-bold"
                          : "text-gray-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{sub.label}</span>
                      {activeSubIndicator === sub.id && <Check className="w-3 h-3 text-[#00A070]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Technical Indicators Banner */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#121212] text-[10px] font-mono border-b border-white/5 overflow-x-auto select-none">
        {activeMainIndicator === "MA" && (
          <>
            <span className="text-[#EAB308]">MA5:{indicatorValues.ma5 || (currentPrice * 0.998).toFixed(4)}</span>
            <span className="text-[#38BDF8]">MA10:{indicatorValues.ma10 || (currentPrice * 0.999).toFixed(4)}</span>
            <span className="text-[#C084FC]">MA30:{indicatorValues.ma30 || (currentPrice * 1.003).toFixed(4)}</span>
          </>
        )}
        {activeMainIndicator === "EMA" && (
          <>
            <span className="text-[#EAB308]">EMA7:{indicatorValues.ema7 || (currentPrice * 0.9985).toFixed(4)}</span>
            <span className="text-[#38BDF8]">EMA25:{indicatorValues.ema25 || (currentPrice * 0.9992).toFixed(4)}</span>
            <span className="text-[#F43F5E]">EMA99:{indicatorValues.ema99 || (currentPrice * 1.0025).toFixed(4)}</span>
          </>
        )}
        {activeMainIndicator === "BOLL" && (
          <>
            <span className="text-[#F43F5E]">UP:{indicatorValues.bollUp || (currentPrice * 1.006).toFixed(4)}</span>
            <span className="text-[#EAB308]">MB:{indicatorValues.bollMb || (currentPrice * 1.000).toFixed(4)}</span>
            <span className="text-[#38BDF8]">DN:{indicatorValues.bollDn || (currentPrice * 0.994).toFixed(4)}</span>
          </>
        )}
        {activeMainIndicator === "NONE" && (
          <span className="text-gray-500 italic">No chart overlay indicators active</span>
        )}
        {activeSubIndicator && (
          <span className="text-emerald-400 font-bold ml-auto border-l border-white/10 pl-2">
            {activeSubIndicator}: Active
          </span>
        )}
      </div>

      {/* High-Performance Trading Chart */}
      <div className="bg-[#121212] border-b border-white/5">
        <TradingChart
          symbol={binanceSymbol}
          interval={interval}
          type="candlestick"
          indicator={activeMainIndicator}
          precision={precision}
          onIndicatorValuesChange={setIndicatorValues}
        />
      </div>

      {/* Trading Panel (Left: Form, Right: Live Order Book) */}
      <div className="grid grid-cols-12 gap-3 p-3 bg-[#121212] border-b border-white/5">
        {/* Left Form: Order Entry */}
        <div className="col-span-7 flex flex-col justify-between pr-1 border-r border-white/5">
          {/* Direction Toggle: Buy Long / Buy Short */}
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <button
              onClick={() => setTradeDirection("Buy Long")}
              className={`py-2 text-xs font-bold rounded transition-all ${
                tradeDirection === "Buy Long"
                  ? "bg-[#00A070] text-white shadow-sm"
                  : "bg-[#1E202B] text-gray-400 hover:text-gray-200"
              }`}
            >
              Buy Long
            </button>
            <button
              onClick={() => setTradeDirection("Buy Short")}
              className={`py-2 text-xs font-bold rounded transition-all ${
                tradeDirection === "Buy Short"
                  ? "bg-[#F6465D] text-white shadow-sm"
                  : "bg-[#1E202B] text-gray-400 hover:text-gray-200"
              }`}
            >
              Buy Short
            </button>
          </div>

          {/* Multiple / Leverage Dropdown Selector */}
          <div className="relative mb-2.5" id="multiple-dropdown-container">
            <button
              type="button"
              onClick={() => setShowMultipleDropdown(!showMultipleDropdown)}
              className="w-full flex items-center justify-between bg-[#1A1C24] hover:bg-[#202330] rounded border border-white/10 px-3 py-2 text-xs text-white transition-colors cursor-pointer group"
            >
              <span className="text-gray-400 font-medium text-[11px]">
                Multiple / Leverage
              </span>
              <div className="flex items-center gap-1.5 font-mono font-bold">
                <span className="text-[#00A070]">x{leverage}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showMultipleDropdown ? "rotate-180" : ""}`} />
              </div>
            </button>

            {/* Multiple Dropdown Menu with Presets + Custom Input */}
            {showMultipleDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-[#1A1C24] border border-white/15 rounded-xl shadow-2xl p-3 z-40 animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 mb-2 border-b border-white/5 pb-1">
                  <span>Multiple / Leverage</span>
                  <span className="text-gray-500">Max: {maxAllowedLeverage}X</span>
                </div>

                {/* Preset Buttons Grid */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {presetMultiples.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setLeverage(lvl);
                        setShowMultipleDropdown(false);
                      }}
                      className={`py-1.5 px-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                        leverage === lvl
                          ? "bg-[#00A070] text-white shadow-sm ring-1 ring-emerald-400/50"
                          : "bg-[#252836] text-gray-300 hover:text-white hover:bg-[#2e3244]"
                      }`}
                    >
                      x{lvl}
                    </button>
                  ))}
                </div>

                {/* Custom Multiple Input Section */}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex justify-between items-center text-[10px] text-gray-400 font-semibold mb-1">
                    <span>Custom Multiple</span>
                    <span className="text-gray-500">1 - {maxAllowedLeverage}X</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 flex items-center bg-[#121212] rounded border border-white/10 px-2.5 py-1 focus-within:border-[#00A070]">
                      <span className="text-gray-500 text-xs font-mono mr-1">x</span>
                      <input
                        type="number"
                        min={1}
                        max={maxAllowedLeverage}
                        placeholder={`1-${maxAllowedLeverage}`}
                        value={customMultipleInput}
                        onChange={(e) => setCustomMultipleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = parseInt(customMultipleInput);
                            if (val >= 1 && val <= maxAllowedLeverage) {
                              setLeverage(val);
                              setShowMultipleDropdown(false);
                              setCustomMultipleInput("");
                            } else {
                              toast.error(`Please enter multiple between 1 and ${maxAllowedLeverage}X`);
                            }
                          }
                        }}
                        className="w-full bg-transparent text-xs font-mono text-white focus:outline-none placeholder-gray-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseInt(customMultipleInput);
                        if (val >= 1 && val <= maxAllowedLeverage) {
                          setLeverage(val);
                          setShowMultipleDropdown(false);
                          setCustomMultipleInput("");
                        } else {
                          toast.error(`Please enter multiple between 1 and ${maxAllowedLeverage}X`);
                        }
                      }}
                      className="px-3 py-1 bg-[#00A070] hover:bg-[#00c58a] text-white text-xs font-bold rounded transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lot / Amount Input Field */}
          <div className="mb-2">
            <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
              <span>Lot / Amount ({assetBase})</span>
              {userUid ? (
                <span className="text-[10px] text-gray-500 font-mono">Avail: {userBalance.toFixed(2)} U</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginPrompt(true)}
                  className="text-[10px] text-[#00A070] hover:underline font-medium cursor-pointer"
                >
                  Log In to View
                </button>
              )}
            </div>
            <div className="relative flex items-center bg-[#1A1C24] rounded border border-white/10 px-2.5 py-2 focus-within:border-[#00A070]">
              <span className="text-xs text-gray-400 font-medium mr-2 select-none">Lot</span>
              <input
                type="number"
                step="any"
                placeholder="Please enter"
                value={lotInput}
                onChange={(e) => setLotInput(e.target.value)}
                className="w-full bg-transparent text-xs font-mono text-white placeholder-gray-500 focus:outline-none"
              />
              <span className="text-xs text-gray-400 font-mono ml-1">{assetBase}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1 font-mono">
              <span>1 Lot = 1.00 {assetBase}</span>
              {selectedMarket?.minOrderQty ? <span>Min: {selectedMarket.minOrderQty} {assetBase}</span> : null}
            </div>
          </div>

          {/* Quick Lot Percentage Buttons */}
          <div className="grid grid-cols-4 gap-1 mb-3">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => {
                  if (currentPrice > 0) {
                    const maxAffordableMargin = userBalance * (pct / 100);
                    const calculatedLots = (maxAffordableMargin * leverage) / currentPrice;
                    setLotInput(calculatedLots.toFixed(selectedMarket?.qtyPrecision ?? 4));
                  }
                }}
                className="py-1 text-[10px] font-mono rounded bg-[#1E202B] text-gray-400 hover:text-white hover:bg-[#252836] transition-colors"
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Dynamic Summary Cards */}
          <div className="space-y-1.5 text-[11px] font-mono text-gray-400 mb-3 bg-[#161822] p-2.5 rounded border border-white/5">
            <div className="flex justify-between">
              <span>Market value (USDT):</span>
              <span className="text-white font-semibold">≈{notionalValue.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span>Margin (USDT):</span>
              <span className="text-emerald-400 font-semibold">≈{marginRequired.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span>Handling fee (USDT):</span>
              <span className="text-gray-400">≈0.0000</span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1">
              <span>Balance (USDT):</span>
              {userUid ? (
                <span className="text-gray-200">{userBalance.toFixed(4)}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginPrompt(true)}
                  className="text-xs text-[#00A070] hover:underline font-medium cursor-pointer"
                >
                  Log In to View
                </button>
              )}
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            onClick={handleOpenConfirm}
            className={`w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] ${
              !userUid
                ? "bg-[#00A070] hover:bg-[#00c58a] text-white"
                : tradeDirection === "Buy Long"
                ? "bg-[#00A070] hover:bg-[#00c58a] text-white"
                : "bg-[#F6465D] hover:bg-[#e03f54] text-white"
            }`}
          >
            {!userUid ? "Log In to Trade" : tradeDirection}
          </button>
        </div>

        {/* Right Column: Live Order Book Depth */}
        <div className="col-span-5 pl-1 flex flex-col justify-center">
          <OrderBook symbol={binanceSymbol} currentPrice={currentPrice} precision={precision} />
        </div>
      </div>

      {/* Bottom Tabs: Market order  /  Transaction Record */}
      <div className="flex items-center px-4 py-3 bg-[#121212] border-b border-white/5 sticky top-12 z-20">
        <button
          onClick={() => setActiveTab("Market order")}
          className={`text-sm font-bold transition-colors ${
            activeTab === "Market order"
              ? "text-[#00A070]"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Market order ({openOrders.length})
        </button>
        <span className="mx-3 text-gray-600 font-normal">/</span>
        <button
          onClick={() => setActiveTab("Transaction Record")}
          className={`text-sm font-bold transition-colors ${
            activeTab === "Transaction Record"
              ? "text-[#00A070]"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Transaction Record
        </button>
      </div>

      {/* Orders List Container */}
      <div className="p-3 flex flex-col gap-3 min-h-[160px]">
        {activeTab === "Market order" ? (
          openOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center mb-2">
                <SlidersHorizontal className="w-5 h-5 opacity-40" />
              </div>
              <span className="text-xs">No active positions</span>
            </div>
          ) : (
            openOrders.map((order) => {
              let pnl = 0;
              const refPrice = order.symbol === displayPair ? currentPrice : order.price;
              if (order.type === "Buy Long") {
                pnl = (refPrice - order.price) * order.amount;
              } else if (order.type === "Buy Short") {
                pnl = (order.price - refPrice) * order.amount;
              }
              const isProfit = pnl >= 0;
              const margin = order.margin || (order.amount * order.price) / (order.leverage || 100);
              const formattedDate = new Date(order.createdAt).toISOString().replace("T", " ").substring(0, 19).replace(/-/g, "/");

              return (
                <div key={order.id} className="p-3.5 bg-[#1A1C24] rounded-lg border border-white/5 font-sans">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono mb-1">
                    <span>{formattedDate}</span>
                    <span className="text-white font-bold">{order.symbol}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${order.type === "Buy Long" ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                        {order.type}
                      </span>
                      <span className="text-xs text-gray-300 font-mono">
                        x{order.leverage || 100}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingPosition(order);
                          setEditStopProfit(order.stopProfit || 0);
                          setEditStopLoss(order.stopLoss || 0);
                        }}
                        className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-[11px] font-medium px-2.5 py-1 rounded transition-colors"
                      >
                        Stop loss/profit
                      </button>
                      <button
                        onClick={() => handleClosePosition(order.id)}
                        disabled={closingOrderId === order.id}
                        className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-[11px] font-medium px-2.5 py-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {closingOrderId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Close Out"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-6 text-[11px] text-gray-400 mb-3 font-mono">
                    <div>
                      <span>Stop profit: </span>
                      <span className="text-gray-200">{order.stopProfit ?? 0}</span>
                    </div>
                    <div>
                      <span>Stop loss: </span>
                      <span className="text-gray-200">{order.stopLoss ?? 0}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-[10px] text-gray-400 text-center font-mono pt-1 border-t border-white/5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Margin</span>
                      <span className="text-gray-200 font-medium">{margin.toFixed(3)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Open</span>
                      <span className="text-gray-200 font-medium">{order.price.toFixed(precision)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Current</span>
                      <span className="text-gray-200 font-medium">{refPrice.toFixed(precision)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Fee</span>
                      <span className="text-gray-200 font-medium">0</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Profits</span>
                      <span className={`font-bold ${isProfit ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                        {pnl.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          closedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center mb-2">
                <SlidersHorizontal className="w-5 h-5 opacity-40" />
              </div>
              <span className="text-xs">No records</span>
            </div>
          ) : (
            closedOrders.map((order) => {
              const isProfit = (order.realizedPnl ?? 0) >= 0;
              const margin = order.margin || (order.amount * order.price) / (order.leverage || 100);
              const formattedDate = new Date(order.updatedAt || order.createdAt).toISOString().replace("T", " ").substring(0, 19).replace(/-/g, "/");

              return (
                <div key={order.id} className="p-3.5 bg-[#1A1C24] rounded-lg border border-white/5 font-sans">
                  <div className="text-[11px] text-gray-400 font-mono mb-1">
                    {formattedDate}
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${order.type === "Buy Long" ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                        {order.type}
                      </span>
                      <span className="text-xs text-gray-300 font-mono">
                        x{order.leverage || 100}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">({order.symbol})</span>
                    </div>

                    <div className="px-2 py-0.5 rounded text-[11px] font-semibold border border-[#00A070]/60 bg-[#00A070]/10 text-[#00A070]">
                      Closed
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-[10px] text-gray-400 text-center font-mono pt-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Margin</span>
                      <span className="text-gray-200 font-medium">{margin.toFixed(3)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Open</span>
                      <span className="text-gray-200 font-medium">{order.price.toFixed(precision)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Close</span>
                      <span className="text-gray-200 font-medium">{(order.closePrice || order.price).toFixed(precision)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Fee</span>
                      <span className="text-gray-200 font-medium">0</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-500">Profits</span>
                      <span className={`font-bold ${isProfit ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                        {(order.realizedPnl ?? 0).toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* ORDER CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161822] border border-white/10 rounded-2xl p-5 shadow-2xl text-white font-sans">
            <h3 className="text-base font-bold text-center mb-5 tracking-wide">
              {displayPair}
            </h3>

            <div className="space-y-3 text-xs mb-5 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Type</span>
                <span className={`font-bold text-sm ${tradeDirection === "Buy Long" ? "text-[#00A070]" : "text-[#F6465D]"}`}>
                  {tradeDirection}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Lot / Amount</span>
                <span className="font-semibold text-white">{lotAmount} {assetBase}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Multiple / Leverage</span>
                <span className="font-semibold text-[#00A070] font-mono">x{leverage}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Price</span>
                <span className="font-semibold text-white">Best price ({formatCryptoPrice(currentPrice, precision)})</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Market value</span>
                <span className="font-semibold text-white">≈{notionalValue.toFixed(4)} USDT</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Margin</span>
                <span className="font-semibold text-emerald-400">{marginRequired.toFixed(4)} USDT</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Handling fee</span>
                <span className="font-semibold text-gray-300">0.0000 USDT</span>
              </div>
            </div>

            {/* Stepper Inputs: Stop Profit & Stop Loss */}
            <div className="space-y-3 mb-6">
              <div>
                <div className="text-[11px] text-gray-400 mb-1">Stop Profit Price:</div>
                <div className="flex items-center bg-[#1F222E] rounded border border-white/10">
                  <button
                    onClick={() => setStopProfitStep(Math.max(0, stopProfitStep - 10))}
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={stopProfitStep || ""}
                    onChange={(e) => setStopProfitStep(parseFloat(e.target.value) || 0)}
                    placeholder="Optional Target Price"
                    className="w-full bg-transparent text-center font-mono text-xs text-white focus:outline-none"
                  />
                  <button
                    onClick={() => setStopProfitStep(stopProfitStep + 10)}
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-gray-400 mb-1">Stop Loss Price:</div>
                <div className="flex items-center bg-[#1F222E] rounded border border-white/10">
                  <button
                    onClick={() => setStopLossStep(Math.max(0, stopLossStep - 10))}
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={stopLossStep || ""}
                    onChange={(e) => setStopLossStep(parseFloat(e.target.value) || 0)}
                    placeholder="Optional Stop Price"
                    className="w-full bg-transparent text-center font-mono text-xs text-white focus:outline-none"
                  />
                  <button
                    onClick={() => setStopLossStep(stopLossStep + 10)}
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="py-2.5 rounded-lg font-bold text-xs bg-[#252836] hover:bg-[#2d3142] text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOrder}
                disabled={isSubmitting}
                className="py-2.5 rounded-lg font-bold text-xs bg-[#00A070] hover:bg-[#00c58a] text-white flex items-center justify-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STOP LOSS & PROFIT EDIT MODAL */}
      {editingPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161822] border border-white/10 rounded-2xl p-5 shadow-2xl text-white font-sans">
            <h3 className="text-base font-bold text-center mb-4 tracking-wide">
              Edit Stop Loss & Profit
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <div className="text-[11px] text-gray-400 mb-1">Target Stop Profit:</div>
                <input
                  type="number"
                  value={editStopProfit || ""}
                  onChange={(e) => setEditStopProfit(parseFloat(e.target.value) || 0)}
                  placeholder="0 (Disabled)"
                  className="w-full bg-[#1F222E] rounded border border-white/10 px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div>
                <div className="text-[11px] text-gray-400 mb-1">Target Stop Loss:</div>
                <input
                  type="number"
                  value={editStopLoss || ""}
                  onChange={(e) => setEditStopLoss(parseFloat(e.target.value) || 0)}
                  placeholder="0 (Disabled)"
                  className="w-full bg-[#1F222E] rounded border border-white/10 px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-[#00A070]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setEditingPosition(null)}
                className="py-2.5 rounded-lg font-bold text-xs bg-[#252836] hover:bg-[#2d3142] text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStopProfitLoss}
                disabled={isUpdatingSLTP}
                className="py-2.5 rounded-lg font-bold text-xs bg-[#00A070] hover:bg-[#00c58a] text-white flex items-center justify-center gap-1.5"
              >
                {isUpdatingSLTP && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Login Required Authentication Modal */}
      <LoginPromptModal
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        title="Log In to Trade Perpetuals"
        description={`Please log in to your account to trade ${displayPair}, place orders, and manage positions.`}
        returnUrl={`/trade?symbol=${binanceSymbol}`}
      />
    </div>
  );
}
