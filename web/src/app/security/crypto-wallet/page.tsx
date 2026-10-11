"use client";

import { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  Loader2, 
  Wallet, 
  PlusCircle, 
  Star, 
  Trash2, 
  Edit3, 
  X, 
  ShieldCheck, 
  Copy, 
  Check 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  getUserCryptoWallets, 
  saveCryptoWallet, 
  setPrimaryCryptoWallet, 
  deleteCryptoWallet
} from "@/actions/user";
import { validateCryptoAddress } from "@/lib/crypto-validation";
import { toast } from "sonner";

export default function CryptoWalletManagementPage() {
  const router = useRouter();
  const [cryptoWallets, setCryptoWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<any | null>(null);
  const [form, setForm] = useState({
    asset: "USDT",
    network: "TRC20",
    address: "",
    label: "",
    memo: "",
    isPrimary: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadWallets = async () => {
    setIsLoading(true);
    try {
      const data = await getUserCryptoWallets();
      setCryptoWallets(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load crypto wallets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWallets();
  }, []);

  const handleOpenAdd = () => {
    setEditingWallet(null);
    setForm({
      asset: "USDT",
      network: "TRC20",
      address: "",
      label: "",
      memo: "",
      isPrimary: cryptoWallets.length === 0,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (wallet: any) => {
    setEditingWallet(wallet);
    setForm({
      asset: wallet.asset || "USDT",
      network: wallet.network || "TRC20",
      address: wallet.address || "",
      label: wallet.label || "",
      memo: wallet.memo || "",
      isPrimary: wallet.isPrimary || false,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim() || !form.network.trim()) {
      toast.error("Please provide both network and wallet address.");
      return;
    }

    const validation = validateCryptoAddress(form.asset, form.network, form.address);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid wallet address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveCryptoWallet({
        id: editingWallet ? editingWallet.id : undefined,
        asset: form.asset,
        network: form.network,
        address: form.address.trim(),
        label: form.label.trim() || `${form.asset}-${form.network} Wallet`,
        memo: form.memo.trim(),
        isPrimary: form.isPrimary,
      });

      if (res.success) {
        toast.success(editingWallet ? "Crypto wallet updated successfully!" : "Crypto wallet saved successfully!");
        setShowModal(false);
        setEditingWallet(null);
        loadWallets();
      } else {
        toast.error(res.error || "Failed to save crypto wallet.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      const res = await setPrimaryCryptoWallet(id);
      if (res.success) {
        toast.success("Primary crypto wallet updated.");
        loadWallets();
      } else {
        toast.error(res.error || "Failed to update default wallet.");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await deleteCryptoWallet(deletingId);
      if (res.success) {
        toast.success("Crypto wallet removed.");
        setDeletingId(null);
        loadWallets();
      } else {
        toast.error(res.error || "Failed to delete crypto wallet.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Address copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shortAddr = (addr?: string) => {
    if (!addr) return "••••";
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <span className="font-bold text-lg">Crypto Wallet Management</span>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="text-xs font-bold text-[#00A070] hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Wallet</span>
        </button>
      </header>

      <div className="p-4 max-w-lg mx-auto w-full flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-20 text-[#00A070]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : cryptoWallets.length === 0 ? (
          <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">No Crypto Wallets Saved</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Save your personal crypto addresses (TRC20, ERC20, BEP20) for instant payouts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="mt-3 px-6 py-3 bg-[#00A070] hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Add Crypto Wallet Now
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cryptoWallets.map((wallet) => (
              <div
                key={wallet.id}
                className="bg-[#1A1C24] border border-white/5 hover:border-white/20 p-5 rounded-2xl flex flex-col gap-3 transition-all shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00A070] to-emerald-600 flex items-center justify-center font-bold text-xs text-white shadow-md">
                      {wallet.network.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{wallet.label || `${wallet.asset} Wallet`}</span>
                        <span className="text-[10px] bg-white/10 text-emerald-400 font-mono font-bold px-1.5 py-0.5 rounded">
                          {wallet.network}
                        </span>
                        {wallet.isPrimary && (
                          <span className="text-[10px] bg-[#00A070]/20 text-[#00A070] border border-[#00A070]/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 font-mono">
                          {shortAddr(wallet.address)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(wallet.address, wallet.id)}
                          className="text-gray-500 hover:text-white transition-colors"
                          title="Copy Address"
                        >
                          {copiedId === wallet.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!wallet.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(wallet.id)}
                        title="Set as Default Wallet"
                        className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(wallet)}
                      title="Edit Wallet"
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(wallet.id)}
                      title="Delete Wallet"
                      className="p-2 text-gray-400 hover:text-rose-400 hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {wallet.memo && (
                  <div className="pt-2 border-t border-white/5 text-xs text-gray-400 font-mono">
                    Memo / Destination Tag: <span className="text-gray-200">{wallet.memo}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Security Info */}
        <div className="bg-[#1A1C24] p-4 rounded-xl border border-white/5 text-xs text-gray-400 flex items-start gap-2.5 leading-relaxed">
          <ShieldCheck className="w-5 h-5 text-[#00A070] shrink-0 mt-0.5" />
          <span>
            Please double-check your blockchain network selection before withdrawing. Payouts sent to an incompatible address or network cannot be recovered.
          </span>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in overflow-y-auto py-10">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-3xl p-6 shadow-2xl text-white font-sans my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#00A070]" />
                {editingWallet ? "Edit Crypto Wallet" : "Add Crypto Wallet"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Cryptocurrency <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={form.asset}
                    onChange={(e) => setForm({ ...form, asset: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                  >
                    <option value="USDT">USDT</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Network / Chain <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={form.network}
                    onChange={(e) => setForm({ ...form, network: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3 py-2.5 text-xs text-white outline-none font-mono"
                  >
                    <option value="TRC20">TRC20 (Tron)</option>
                    <option value="ERC20">ERC20 (Ethereum)</option>
                    <option value="BEP20">BEP20 (BNB Smart Chain)</option>
                    <option value="POLYGON">Polygon (MATIC)</option>
                    <option value="BITCOIN">Bitcoin (BTC)</option>
                    <option value="SOLANA">Solana (SOL)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Wallet Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Paste on-chain destination address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Wallet Label / Tag Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Binance USDT, Cold Storage"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Memo / Destination Tag (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty if not required"
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="primaryCryptoCheckPage"
                  checked={form.isPrimary}
                  onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                  className="w-4 h-4 rounded text-[#00A070] focus:ring-0 bg-[#10121A] border-white/20"
                />
                <label htmlFor="primaryCryptoCheckPage" className="text-xs text-gray-300 cursor-pointer">
                  Set as default / primary crypto wallet
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-[#00A070] hover:bg-emerald-500 flex items-center justify-center gap-1.5 shadow-lg shadow-[#00A070]/20"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Crypto Wallet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white font-sans text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Delete Crypto Wallet?</h3>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Are you sure you want to remove this crypto wallet? Previous historical withdrawals will not be altered.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
