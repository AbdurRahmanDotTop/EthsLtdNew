"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getAdminCryptoAssets,
  createAdminCryptoAsset,
  updateAdminCryptoAsset,
  toggleAdminCryptoAsset,
  deleteAdminCryptoAsset,
  CryptoAssetInput,
} from "@/actions/admin";
import {
  Coins,
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
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Sparkles,
  X,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

const POPULAR_NETWORKS = ["TRC20", "ERC20", "BEP20", "POLYGON", "SOL", "ARBITRUM", "OPTIMISM", "BTC"];

export default function AdminCryptoAssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [form, setForm] = useState<CryptoAssetInput>({
    symbol: "",
    name: "",
    iconUrl: "",
    description: "",
    networks: ["TRC20", "ERC20"],
    decimals: 8,
    isActive: true,
    canDeposit: true,
    canWithdraw: true,
    canP2p: true,
    displayOrder: 1,
  });
  const [customNetworkInput, setCustomNetworkInput] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const res = await getAdminCryptoAssets({
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      if (res.success && res.data) {
        setAssets(res.data);
      } else {
        toast.error(res.error || "Failed to load crypto assets");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load crypto assets");
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
    setEditingAsset(null);
    setForm({
      symbol: "",
      name: "",
      iconUrl: "₮",
      description: "",
      networks: ["TRC20", "ERC20"],
      decimals: 8,
      isActive: true,
      canDeposit: true,
      canWithdraw: true,
      canP2p: true,
      displayOrder: assets.length + 1,
    });
    setCustomNetworkInput("");
    setIsModalOpen(true);
  };

  const openEditModal = (a: any) => {
    setEditingAsset(a);
    setForm({
      symbol: a.symbol,
      name: a.name,
      iconUrl: a.iconUrl || "",
      description: a.description || "",
      networks: Array.isArray(a.networks) ? a.networks : [],
      decimals: a.decimals || 8,
      isActive: a.isActive,
      canDeposit: a.canDeposit,
      canWithdraw: a.canWithdraw,
      canP2p: a.canP2p,
      displayOrder: a.displayOrder || 1,
    });
    setCustomNetworkInput("");
    setIsModalOpen(true);
  };

  const toggleNetwork = (net: string) => {
    setForm((prev) => {
      const exists = prev.networks.includes(net);
      return {
        ...prev,
        networks: exists ? prev.networks.filter((n) => n !== net) : [...prev.networks, net],
      };
    });
  };

  const addCustomNetwork = () => {
    const net = customNetworkInput.trim().toUpperCase();
    if (!net) return;
    if (!form.networks.includes(net)) {
      setForm((prev) => ({ ...prev, networks: [...prev.networks, net] }));
    }
    setCustomNetworkInput("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol.trim() || !form.name.trim()) {
      toast.error("Asset symbol and name are required.");
      return;
    }

    setSaving(true);
    try {
      if (editingAsset) {
        const res = await updateAdminCryptoAsset(editingAsset.id, form);
        if (res.success) {
          toast.success("Crypto asset updated successfully!");
          setIsModalOpen(false);
          loadData();
        } else {
          toast.error(res.error || "Failed to update asset");
        }
      } else {
        const res = await createAdminCryptoAsset(form);
        if (res.success) {
          toast.success("Crypto asset created successfully!");
          setIsModalOpen(false);
          loadData();
        } else {
          toast.error(res.error || "Failed to create asset");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save crypto asset");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (
    id: string,
    field: "isActive" | "canDeposit" | "canWithdraw" | "canP2p",
    currentVal: boolean
  ) => {
    try {
      const res = await toggleAdminCryptoAsset(id, field, !currentVal);
      if (res.success) {
        toast.success(`Updated ${field}`);
        setAssets((prev) =>
          prev.map((a) => (a.id === id ? { ...a, [field]: !currentVal } : a))
        );
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (a: any) => {
    if (!confirm(`Are you sure you want to delete Crypto Asset '${a.symbol}' (${a.name})?`)) return;
    try {
      const res = await deleteAdminCryptoAsset(a.id);
      if (res.success) {
        toast.success("Crypto asset deleted.");
        loadData();
      } else {
        toast.error(res.error || "Failed to delete crypto asset");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete crypto asset");
    }
  };

  const totalActiveP2p = assets.filter((a) => a.canP2p && a.isActive).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161822] p-4 sm:p-5 rounded-2xl border border-white/5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Link
              href="/admin"
              className="p-1.5 rounded-lg bg-[#1E202B] text-gray-400 hover:text-white transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-2 bg-[#00A070]/10 rounded-xl text-[#00A070] shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white tracking-tight">Crypto Assets Management</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Centralized registry for supported cryptocurrencies, blockchain networks, and P2P trading availability.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <Link
            href="/admin/assets/fiat"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-200 border border-white/5 transition-colors shrink-0"
          >
            <span>Manage Fiat Currencies &rarr;</span>
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-gray-400 hover:text-white border border-white/5 transition-colors cursor-pointer shrink-0"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#00A070]" : ""}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Crypto Asset</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#161822] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Total Crypto Assets</span>
            <div className="text-xl font-black text-white mt-0.5">{assets.length}</div>
          </div>
          <Coins className="w-6 h-6 text-emerald-400/30" />
        </div>
        <div className="bg-[#161822] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Active in P2P Trading</span>
            <div className="text-xl font-black text-[#00A070] mt-0.5">{totalActiveP2p}</div>
          </div>
          <ArrowLeftRight className="w-6 h-6 text-[#00A070]/30" />
        </div>
        <div className="bg-[#161822] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Deposit Enabled</span>
            <div className="text-xl font-black text-cyan-400 mt-0.5">
              {assets.filter((a) => a.canDeposit && a.isActive).length}
            </div>
          </div>
          <ArrowDownCircle className="w-6 h-6 text-cyan-400/30" />
        </div>
        <div className="bg-[#161822] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Withdrawal Enabled</span>
            <div className="text-xl font-black text-amber-400 mt-0.5">
              {assets.filter((a) => a.canWithdraw && a.isActive).length}
            </div>
          </div>
          <ArrowUpCircle className="w-6 h-6 text-amber-400/30" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#161822] p-3 rounded-xl border border-white/5">
        <form onSubmit={handleSearch} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search symbol (e.g. USDT) or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#11121A] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">Status:</span>
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                statusFilter === s
                  ? "bg-[#00A070] text-white"
                  : "bg-[#1E202B] text-gray-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-[#161822] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#121212]/50 text-gray-400 uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Asset &amp; Symbol</th>
                <th className="px-6 py-4">Supported Networks</th>
                <th className="px-6 py-4">Decimals</th>
                <th className="px-6 py-4">P2P Trading</th>
                <th className="px-6 py-4">Deposit / Withdraw</th>
                <th className="px-6 py-4">Active Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                    <RefreshCw className="w-7 h-7 animate-spin text-[#00A070] mx-auto mb-2" />
                    <span>Loading crypto assets...</span>
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                    <p className="text-sm font-bold text-white mb-2">No crypto assets found</p>
                    <button
                      onClick={openCreateModal}
                      className="px-4 py-2 bg-[#00A070] text-white text-xs font-bold rounded-lg"
                    >
                      Add First Crypto Asset
                    </button>
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#1E202B] border border-white/10 flex items-center justify-center text-base font-bold text-[#00A070] shrink-0">
                          {asset.iconUrl || asset.symbol.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-white text-sm block">{asset.name}</span>
                          <span className="text-[11px] font-mono text-[#00A070] font-bold">
                            {asset.symbol}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {Array.isArray(asset.networks) && asset.networks.length > 0 ? (
                          asset.networks.map((n: string) => (
                            <span
                              key={n}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-gray-300 border border-white/10"
                            >
                              {n}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-[10px]">&mdash;</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono text-gray-300">{asset.decimals}</td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(asset.id, "canP2p", asset.canP2p)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                          asset.canP2p
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                        }`}
                      >
                        {asset.canP2p ? "P2P Enabled" : "Disabled"}
                      </button>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggle(asset.id, "canDeposit", asset.canDeposit)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            asset.canDeposit
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          }`}
                          title="Click to toggle deposit"
                        >
                          Dep: {asset.canDeposit ? "ON" : "OFF"}
                        </button>
                        <button
                          onClick={() => handleToggle(asset.id, "canWithdraw", asset.canWithdraw)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            asset.canWithdraw
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          }`}
                          title="Click to toggle withdrawal"
                        >
                          Wth: {asset.canWithdraw ? "ON" : "OFF"}
                        </button>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(asset.id, "isActive", asset.isActive)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                          asset.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {asset.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(asset)}
                          className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#2A2D3C] text-gray-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
                          title="Edit Asset"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#00A070]" />
                        </button>
                        <button
                          onClick={() => handleDelete(asset)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20 cursor-pointer"
                          title="Delete Asset"
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

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT CRYPTO ASSET */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1C24] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#161822]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00A070]/10 flex items-center justify-center text-[#00A070]">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editingAsset ? `Edit Crypto Asset: ${editingAsset.symbol}` : "Add New Crypto Asset"}
                  </h3>
                  <span className="text-xs text-gray-400">
                    Configure asset symbol, supported chains, and transaction controls
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Symbol (e.g. USDT)</label>
                  <input
                    type="text"
                    disabled={Boolean(editingAsset)}
                    placeholder="e.g. USDT, BTC"
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono font-bold uppercase transition-colors disabled:opacity-60"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Asset Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tether USD"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-medium transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Icon / Symbol</label>
                  <input
                    type="text"
                    placeholder="e.g. ₮, ₿, or URL"
                    value={form.iconUrl || ""}
                    onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-medium transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Decimals (Precision)</label>
                  <input
                    type="number"
                    value={form.decimals}
                    onChange={(e) => setForm({ ...form, decimals: parseInt(e.target.value) || 8 })}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono transition-colors"
                  />
                </div>
              </div>

              {/* Supported Networks */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 block">
                  Supported Blockchain Networks
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_NETWORKS.map((net) => {
                    const isSelected = form.networks.includes(net);
                    return (
                      <button
                        type="button"
                        key={net}
                        onClick={() => toggleNetwork(net)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? "bg-[#00A070] text-white border-[#00A070]"
                            : "bg-[#161822] text-gray-400 border-white/10 hover:text-white"
                        }`}
                      >
                        {net}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add custom network (e.g. FTM, AVAX)"
                    value={customNetworkInput}
                    onChange={(e) => setCustomNetworkInput(e.target.value)}
                    className="flex-1 bg-[#161822] border border-white/10 p-2 rounded-lg text-xs font-mono text-white placeholder-gray-500 uppercase"
                  />
                  <button
                    type="button"
                    onClick={addCustomNetwork}
                    className="px-3 py-2 bg-[#1E202B] text-white text-xs font-bold rounded-lg border border-white/10 hover:bg-[#252836] cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 p-3 bg-[#161822] rounded-xl border border-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.canP2p}
                    onChange={(e) => setForm({ ...form, canP2p: e.target.checked })}
                    className="w-4 h-4 accent-[#00A070] rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-white">Enable P2P Trading</span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-[#161822] rounded-xl border border-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 accent-[#00A070] rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-white">Asset Active</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 bg-[#161822] rounded-xl border border-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.canDeposit}
                    onChange={(e) => setForm({ ...form, canDeposit: e.target.checked })}
                    className="w-4 h-4 accent-[#00A070] rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-white">Allow Deposits</span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-[#161822] rounded-xl border border-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.canWithdraw}
                    onChange={(e) => setForm({ ...form, canWithdraw: e.target.checked })}
                    className="w-4 h-4 accent-[#00A070] rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-white">Allow Withdrawals</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#00B07C] text-xs font-bold text-white shadow-md shadow-[#00A070]/20 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingAsset ? "Update Asset" : "Create Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
