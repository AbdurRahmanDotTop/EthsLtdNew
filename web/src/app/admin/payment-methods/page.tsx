"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  getAllPaymentMethods,
  togglePaymentMethod,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  PaymentMethodInput,
} from "@/actions/admin";
import {
  CreditCard,
  CheckCircle,
  XCircle,
  RefreshCw,
  Building2,
  QrCode,
  Copy,
  Info,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  bankName?: string | null;
  accountHolder?: string | null;
  accountNumber?: string | null;
  ifscOrSwift?: string | null;
  network?: string | null;
  address?: string | null;
  instructions?: string | null;
  minAmount: number;
  maxAmount?: number | null;
  enabled: boolean;
  displayOrder: number;
}

export default function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [type, setType] = useState<"BANK" | "CRYPTO">("BANK");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscOrSwift, setIfscOrSwift] = useState("");
  const [network, setNetwork] = useState("TRC-20");
  const [address, setAddress] = useState("");
  const [minAmount, setMinAmount] = useState<string>("10");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [instructions, setInstructions] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<string>("1");

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const data = await getAllPaymentMethods();
      setMethods(data as PaymentMethod[]);
    } catch {
      toast.error("Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    setTogglingId(id);
    try {
      const res = await togglePaymentMethod(id, !currentStatus);
      if (res.success) {
        toast.success(`Payment method ${!currentStatus ? "enabled" : "disabled"}`);
        setMethods((prev) =>
          prev.map((m) => (m.id === id ? { ...m, enabled: !currentStatus } : m))
        );
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Open Create Modal
  const openCreateModal = (defaultType: "BANK" | "CRYPTO" = "BANK") => {
    setModalMode("create");
    setEditingId(null);
    setType(defaultType);
    setName(defaultType === "BANK" ? "" : "");
    setBankName("");
    setAccountHolder("");
    setAccountNumber("");
    setIfscOrSwift("");
    setNetwork(defaultType === "CRYPTO" ? "TRC-20" : "");
    setAddress("");
    setMinAmount(defaultType === "BANK" ? "50" : "10");
    setMaxAmount("");
    setInstructions("");
    setEnabled(true);
    setDisplayOrder(String(methods.length + 1));
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (method: PaymentMethod) => {
    setModalMode("edit");
    setEditingId(method.id);
    setType(method.type as "BANK" | "CRYPTO");
    setName(method.name);
    setBankName(method.bankName || "");
    setAccountHolder(method.accountHolder || "");
    setAccountNumber(method.accountNumber || "");
    setIfscOrSwift(method.ifscOrSwift || "");
    setNetwork(method.network || "TRC-20");
    setAddress(method.address || "");
    setMinAmount(String(method.minAmount ?? 10));
    setMaxAmount(method.maxAmount ? String(method.maxAmount) : "");
    setInstructions(method.instructions || "");
    setEnabled(method.enabled);
    setDisplayOrder(String(method.displayOrder ?? 1));
    setIsModalOpen(true);
  };

  // Save Form Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a payment method name");
      return;
    }

    if (type === "BANK") {
      if (!bankName.trim() || !accountHolder.trim() || !accountNumber.trim()) {
        toast.error("Bank name, account holder, and account number are required.");
        return;
      }
    } else {
      if (!network.trim() || !address.trim()) {
        toast.error("Network and deposit wallet address are required.");
        return;
      }
    }

    const payload: PaymentMethodInput = {
      name: name.trim(),
      type,
      bankName: type === "BANK" ? bankName.trim() : undefined,
      accountHolder: type === "BANK" ? accountHolder.trim() : undefined,
      accountNumber: type === "BANK" ? accountNumber.trim() : undefined,
      ifscOrSwift: type === "BANK" ? ifscOrSwift.trim() : undefined,
      network: type === "CRYPTO" ? network.trim() : undefined,
      address: type === "CRYPTO" ? address.trim() : undefined,
      minAmount: parseFloat(minAmount) || 10,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      instructions: instructions.trim() || undefined,
      enabled,
      displayOrder: parseInt(displayOrder) || 0,
    };

    setIsSaving(true);
    try {
      if (modalMode === "create") {
        const res = await createPaymentMethod(payload);
        if (res.success) {
          toast.success("Payment method created successfully!");
          setIsModalOpen(false);
          fetchMethods();
        } else {
          toast.error(res.error || "Failed to create payment method");
        }
      } else if (editingId) {
        const res = await updatePaymentMethod(editingId, payload);
        if (res.success) {
          toast.success("Payment method updated successfully!");
          setIsModalOpen(false);
          fetchMethods();
        } else {
          toast.error(res.error || "Failed to update payment method");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Handler
  const handleDelete = async (id: string, methodName: string) => {
    if (!window.confirm(`Are you sure you want to delete payment method "${methodName}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deletePaymentMethod(id);
      if (res.success) {
        toast.success(`"${methodName}" deleted successfully`);
        setMethods((prev) => prev.filter((m) => m.id !== id));
      } else {
        toast.error(res.error || "Failed to delete payment method");
      }
    } catch {
      toast.error("Failed to delete payment method");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <span className="px-3.5 py-1.5 rounded-xl bg-[#00A070] text-white text-xs font-bold shadow-md shadow-[#00A070]/20 flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" />
          Deposit Settlement Gateways
        </span>
        <a
          href="/admin/p2p/payment-methods"
          className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <Building2 className="w-3.5 h-3.5 text-[#00A070]" />
          P2P Peer Payment Methods →
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#00A070]" />
            Deposit Gateways (Bank & Crypto Direct)
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure platform receiving channels for user deposit settlements and balance credits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Payment Method Button */}
          <button
            onClick={() => openCreateModal("BANK")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#00A070] hover:bg-[#00b880] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#00A070]/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Payment Method</span>
          </button>

          <button
            onClick={fetchMethods}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#1A1C24] border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#252836] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Overview Notice */}
      <div className="bg-[#161822] border border-[#00A070]/20 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#00A070] shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300">
          <span className="font-semibold text-white">Active Payment Gateways: </span>
          Disabled channels are immediately hidden from traders on the deposit page. Active channels allow users to submit UTR or transaction hashes for admin review and instant wallet balance credit upon approval.
        </div>
      </div>

      {/* Grid of Payment Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#00A070]" />
              <span>Loading payment methods...</span>
            </div>
          </div>
        ) : methods.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-500 bg-[#161822] rounded-2xl border border-white/5">
            <CreditCard className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400 font-semibold mb-2">No payment methods found.</p>
            <button
              onClick={() => openCreateModal("BANK")}
              className="px-4 py-2 bg-[#00A070] text-white text-xs font-bold rounded-lg"
            >
              Add First Channel
            </button>
          </div>
        ) : (
          methods.map((method) => {
            const isCrypto = method.type === "CRYPTO";

            return (
              <div
                key={method.id}
                className={`bg-[#161822] border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                  method.enabled ? "border-white/10 hover:border-white/20" : "border-white/5 opacity-60"
                }`}
              >
                <div>
                  {/* Top Bar: Icon, Name & Action Controls */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1E202B] border border-white/5 flex items-center justify-center text-[#00A070] shrink-0">
                        {isCrypto ? <QrCode className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white leading-snug">{method.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono uppercase bg-white/5 text-gray-400 px-1.5 py-0.5 rounded border border-white/5">
                            {method.type}
                          </span>
                          {method.network && (
                            <span className="text-[10px] font-mono uppercase bg-[#00A070]/10 text-[#00A070] px-1.5 py-0.5 rounded border border-[#00A070]/20">
                              {method.network}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls: Edit, Delete, Toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(method)}
                        className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#2A2D3C] text-gray-300 hover:text-white transition-colors border border-white/5"
                        title="Edit Payment Method"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(method.id, method.name)}
                        disabled={deletingId === method.id}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20"
                        title="Delete Payment Method"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => handleToggle(method.id, method.enabled)}
                        disabled={togglingId === method.id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          method.enabled ? "bg-[#00A070]" : "bg-gray-700"
                        }`}
                        title={method.enabled ? "Disable Channel" : "Enable Channel"}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            method.enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Channel Details */}
                  <div className="space-y-2.5 bg-[#10121A] rounded-xl p-3.5 border border-white/5 text-xs font-mono">
                    {method.accountHolder && (
                      <div className="flex items-center justify-between text-gray-400">
                        <span>Holder:</span>
                        <span className="text-white font-semibold font-sans">{method.accountHolder}</span>
                      </div>
                    )}

                    {method.bankName && (
                      <div className="flex items-center justify-between text-gray-400">
                        <span>Bank Name:</span>
                        <span className="text-white font-sans">{method.bankName}</span>
                      </div>
                    )}

                    {method.accountNumber && (
                      <div className="flex items-center justify-between text-gray-400">
                        <span>Account:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#00A070] font-bold">{method.accountNumber}</span>
                          <button
                            onClick={() => copyToClipboard(method.accountNumber!)}
                            className="text-gray-500 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {method.ifscOrSwift && (
                      <div className="flex items-center justify-between text-gray-400">
                        <span>IFSC/SWIFT:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-bold">{method.ifscOrSwift}</span>
                          <button
                            onClick={() => copyToClipboard(method.ifscOrSwift!)}
                            className="text-gray-500 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {method.address && (
                      <div className="text-gray-400">
                        <div className="flex items-center justify-between mb-1">
                          <span>Deposit Address:</span>
                          <button
                            onClick={() => copyToClipboard(method.address!)}
                            className="text-gray-400 hover:text-white flex items-center gap-1 text-[10px]"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                        <div className="bg-[#161822] p-2 rounded text-[10px] break-all text-white font-mono select-all border border-white/5">
                          {method.address}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-gray-400 pt-1 border-t border-white/5">
                      <span>Min Deposit:</span>
                      <span className="text-white font-semibold">${method.minAmount || 10} USDT</span>
                    </div>

                    {method.instructions && (
                      <div className="text-[10px] text-gray-500 font-sans border-t border-white/5 pt-1.5">
                        {method.instructions}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer status */}
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    {method.enabled ? (
                      <CheckCircle className="w-3.5 h-3.5 text-[#00A070]" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-gray-500" />
                    )}
                    <span className={method.enabled ? "text-[#00A070] font-semibold" : "text-gray-500"}>
                      {method.enabled ? "Online & Accepting Deposits" : "Offline / Disabled"}
                    </span>
                  </div>

                  <span className="text-[10px] text-gray-500 font-mono">
                    Order: #{method.displayOrder ?? 0}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PAYMENT METHOD */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1C24] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#161822]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00A070]/10 flex items-center justify-center text-[#00A070]">
                  {type === "BANK" ? <Building2 className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {modalMode === "create" ? "Add Payment Method" : "Edit Payment Method"}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {type === "BANK" ? "Configure Bank Account Channel" : "Configure Crypto Wallet Channel"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Type Switcher (Bank vs Crypto) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Channel Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType("BANK");
                      if (modalMode === "create") {
                        setName("Axis Bank (Direct Transfer)");
                        setMinAmount("50");
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      type === "BANK"
                        ? "bg-[#00A070] text-white border-[#00A070] shadow-md shadow-[#00A070]/20"
                        : "bg-[#161822] text-gray-400 border-white/5 hover:border-white/20"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Bank Transfer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setType("CRYPTO");
                      if (modalMode === "create") {
                        setName("USDT (TRC-20 Network)");
                        setMinAmount("10");
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      type === "CRYPTO"
                        ? "bg-[#00A070] text-white border-[#00A070] shadow-md shadow-[#00A070]/20"
                        : "bg-[#161822] text-gray-400 border-white/5 hover:border-white/20"
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Crypto Wallet</span>
                  </button>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Channel Display Name</label>
                <input
                  type="text"
                  placeholder={type === "BANK" ? "e.g. Axis Bank (Direct Transfer)" : "e.g. USDT (TRC-20 Network)"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-medium placeholder:text-gray-600 transition-colors"
                  required
                />
              </div>

              {/* ======================= BANK FIELDS ======================= */}
              {type === "BANK" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Axis Bank Ltd"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-medium placeholder:text-gray-600 transition-colors"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">Account Holder Name</label>
                      <input
                        type="text"
                        placeholder="e.g. ETHSLTD TRADING CORP"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-medium placeholder:text-gray-600 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">Account Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 921020048192384"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono font-medium placeholder:text-gray-600 transition-colors"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">IFSC / Swift Code</label>
                      <input
                        type="text"
                        placeholder="e.g. UTIB0000004"
                        value={ifscOrSwift}
                        onChange={(e) => setIfscOrSwift(e.target.value)}
                        className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono font-medium placeholder:text-gray-600 transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ======================= CRYPTO FIELDS ======================= */}
              {type === "CRYPTO" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300">Blockchain Network</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {["TRC-20", "ERC-20", "BEP-20", "POLYGON", "SOLANA"].map((net) => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => setNetwork(net)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                            network === net
                              ? "bg-[#00A070] text-white font-bold"
                              : "bg-[#161822] text-gray-400 hover:text-white border border-white/5"
                          }`}
                        >
                          {net}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. TRC-20 or custom network"
                      value={network}
                      onChange={(e) => setNetwork(e.target.value)}
                      className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono font-medium placeholder:text-gray-600 transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300">Deposit Wallet Address</label>
                    <input
                      type="text"
                      placeholder="e.g. TYDzsYUEW245Ghtr8274jhkdsh293HGsQx"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono font-medium placeholder:text-gray-600 transition-colors"
                      required
                    />
                  </div>
                </>
              )}

              {/* Min Amount & Display Order */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Min Deposit (USDT)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="10"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono font-medium placeholder:text-gray-600 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Display Order</label>
                  <input
                    type="number"
                    placeholder="1"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono font-medium placeholder:text-gray-600 transition-colors"
                  />
                </div>
              </div>

              {/* Instructions / Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Instructions / Notes (Optional)</label>
                <textarea
                  placeholder="e.g. Send only USDT via TRC20 network. Please submit UTR reference number."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-sans placeholder:text-gray-600 transition-colors resize-none"
                />
              </div>

              {/* Enabled Status Switch */}
              <div className="flex items-center justify-between p-3 bg-[#161822] rounded-xl border border-white/5">
                <div>
                  <span className="text-xs font-semibold text-white block">Channel Status</span>
                  <span className="text-[11px] text-gray-400">
                    {enabled ? "Channel is Active & visible to traders" : "Channel is Disabled & hidden"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    enabled ? "bg-[#00A070]" : "bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-[#161822] hover:bg-[#252836] text-gray-300 text-xs font-semibold rounded-xl transition-colors border border-white/5"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-[#00A070] hover:bg-[#00b880] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#00A070]/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Channel...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{modalMode === "create" ? "Create Channel" : "Save Changes"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
