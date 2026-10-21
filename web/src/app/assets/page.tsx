"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Eye,
  EyeOff,
  Search,
  Download,
  Upload,
  Shield,
  Loader2,
  TrendingUp,
  Clock,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserAssetSummary } from "@/actions/user";

export default function AssetsPage() {
  const router = useRouter();

  // Active Tab: "Currency Account" | "Contract Account" | "Options Account" | "Funding (P2P) Account"
  const accountTabs = [
    "Currency Account",
    "Contract Account",
    "Options Account",
    "Funding (P2P) Account",
  ] as const;
  type TabType = (typeof accountTabs)[number];
  const [activeTab, setActiveTab] = useState<TabType>("Currency Account");

  // State
  const [assetData, setAssetData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);
  const [hideSmallAssets, setHideSmallAssets] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load user asset summary
  const loadData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsRefreshing(true);
    try {
      const data = await getUserAssetSummary();
      if (!data) {
        // If unauthenticated, redirect to login
        router.push("/login?redirect=/assets");
        return;
      }
      setAssetData(data);
    } catch (err: any) {
      console.error("Failed to load asset summary:", err);
      const errMsg = String(err?.message || "");
      if (
        errMsg.includes("Failed to find Server Action") ||
        errMsg.includes("older or newer deployment") ||
        errMsg.includes("503")
      ) {
        const lastReload = sessionStorage.getItem("__ethsltd_assets_reload");
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem("__ethsltd_assets_reload", String(now));
          window.location.reload();
          return;
        }
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let inFlight = false;
    const fetchSafe = async (showLoading = false) => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        await loadData(showLoading);
      } finally {
        inFlight = false;
      }
    };

    fetchSafe(false);

    // Auto-refresh every 10 seconds to keep On Order and On Hold in sync in real-time
    const interval = setInterval(() => {
      fetchSafe(false);
    }, 10000);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchSafe(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Filtered Currency Assets
  const filteredAssets = useMemo(() => {
    if (!assetData?.categories?.currency?.assets) return [];
    let list = assetData.categories.currency.assets;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a: any) =>
          a.name.toLowerCase().includes(q) || a.fullName.toLowerCase().includes(q)
      );
    }

    if (hideSmallAssets) {
      list = list.filter((a: any) => {
        const usdVal = parseFloat(a.value.replace(/[^0-9.]/g, "") || "0");
        return usdVal >= 1.0;
      });
    }

    return list;
  }, [assetData, searchQuery, hideSmallAssets]);

  const summary = assetData?.summary || {
    availableUsdt: 0,
    onOrderUsdt: 0,
    onHoldUsdt: 0,
    totalUsdt: 0,
  };

  const contractInfo = assetData?.categories?.contract || {
    availableUsdt: 0,
    marginOnOrders: 0,
    totalUsdtEquivalent: 0,
    openPositionsCount: 0,
    openPositions: [],
  };

  const optionsInfo = assetData?.categories?.options || {
    availableUsdt: 0,
    investedOnOrders: 0,
    totalUsdtEquivalent: 0,
    activeOptionsCount: 0,
    activeOptions: [],
  };

  const fundingInfo = assetData?.categories?.funding || {
    totalUsdtEquivalent: 0,
    availableUsdt: 0,
    escrowLockedUsdt: 0,
    assets: [],
  };

  // Format currency helpers
  const mask = (val: string | number) => (hideBalances ? "••••••••" : val);

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      {/* Header Account Category Tabs */}
      <div className="flex overflow-x-auto bg-[#00A070] no-scrollbar">
        {accountTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 whitespace-nowrap text-sm font-semibold transition-all relative ${
              tab === activeTab
                ? "text-white font-bold"
                : "text-white/70 hover:text-white/90"
            }`}
          >
            {tab}
            {tab === activeTab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-sm" />
            )}
          </button>
        ))}
      </div>

      {/* Main Asset Header Card */}
      <div className="p-4 bg-[#1A1C24] border-b border-white/5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs font-semibold">
              {activeTab === "Currency Account"
                ? "Total Assets(USDT)"
                : activeTab === "Contract Account"
                ? "Contract Equity(USDT)"
                : activeTab === "Options Account"
                ? "Options Equity(USDT)"
                : "Funding & P2P Equity(USDT)"}
            </span>
            <button
              onClick={() => loadData(true)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Refresh Balance"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#00A070]" : ""}`}
              />
            </button>
          </div>
          <button
            onClick={() => setHideBalances(!hideBalances)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title={hideBalances ? "Show Balances" : "Hide Balances"}
          >
            {hideBalances ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* Large Balance Display */}
        <div className="mb-1">
          <span className="text-3xl font-bold font-mono tracking-tight text-white">
            {mask(
              activeTab === "Currency Account"
                ? summary.totalUsdt.toFixed(4)
                : activeTab === "Contract Account"
                ? contractInfo.totalUsdtEquivalent.toFixed(4)
                : activeTab === "Options Account"
                ? optionsInfo.totalUsdtEquivalent.toFixed(4)
                : fundingInfo.totalUsdtEquivalent.toFixed(4)
            )}
          </span>
        </div>

        <div className="text-gray-500 text-xs mb-3 font-mono">
          ≈$
          {mask(
            activeTab === "Currency Account"
              ? summary.totalUsdt.toFixed(2)
              : activeTab === "Contract Account"
              ? contractInfo.totalUsdtEquivalent.toFixed(2)
              : activeTab === "Options Account"
              ? optionsInfo.totalUsdtEquivalent.toFixed(2)
              : fundingInfo.totalUsdtEquivalent.toFixed(2)
          )}{" "}
          USD
        </div>

        {/* Balance Breakdown Chips: Available vs On Order vs On Hold */}
        <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-[#121212]/80 rounded-xl border border-white/5 mb-4 text-[11px] font-mono">
          <div className="flex flex-col">
            <span className="text-gray-400 text-[10px] font-sans flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00A070]" />
              Available
            </span>
            <span className="font-bold text-gray-200 truncate mt-0.5">
              {mask(
                activeTab === "Currency Account"
                  ? summary.availableUsdt.toFixed(2)
                  : activeTab === "Contract Account"
                  ? contractInfo.availableUsdt.toFixed(2)
                  : activeTab === "Options Account"
                  ? optionsInfo.availableUsdt.toFixed(2)
                  : fundingInfo.availableUsdt.toFixed(2)
              )}
            </span>
          </div>

          <div className="flex flex-col border-l border-white/5 pl-2">
            <span className="text-gray-400 text-[10px] font-sans flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              {activeTab === "Funding (P2P) Account" ? "In Escrow" : "On orders"}
            </span>
            <span
              className={`font-bold truncate mt-0.5 ${
                (activeTab === "Currency Account"
                  ? summary.onOrderUsdt
                  : activeTab === "Contract Account"
                  ? contractInfo.marginOnOrders
                  : activeTab === "Options Account"
                  ? optionsInfo.investedOnOrders
                  : fundingInfo.escrowLockedUsdt) > 0
                  ? "text-amber-400"
                  : "text-gray-400"
              }`}
            >
              {mask(
                (activeTab === "Currency Account"
                  ? summary.onOrderUsdt
                  : activeTab === "Contract Account"
                  ? contractInfo.marginOnOrders
                  : activeTab === "Options Account"
                  ? optionsInfo.investedOnOrders
                  : fundingInfo.escrowLockedUsdt
                ).toFixed(2)
              )}
            </span>
          </div>

          <div className="flex flex-col border-l border-white/5 pl-2">
            <span className="text-gray-400 text-[10px] font-sans flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-rose-400" />
              On hold
            </span>
            <span
              className={`font-bold truncate mt-0.5 ${
                (activeTab === "Funding (P2P) Account" ? 0 : summary.onHoldUsdt) > 0
                  ? "text-rose-400"
                  : "text-gray-400"
              }`}
            >
              {mask((activeTab === "Funding (P2P) Account" ? 0 : summary.onHoldUsdt).toFixed(2))}
            </span>
          </div>
        </div>

        {/* UID & Records */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-block px-3 py-1 bg-[#121212] rounded-full border border-[#00A070]/50 text-[#00A070] text-xs font-mono font-semibold">
            UID: {assetData?.uid || "••••••"}
          </div>

          <Link
            href="/assets/records"
            className="text-xs text-[#00A070] font-medium hover:underline flex items-center gap-1"
          >
            <span>View Records</span>
            <span>›</span>
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Link
            href="/assets/deposit"
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#222530] hover:bg-[#2A2D38] transition-all border border-white/5 group active:scale-[0.98]"
          >
            <Download className="w-5 h-5 text-[#00A070] mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs text-gray-300 font-medium">Deposit</span>
          </Link>
          <Link
            href="/assets/withdraw"
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#222530] hover:bg-[#2A2D38] transition-all border border-white/5 group active:scale-[0.98]"
          >
            <Upload className="w-5 h-5 text-[#00A070] mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs text-gray-300 font-medium">Withdraw</span>
          </Link>
          <Link
            href="/profile/kyc"
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#222530] hover:bg-[#2A2D38] transition-all border border-white/5 group active:scale-[0.98]"
          >
            <Shield className="w-5 h-5 text-[#00A070] mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs text-gray-300 font-medium">KYC Center</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CURRENCY / SPOT ACCOUNT TAB */}
      {/* ========================================================================= */}
      {activeTab === "Currency Account" && (
        <>
          {/* Asset List Search & Filter */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 gap-3">
            <div className="flex items-center bg-[#1A1C24] px-3 py-1.5 rounded-lg border border-white/5 flex-1 max-w-[200px]">
              <Search className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search asset"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-white outline-none w-full placeholder:text-gray-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setHideSmallAssets(!hideSmallAssets)}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <span className="text-xs text-gray-400">Hide small assets</span>
              <div
                className={`w-4 h-4 rounded-full border transition-colors flex items-center justify-center ${
                  hideSmallAssets
                    ? "bg-[#00A070] border-[#00A070]"
                    : "border-gray-500 bg-transparent"
                }`}
              >
                {hideSmallAssets && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </button>
          </div>

          {/* Asset List */}
          <div className="flex flex-col p-3 space-y-2.5">
            {isLoading ? (
              <div className="flex justify-center py-16 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-[#00A070]" />
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-16 text-xs text-gray-500">
                No matching assets found.
              </div>
            ) : (
              filteredAssets.map((asset: any) => (
                <div
                  key={asset.name}
                  className="bg-[#1A1C24] p-4 rounded-xl border border-white/5 font-sans hover:border-white/10 transition-colors"
                >
                  {/* Top Row: Icon, Name & Total Value */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
                        style={{ backgroundColor: asset.color }}
                      >
                        {asset.name.substring(0, 1)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-1.5">
                          <span>{asset.name}</span>
                          {parseFloat(asset.orders) > 0 && (
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded font-mono font-medium border border-amber-500/20">
                              In Order
                            </span>
                          )}
                          {parseFloat(asset.onHold) > 0 && (
                            <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.2 rounded font-mono font-medium border border-rose-500/20">
                              On Hold
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500">{asset.fullName}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-sm font-semibold text-white">
                        {mask(asset.amount)}
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {mask(asset.value)}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Detailed Accounting (Available vs On Orders vs On Hold) */}
                  <div className="grid grid-cols-3 text-xs text-gray-500 border-t border-white/5 pt-2.5 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400">Available</span>
                      <span className="font-mono text-gray-200 font-semibold truncate">
                        {mask(asset.available)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400">On orders</span>
                      <span
                        className={`font-mono font-semibold truncate ${
                          parseFloat(asset.orders) > 0 ? "text-amber-400" : "text-gray-400"
                        }`}
                      >
                        {mask(asset.orders)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400">On hold</span>
                      <span
                        className={`font-mono font-semibold truncate ${
                          parseFloat(asset.onHold) > 0 ? "text-rose-400" : "text-gray-400"
                        }`}
                      >
                        {mask(asset.onHold)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. CONTRACT / PERPETUAL ACCOUNT TAB */}
      {/* ========================================================================= */}
      {activeTab === "Contract Account" && (
        <div className="p-4 flex flex-col gap-4">
          <div className="bg-[#1A1C24] p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm text-white">Contract Positions</span>
              <span className="text-xs text-[#00A070] font-mono">
                {contractInfo.openPositionsCount} Active
              </span>
            </div>

            {contractInfo.openPositions.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center gap-3">
                <TrendingUp className="w-8 h-8 text-gray-600" />
                <span className="text-xs text-gray-500">
                  No active perpetual contract positions.
                </span>
                <Link
                  href="/trade"
                  className="px-4 py-2 bg-[#00A070] hover:bg-[#00b880] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>Trade Perpetuals</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {contractInfo.openPositions.map((pos: any) => (
                  <div
                    key={pos.id}
                    className="p-3 bg-[#121212] rounded-lg border border-white/5 font-mono text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-sans">{pos.symbol}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            pos.type.includes("Long")
                              ? "bg-[#00A070]/20 text-[#00A070]"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {pos.type} {pos.leverage ? `x${pos.leverage}` : ""}
                        </span>
                      </div>
                      <span className="text-amber-400 font-bold">
                        Margin: {(pos.margin || 0).toFixed(2)} USDT
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-1 text-[11px] text-gray-400 pt-1 border-t border-white/5">
                      <span>Entry Price: ${pos.price.toFixed(2)}</span>
                      <span className="text-right">Quantity: {pos.amount}</span>
                      {pos.stopProfit && <span>Take Profit: +${pos.stopProfit}</span>}
                      {pos.stopLoss && <span className="text-right">Stop Loss: -${pos.stopLoss}</span>}
                    </div>

                    <div className="pt-1 flex justify-end">
                      <Link
                        href="/trade"
                        className="text-[11px] text-[#00A070] hover:underline flex items-center gap-1"
                      >
                        <span>Manage in Trade</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. OPTIONS ACCOUNT TAB */}
      {/* ========================================================================= */}
      {activeTab === "Options Account" && (
        <div className="p-4 flex flex-col gap-4">
          <div className="bg-[#1A1C24] p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm text-white">Active Option Contracts</span>
              <span className="text-xs text-[#00A070] font-mono">
                {optionsInfo.activeOptionsCount} Awaiting
              </span>
            </div>

            {optionsInfo.activeOptions.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center gap-3">
                <Clock className="w-8 h-8 text-gray-600" />
                <span className="text-xs text-gray-500">
                  No awaiting binary options contracts.
                </span>
                <Link
                  href="/options"
                  className="px-4 py-2 bg-[#00A070] hover:bg-[#00b880] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>Trade Options</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {optionsInfo.activeOptions.map((opt: any) => (
                  <div
                    key={opt.id}
                    className="p-3 bg-[#121212] rounded-lg border border-white/5 font-mono text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-sans">{opt.symbol}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            opt.type === "Rise"
                              ? "bg-[#00A070]/20 text-[#00A070]"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {opt.type.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-amber-400 font-bold">
                        Invested: {opt.amount.toFixed(2)} USDT
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-1 text-[11px] text-gray-400 pt-1 border-t border-white/5">
                      <span>Entry: ${opt.price.toFixed(2)}</span>
                      <span className="text-right">Payout: {opt.payout ? `+${(opt.payout * 100 - 100).toFixed(0)}%` : "+80%"}</span>
                      {opt.duration && <span>Duration: {opt.duration}s</span>}
                      <span className="text-right text-[#00A070] font-bold">Status: {opt.status}</span>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <Link
                        href="/options"
                        className="text-[11px] text-[#00A070] hover:underline flex items-center gap-1"
                      >
                        <span>View Countdown in Options</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FUNDING / P2P ACCOUNT TAB */}
      {/* ========================================================================= */}
      {activeTab === "Funding (P2P) Account" && (
        <div className="p-4 space-y-4">
          <div className="bg-[#1A1C24] p-5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Funding & P2P Balance</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Dedicated balance for peer-to-peer advertisements, orders, and escrow security.
                </p>
              </div>
              <Link
                href="/p2p/profile"
                className="px-3.5 py-1.5 rounded-lg bg-[#00A070] text-white text-xs font-bold hover:bg-[#00B07C] transition-colors"
              >
                P2P Merchant Profile
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-[#121212] p-4 rounded-xl border border-white/5">
                <span className="text-gray-400 text-xs block mb-1">Available for P2P</span>
                <span className="font-mono text-lg font-bold text-white">
                  {mask(Number(fundingInfo.availableUsdt || 0).toFixed(2))} USDT
                </span>
              </div>

              <div className="bg-[#121212] p-4 rounded-xl border border-white/5">
                <span className="text-gray-400 text-xs block mb-1">Locked in Escrow</span>
                <span className="font-mono text-lg font-bold text-amber-400">
                  {mask(Number(fundingInfo.escrowLockedUsdt || 0).toFixed(2))} USDT
                </span>
              </div>

              <div className="bg-[#121212] p-4 rounded-xl border border-white/5 col-span-2 sm:col-span-1">
                <span className="text-gray-400 text-xs block mb-1">Total Equity</span>
                <span className="font-mono text-lg font-bold text-[#00A070]">
                  {mask(Number(fundingInfo.totalUsdtEquivalent || 0).toFixed(2))} USDT
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                href="/p2p/profile"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00A070] hover:bg-[#00B07C] text-white text-xs font-bold shadow-md shadow-[#00A070]/20 transition-all"
              >
                Transfer (Spot ⇄ P2P)
              </Link>
              <Link
                href="/p2p"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition-colors"
              >
                P2P Marketplace →
              </Link>
              <Link
                href="/p2p/post-ad"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition-colors"
              >
                Post P2P Ad →
              </Link>
              <Link
                href="/p2p/orders"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition-colors"
              >
                My Orders →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
