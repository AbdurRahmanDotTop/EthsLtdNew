"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getAdminFiatCurrencies,
  createAdminFiatCurrency,
  updateAdminFiatCurrency,
  toggleAdminFiatCurrency,
  deleteAdminFiatCurrency,
  FiatCurrencyInput,
} from "@/actions/admin";
import {
  Banknote,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Globe2,
  Coins,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminFiatCurrenciesPage() {
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<any | null>(null);
  const [form, setForm] = useState<FiatCurrencyInput>({
    code: "",
    name: "",
    symbol: "",
    country: "",
    decimals: 2,
    isActive: true,
    canP2p: true,
    displayOrder: 1,
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadData = async () => {
    try {
      const res = await getAdminFiatCurrencies({
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      if (res.success && res.data) {
        setCurrencies(res.data);
      } else {
        toast.error(res.error || "Failed to load fiat currencies");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load fiat currencies");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    loadData();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openCreateModal = () => {
    setEditingCurrency(null);
    setForm({
      code: "",
      name: "",
      symbol: "",
      country: "",
      decimals: 2,
      isActive: true,
      canP2p: true,
      displayOrder: currencies.length + 1,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (curr: any) => {
    setEditingCurrency(curr);
    setForm({
      code: curr.code,
      name: curr.name,
      symbol: curr.symbol,
      country: curr.country || "",
      decimals: curr.decimals ?? 2,
      isActive: curr.isActive,
      canP2p: curr.canP2p,
      displayOrder: curr.displayOrder ?? 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.symbol.trim()) {
      toast.error("Code, Name, and Symbol are required");
      return;
    }

    setSaving(true);
    try {
      if (editingCurrency) {
        const res = await updateAdminFiatCurrency(editingCurrency.id, {
          name: form.name,
          symbol: form.symbol,
          country: form.country,
          decimals: Number(form.decimals),
          isActive: form.isActive,
          canP2p: form.canP2p,
          displayOrder: Number(form.displayOrder),
        });
        if (res.success) {
          toast.success(`Fiat currency ${form.code} updated successfully`);
          setIsModalOpen(false);
          loadData();
        } else {
          toast.error(res.error || "Update failed");
        }
      } else {
        const res = await createAdminFiatCurrency({
          code: form.code.toUpperCase().trim(),
          name: form.name.trim(),
          symbol: form.symbol.trim(),
          country: form.country?.trim() || undefined,
          decimals: Number(form.decimals),
          isActive: form.isActive,
          canP2p: form.canP2p,
          displayOrder: Number(form.displayOrder),
        });
        if (res.success) {
          toast.success(`Fiat currency ${form.code.toUpperCase()} created successfully`);
          setIsModalOpen(false);
          loadData();
        } else {
          toast.error(res.error || "Creation failed");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, field: "isActive" | "canP2p", currentVal: boolean) => {
    try {
      const res = await toggleAdminFiatCurrency(id, field, !currentVal);
      if (res.success) {
        toast.success(`Currency setting updated`);
        setCurrencies((prev) =>
          prev.map((c) => (c.id === id ? { ...c, [field]: !currentVal } : c))
        );
      } else {
        toast.error(res.error || "Toggle failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Toggle failed");
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleteLoading(true);
    try {
      const res = await deleteAdminFiatCurrency(deletingId);
      if (res.success) {
        toast.success("Fiat currency deleted successfully");
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        loadData();
      } else {
        toast.error(res.error || "Delete failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredCurrencies = currencies.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesSearch =
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.country && c.country.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    if (statusFilter === "active" && !c.isActive) return false;
    if (statusFilter === "inactive" && c.isActive) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/p2p"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
              title="Back to P2P Oversight"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Fiat Assets & Currencies
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                Manage supported fiat currencies, country mappings, decimal precision, and P2P trading availability.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link
            href="/admin/assets/crypto"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs sm:text-sm font-medium transition-all shrink-0"
          >
            <Coins className="w-4 h-4 text-emerald-400" />
            <span>Crypto Assets</span>
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-50 shrink-0 cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Fiat Currency</span>
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-xs text-gray-300 leading-relaxed">
          <span className="font-semibold text-emerald-300">Centralized Fiat System: </span>
          Currencies configured here automatically drive the fiat selection in P2P Ad Posting, marketplace filters, and trader payment method configurations. Deleting a currency is protected if active ads depend on it; toggle Active/Inactive to control availability safely.
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by currency code (INR, USD), name, or country..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#161822] border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </form>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#161822] p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              All ({currencies.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === "active"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Active ({currencies.filter((c) => c.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === "inactive"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Disabled ({currencies.filter((c) => !c.isActive).length})
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Currencies */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading fiat currencies...</span>
        </div>
      ) : filteredCurrencies.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-white/5 bg-[#161822]/40">
          <Banknote className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No fiat currencies found</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            {search
              ? "No currencies match your search query."
              : "Get started by adding your first supported fiat currency."}
          </p>
          {!search && (
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" /> Add Fiat Currency
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCurrencies.map((curr) => (
            <div
              key={curr.id}
              className={`p-5 rounded-2xl border transition-all ${
                curr.isActive
                  ? "bg-[#161822] border-white/10 hover:border-emerald-500/30"
                  : "bg-[#12131a] border-white/5 opacity-70"
              }`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
                    {curr.symbol || curr.code.substring(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white tracking-wide">{curr.code}</h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                        {curr.symbol}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{curr.name}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(curr)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    title="Edit Currency"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setDeletingId(curr.id);
                      setDeleteConfirmOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                    title="Delete Currency"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 py-3 border-y border-white/5 text-xs text-gray-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Globe2 className="w-3.5 h-3.5" /> Country / Region:
                  </span>
                  <span className="text-gray-300 font-medium">{curr.country || "Global / Multi"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Decimals:</span>
                  <span className="text-gray-300 font-mono">{curr.decimals}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Display Order:</span>
                  <span className="text-gray-300 font-mono">#{curr.displayOrder}</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  {/* Status Toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={curr.isActive}
                      onChange={() => handleToggle(curr.id, "isActive", curr.isActive)}
                      className="sr-only"
                    />
                    <div
                      className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center px-0.5 ${
                        curr.isActive ? "bg-emerald-500" : "bg-gray-700"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                          curr.isActive ? "translate-x-3.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                    <span className={curr.isActive ? "text-emerald-400 font-medium" : "text-gray-500"}>
                      {curr.isActive ? "Active" : "Disabled"}
                    </span>
                  </label>

                  {/* P2P Trading Toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={curr.canP2p}
                      onChange={() => handleToggle(curr.id, "canP2p", curr.canP2p)}
                      className="sr-only"
                    />
                    <div
                      className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center px-0.5 ${
                        curr.canP2p ? "bg-teal-500" : "bg-gray-700"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                          curr.canP2p ? "translate-x-3.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                    <span className={curr.canP2p ? "text-teal-400 font-medium" : "text-gray-500"}>
                      P2P
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#161822] border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingCurrency ? "Edit Fiat Currency" : "Add New Fiat Currency"}
                  </h2>
                  <p className="text-xs text-gray-400">
                    Configure currency codes, symbols, country, and trading availability
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Currency Code <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingCurrency}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. INR, USD, AED"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 uppercase font-bold disabled:opacity-50"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">ISO 4217 Currency Code</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Symbol <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    placeholder="e.g. ₹, $, €, د.إ"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 font-medium"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">Display symbol prefix</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Currency Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Indian Rupee, United States Dollar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Country / Region
                  </label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="e.g. India, Global"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Decimals & Formatting
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={form.decimals}
                    onChange={(e) => setForm({ ...form, decimals: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Display Order
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 font-mono"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">Order in selectors (lower numbers first)</span>
              </div>

              {/* Toggles */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-white block">Active Status</span>
                    <span className="text-[11px] text-gray-400 block">
                      Enable or disable this currency across the platform
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 bg-black/40 border-white/20 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer border-t border-white/5 pt-3">
                  <div>
                    <span className="text-xs font-medium text-white block">P2P Trading Availability</span>
                    <span className="text-[11px] text-gray-400 block">
                      Allow traders to select this fiat currency for P2P Ads & Orders
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.canP2p}
                    onChange={(e) => setForm({ ...form, canP2p: e.target.checked })}
                    className="w-4 h-4 rounded text-teal-500 bg-black/40 border-white/20 focus:ring-teal-500"
                  />
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingCurrency ? "Save Changes" : "Create Currency"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#161822] border border-white/10 shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Delete Fiat Currency</h3>
              <p className="text-xs text-gray-400 mt-1">
                Are you sure you want to delete this fiat currency? If there are active P2P ads or historical transactions, deletion will be blocked safely to preserve transaction integrity.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeletingId(null);
                }}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Delete Safely</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
