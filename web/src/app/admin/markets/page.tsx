"use client";

import { useEffect, useState } from "react";
import { 
  getAllMarketsAdmin, 
  createMarket, 
  updateMarket, 
  deleteMarket, 
  toggleMarketStatus, 
  toggleMarketHomeListing, 
  reorderMarkets 
} from "@/actions/markets";
import { 
  Coins, 
  Plus, 
  Search, 
  Filter, 
  ArrowUp, 
  ArrowDown, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Loader2, 
  ShieldAlert, 
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function AdminMarketsPage() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deletingMarket, setDeletingMarket] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    baseAsset: "",
    quoteAsset: "USDT",
    symbol: "",
    displayName: "",
    binanceSymbol: "",
    category: "CRYPTO",
    tradingModes: "ALL",
    status: "ACTIVE",
    pricePrecision: 2,
    qtyPrecision: 4,
    minOrderQty: 0.001,
    maxOrderQty: 1000000,
    minMargin: 1.0,
    maxLeverage: 100,
    payoutRate: 1.8,
    isListedOnHome: true,
    isTopTicker: false,
  });

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const data = await getAllMarketsAdmin();
      setMarkets(data);
    } catch {
      toast.error("Failed to fetch markets. Admin permission required.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  const openCreateModal = () => {
    setEditingMarket(null);
    setFormData({
      baseAsset: "",
      quoteAsset: "USDT",
      symbol: "",
      displayName: "",
      binanceSymbol: "",
      category: "CRYPTO",
      tradingModes: "ALL",
      status: "ACTIVE",
      pricePrecision: 2,
      qtyPrecision: 4,
      minOrderQty: 0.001,
      maxOrderQty: 1000000,
      minMargin: 1.0,
      maxLeverage: 100,
      payoutRate: 1.8,
      isListedOnHome: true,
      isTopTicker: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (m: any) => {
    setEditingMarket(m);
    setFormData({
      baseAsset: m.baseAsset,
      quoteAsset: m.quoteAsset,
      symbol: m.symbol,
      displayName: m.displayName,
      binanceSymbol: m.binanceSymbol,
      category: m.category,
      tradingModes: m.tradingModes,
      status: m.status,
      pricePrecision: m.pricePrecision,
      qtyPrecision: m.qtyPrecision,
      minOrderQty: m.minOrderQty,
      maxOrderQty: m.maxOrderQty,
      minMargin: m.minMargin,
      maxLeverage: m.maxLeverage,
      payoutRate: m.payoutRate,
      isListedOnHome: m.isListedOnHome,
      isTopTicker: m.isTopTicker,
    });
    setIsModalOpen(true);
  };

  const handleBaseAssetChange = (base: string) => {
    const upperBase = base.toUpperCase();
    const upperQuote = formData.quoteAsset.toUpperCase();
    setFormData((prev) => ({
      ...prev,
      baseAsset: upperBase,
      symbol: upperBase ? `${upperBase}/${upperQuote}` : "",
      binanceSymbol: upperBase ? `${upperBase}${upperQuote}` : "",
      displayName: prev.displayName || upperBase,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symbol || !formData.baseAsset || !formData.binanceSymbol) {
      toast.error("Base Asset, Symbol, and Binance Symbol are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingMarket) {
        const res = await updateMarket(editingMarket.id, formData);
        if (res.success) {
          toast.success(`Market ${formData.symbol} updated successfully!`);
          setIsModalOpen(false);
          await fetchMarkets();
        } else {
          toast.error(res.error || "Failed to update market.");
        }
      } else {
        const res = await createMarket(formData);
        if (res.success) {
          toast.success(`Market ${formData.symbol} created successfully!`);
          setIsModalOpen(false);
          await fetchMarkets();
        } else {
          toast.error(res.error || "Failed to create market.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const res = await toggleMarketStatus(id);
      if (res.success && res.market) {
        toast.success(`Market status set to ${res.market.status}`);
        setMarkets((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: res.market.status } : m))
        );
      } else {
        toast.error(res.error || "Failed to toggle status");
      }
    } catch {
      toast.error("Failed to toggle market status.");
    }
  };

  const handleToggleHomeListing = async (id: string) => {
    try {
      const res = await toggleMarketHomeListing(id);
      if (res.success && res.market) {
        toast.success(`Homepage visibility updated: ${res.market.isListedOnHome ? "Listed" : "Hidden"}`);
        setMarkets((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isListedOnHome: res.market.isListedOnHome } : m))
        );
      } else {
        toast.error(res.error || "Failed to toggle home listing");
      }
    } catch {
      toast.error("Failed to toggle home listing.");
    }
  };

  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= markets.length) return;

    const newMarkets = [...markets];
    const temp = newMarkets[index];
    newMarkets[index] = newMarkets[targetIndex];
    newMarkets[targetIndex] = temp;

    setMarkets(newMarkets);

    try {
      const ids = newMarkets.map((m) => m.id);
      await reorderMarkets(ids);
      toast.success("Market order updated!");
    } catch {
      toast.error("Failed to save reordering.");
      await fetchMarkets();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingMarket) return;
    setIsDeleting(true);
    try {
      const res = await deleteMarket(deletingMarket.id);
      if (res.success) {
        toast.success(res.message);
        setDeletingMarket(null);
        await fetchMarkets();
      } else {
        toast.error(res.error || "Failed to delete market.");
      }
    } catch {
      toast.error("An error occurred during deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredMarkets = markets.filter((m) => {
    const matchesSearch =
      m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.binanceSymbol.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || m.status.toUpperCase() === statusFilter.toUpperCase();

    const matchesMode =
      modeFilter === "ALL" ||
      m.tradingModes.toUpperCase() === modeFilter.toUpperCase() ||
      m.tradingModes.toUpperCase() === "ALL";

    return matchesSearch && matchesStatus && matchesMode;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#161822] p-6 rounded-2xl border border-white/5 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00A070]/10 text-[#00A070] border border-[#00A070]/20">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Market Management</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Manage trading pairs, precision, order limits, and homepage listings with real Binance feeds.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link
            href="/trade"
            target="_blank"
            className="px-4 py-2.5 rounded-xl bg-[#1A1C24] hover:bg-[#252836] border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <span>Live Trade</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={openCreateModal}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#00c58a] text-white text-xs font-bold transition-all shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Market</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#161822] p-4 rounded-xl border border-white/5">
        <div className="sm:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by symbol, name, or Binance pair..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1A1C24] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
          />
        </div>

        <div className="sm:col-span-3 flex items-center gap-2">
          <span className="text-xs text-gray-400 whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DELISTED">Delisted</option>
          </select>
        </div>

        <div className="sm:col-span-4 flex items-center gap-2">
          <span className="text-xs text-gray-400 whitespace-nowrap">Trading Mode:</span>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
          >
            <option value="ALL">All Trading Modes</option>
            <option value="PERPETUAL">Perpetual Futures</option>
            <option value="OPTION">Binary Options</option>
          </select>
        </div>
      </div>

      {/* Markets Table */}
      <div className="bg-[#161822] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1A1C24] text-gray-400 border-b border-white/5 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">Order</th>
                <th className="py-3.5 px-4">Market Symbol</th>
                <th className="py-3.5 px-4">Binance Feed</th>
                <th className="py-3.5 px-4">Mode</th>
                <th className="py-3.5 px-4">Precision</th>
                <th className="py-3.5 px-4">Limits</th>
                <th className="py-3.5 px-4 text-center">Home List</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#00A070]" />
                    <span>Loading markets...</span>
                  </td>
                </tr>
              ) : filteredMarkets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    No markets found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredMarkets.map((market, idx) => (
                  <tr key={market.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Reorder Buttons */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleMoveOrder(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 rounded bg-[#1A1C24] hover:bg-[#222530] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveOrder(idx, "down")}
                          disabled={idx === filteredMarkets.length - 1}
                          className="p-1 rounded bg-[#1A1C24] hover:bg-[#222530] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Symbol & Display Name */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm font-mono flex items-center gap-1.5">
                          {market.symbol}
                          {market.isTopTicker && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 font-sans font-semibold border border-amber-500/30">
                              TOP
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-gray-400">{market.displayName}</span>
                      </div>
                    </td>

                    {/* Binance Symbol */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-[#1A1C24] text-emerald-400 border border-white/5">
                        {market.binanceSymbol}
                      </span>
                    </td>

                    {/* Trading Modes */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {market.tradingModes}
                      </span>
                    </td>

                    {/* Precision */}
                    <td className="py-3 px-4 font-mono text-gray-300">
                      <div>Price: {market.pricePrecision} dec</div>
                      <div className="text-[10px] text-gray-400">Qty: {market.qtyPrecision} dec</div>
                    </td>

                    {/* Limits */}
                    <td className="py-3 px-4 font-mono text-gray-300">
                      <div>Lev: {market.maxLeverage}x</div>
                      <div className="text-[10px] text-gray-400">Min: {market.minOrderQty}</div>
                    </td>

                    {/* Home Listing Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleHomeListing(market.id)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          market.isListedOnHome
                            ? "bg-[#00A070]/20 text-[#00A070] border border-[#00A070]/40"
                            : "bg-gray-800 text-gray-400 border border-gray-700"
                        }`}
                      >
                        {market.isListedOnHome ? "Listed" : "Hidden"}
                      </button>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(market.id, market.status)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          market.status === "ACTIVE"
                            ? "bg-[#00A070]/20 text-[#00A070] border border-[#00A070]/40"
                            : market.status === "SUSPENDED"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            : "bg-red-500/20 text-red-400 border border-red-500/40"
                        }`}
                      >
                        {market.status}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(market)}
                          className="p-1.5 rounded-lg bg-[#1A1C24] hover:bg-[#252836] text-gray-300 hover:text-white transition-colors"
                          title="Edit Market"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingMarket(market)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                          title="Delete / Archive Market"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MARKET MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#00A070]" />
                <span>{editingMarket ? `Edit Market: ${editingMarket.symbol}` : "Add New Trading Market"}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Base Asset <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SOL, DOGE, ADA"
                    value={formData.baseAsset}
                    onChange={(e) => handleBaseAssetChange(e.target.value)}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-[#00A070]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Quote Asset</label>
                  <input
                    type="text"
                    required
                    value={formData.quoteAsset}
                    onChange={(e) => {
                      const quote = e.target.value.toUpperCase();
                      setFormData((prev) => ({
                        ...prev,
                        quoteAsset: quote,
                        symbol: prev.baseAsset ? `${prev.baseAsset}/${quote}` : "",
                        binanceSymbol: prev.baseAsset ? `${prev.baseAsset}${quote}` : "",
                      }));
                    }}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Trading Pair Symbol</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SOL/USDT"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#00A070]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solana, Dogecoin"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Binance Symbol Identifier <span className="text-red-400">*</span>
                  <span className="text-[10px] text-gray-400 ml-2 font-normal">(Used for live candles & quotes feed)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SOLUSDT, DOGEUSDT"
                  value={formData.binanceSymbol}
                  onChange={(e) => setFormData({ ...formData, binanceSymbol: e.target.value.toUpperCase() })}
                  className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Trading Modes</label>
                  <select
                    value={formData.tradingModes}
                    onChange={(e) => setFormData({ ...formData, tradingModes: e.target.value })}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  >
                    <option value="ALL">All Modes</option>
                    <option value="PERPETUAL">Perpetual Only</option>
                    <option value="OPTION">Option Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Price Decimals</label>
                  <input
                    type="number"
                    min="0"
                    max="8"
                    value={formData.pricePrecision}
                    onChange={(e) => setFormData({ ...formData, pricePrecision: parseInt(e.target.value) || 2 })}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Max Leverage</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.maxLeverage}
                    onChange={(e) => setFormData({ ...formData, maxLeverage: parseInt(e.target.value) || 50 })}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Min Order Qty</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.minOrderQty}
                    onChange={(e) => setFormData({ ...formData, minOrderQty: parseFloat(e.target.value) || 0.001 })}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Option Payout (x)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="3.0"
                    value={formData.payoutRate}
                    onChange={(e) => setFormData({ ...formData, payoutRate: parseFloat(e.target.value) || 1.8 })}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-[#1A1C24] p-3.5 rounded-xl border border-white/5 space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isListedOnHome}
                    onChange={(e) => setFormData({ ...formData, isListedOnHome: e.target.checked })}
                    className="w-4 h-4 rounded text-[#00A070] focus:ring-0 bg-[#252836] border-white/10"
                  />
                  <span className="text-xs text-gray-200">Show on Homepage Market List (Gainers)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isTopTicker}
                    onChange={(e) => setFormData({ ...formData, isTopTicker: e.target.checked })}
                    className="w-4 h-4 rounded text-[#00A070] focus:ring-0 bg-[#252836] border-white/10"
                  />
                  <span className="text-xs text-gray-200">Display in Top 3 Homepage Header Tickers</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#252836] hover:bg-[#2e3244] text-xs font-semibold text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-[#00A070] hover:bg-[#00c58a] text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-[#00A070]/20"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingMarket ? "Save Changes" : "Create Market"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / ARCHIVE CONFIRMATION MODAL */}
      {deletingMarket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <div className="p-2.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Delete or Archive Market?</h3>
            </div>

            <p className="text-xs text-gray-300 mb-4 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-white">{deletingMarket.symbol}</span>?
            </p>

            <div className="p-3 bg-[#1A1C24] rounded-lg border border-white/5 text-[11px] text-gray-400 mb-5 space-y-1">
              <div className="font-semibold text-gray-300">Financial Integrity Protection:</div>
              <div>If users have open positions or trade history under this market, the system will safely <strong>Delist and Archive</strong> it instead of a hard deletion. Historical trade records and user balances will remain 100% intact.</div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingMarket(null)}
                className="px-4 py-2 rounded-xl bg-[#252836] hover:bg-[#2e3244] text-xs font-semibold text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-red-600/20"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Removal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
