"use client";

import { useEffect, useState } from "react";
import {
  getAdminP2pPaymentMethods,
  createAdminP2pPaymentMethod,
  updateAdminP2pPaymentMethod,
  toggleAdminP2pPaymentMethod,
  deleteAdminP2pPaymentMethod,
  AdminP2pPaymentMethodInput,
} from "@/actions/admin";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Check,
  X,
  Loader2,
  ShieldCheck,
  Wallet,
  Building2,
  QrCode,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface P2pMethod {
  id: string;
  identifier: string;
  name: string;
  channelTypeId?: string | null;
  channelType?: any;
  type: string;
  currency: string;
  instructions?: string | null;
  fields?: any;
  isActive: boolean;
  displayOrder: number;
  adUsageCount: number;
  createdAt: string;
}

export default function AdminP2pPaymentMethodsPage() {
  const [methods, setMethods] = useState<P2pMethod[]>([]);
  const [channelTypes, setChannelTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [channelTypeId, setChannelTypeId] = useState<string>("");
  const [type, setType] = useState("BANK");
  const [currency, setCurrency] = useState("ALL");
  const [instructions, setInstructions] = useState("");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [isActive, setIsActive] = useState(true);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const res = await getAdminP2pPaymentMethods();
      if (res.success && res.data) {
        setMethods(res.data);
        if (res.channelTypes) {
          setChannelTypes(res.channelTypes);
        }
      } else {
        toast.error(res.error || "Failed to load P2P payment methods");
      }
    } catch {
      toast.error("Failed to load P2P payment methods");
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
      const res = await toggleAdminP2pPaymentMethod(id, !currentStatus);
      if (res.success) {
        toast.success(`Payment method ${!currentStatus ? "activated" : "deactivated"}`);
        setMethods((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isActive: !currentStatus } : m))
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

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setName("");
    setIdentifier("");
    const defaultCt = channelTypes[0];
    setChannelTypeId(defaultCt?.id || "");
    setType(defaultCt?.identifier || "BANK");
    setCurrency("ALL");
    setInstructions("");
    setDisplayOrder(String(methods.length + 1));
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (method: P2pMethod) => {
    setModalMode("edit");
    setEditingId(method.id);
    setName(method.name);
    setIdentifier(method.identifier);
    setChannelTypeId(method.channelTypeId || "");
    setType(method.type || "BANK");
    setCurrency(method.currency || "ALL");
    setInstructions(method.instructions || "");
    setDisplayOrder(String(method.displayOrder || 1));
    setIsActive(method.isActive);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a payment method name");
      return;
    }

    const payload: AdminP2pPaymentMethodInput = {
      name: name.trim(),
      identifier: identifier.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"),
      channelTypeId: channelTypeId || null,
      type,
      currency: currency.toUpperCase().trim(),
      instructions: instructions.trim() || undefined,
      displayOrder: parseInt(displayOrder) || 0,
      isActive,
    };

    setIsSaving(true);
    try {
      if (modalMode === "create") {
        const res = await createAdminP2pPaymentMethod(payload);
        if (res.success) {
          toast.success("P2P payment method created successfully!");
          setIsModalOpen(false);
          fetchMethods();
        } else {
          toast.error(res.error || "Failed to create method");
        }
      } else if (editingId) {
        const res = await updateAdminP2pPaymentMethod(editingId, payload);
        if (res.success) {
          toast.success("P2P payment method updated successfully!");
          setIsModalOpen(false);
          fetchMethods();
        } else {
          toast.error(res.error || "Failed to update method");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (method: P2pMethod) => {
    if (method.adUsageCount > 0) {
      toast.error(
        `Cannot delete "${method.name}": It is used in ${method.adUsageCount} active advertisement(s). Please deactivate it instead so active trades are not affected.`
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to delete payment method "${method.name}"?`)) {
      return;
    }

    setDeletingId(method.id);
    try {
      const res = await deleteAdminP2pPaymentMethod(method.id);
      if (res.success) {
        toast.success(`"${method.name}" deleted successfully`);
        setMethods((prev) => prev.filter((m) => m.id !== method.id));
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin/p2p"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to P2P Oversight
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-[#00A070]" />
            Centralized P2P Payment Methods
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Configure system-wide payment methods permitted for P2P ad publishing, order settlement, and buyer-seller matching.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/p2p/channels"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#1E202B] hover:bg-[#252836] border border-white/10 text-white rounded-xl text-xs font-bold transition-all"
          >
            <Layers className="w-4 h-4 text-[#00A070]" />
            <span>Channel Types &amp; Fields</span>
          </Link>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#00A070] hover:bg-[#00B07C] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#00A070]/20 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add P2P Method</span>
          </button>

          <button
            onClick={fetchMethods}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#161822] border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1E202B] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Policy and Single Source of Truth Banner */}
      <div className="bg-[#161822] border border-[#00A070]/20 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#00A070] shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300 space-y-1">
          <p className="font-semibold text-white">Central Source of Truth:</p>
          <p>
            Payment methods configured here are consistently reflected across ad creation, ad editing, express orders, marketplace filters, and trader profile configurations.
            Deactivating a method prevents merchants from selecting it in new or updated ads, while existing ads and orders retain safe transaction execution without breaking history.
          </p>
        </div>
      </div>

      {/* Methods Table */}
      <div className="bg-[#161822] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px] text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#121212]/50 text-gray-400 uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Method & Identifier</th>
                <th className="px-6 py-4">Channel Type</th>
                <th className="px-6 py-4">Supported Currency</th>
                <th className="px-6 py-4">Active Ads</th>
                <th className="px-6 py-4">Availability Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                    <Loader2 className="w-7 h-7 animate-spin text-[#00A070] mx-auto mb-2" />
                    <span>Loading centralized payment methods...</span>
                  </td>
                </tr>
              ) : methods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                    <p className="text-sm font-bold text-white mb-2">No payment methods configured</p>
                    <button
                      onClick={openCreateModal}
                      className="px-4 py-2 bg-[#00A070] text-white text-xs font-bold rounded-lg"
                    >
                      Add First Method
                    </button>
                  </td>
                </tr>
              ) : (
                methods.map((method) => {
                  const isToggling = togglingId === method.id;
                  const isDeleting = deletingId === method.id;

                  return (
                    <tr key={method.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#1E202B] border border-white/10 flex items-center justify-center text-[#00A070] shrink-0">
                            {method.type === "BANK" ? (
                              <Building2 className="w-4 h-4" />
                            ) : method.type === "UPI" ? (
                              <QrCode className="w-4 h-4" />
                            ) : (
                              <Wallet className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-white text-sm block">{method.name}</span>
                            <span className="text-[11px] font-mono text-gray-400">
                              Slug: {method.identifier}
                            </span>
                            {method.instructions && (
                              <span className="text-[10px] text-gray-500 block truncate max-w-xs mt-0.5">
                                {method.instructions}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/5 text-gray-300 border border-white/10 uppercase w-fit">
                            {method.channelType?.name || method.type}
                          </span>
                          {method.channelType?.fields && (
                            <span className="text-[10px] text-gray-500">
                              {method.channelType.fields.length} dynamic field(s)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00A070]/10 text-[#00A070] border border-[#00A070]/20">
                          {method.currency}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            method.adUsageCount > 0
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                              : "bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {method.adUsageCount} active ads
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggle(method.id, method.isActive)}
                            disabled={isToggling}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                              method.isActive ? "bg-[#00A070]" : "bg-gray-700"
                            }`}
                            title={method.isActive ? "Click to deactivate" : "Click to activate"}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                method.isActive ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <span
                            className={`text-[11px] font-bold ${
                              method.isActive ? "text-emerald-400" : "text-gray-500"
                            }`}
                          >
                            {method.isActive ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(method)}
                            className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#2A2D3C] text-gray-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
                            title="Edit Payment Method"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#00A070]" />
                          </button>

                          <button
                            onClick={() => handleDelete(method)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20 cursor-pointer disabled:opacity-50"
                            title={
                              method.adUsageCount > 0
                                ? "Cannot delete while active ads are linked"
                                : "Delete Payment Method"
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT P2P PAYMENT METHOD */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1C24] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#161822]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00A070]/10 flex items-center justify-center text-[#00A070]">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {modalMode === "create" ? "Add P2P Payment Method" : "Edit P2P Payment Method"}
                  </h3>
                  <span className="text-xs text-gray-400">
                    Configure method settings and ad publishing availability
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

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Method Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bank Transfer (IMPS / NEFT) or UPI"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (modalMode === "create" && !identifier) {
                      setIdentifier(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_"));
                    }
                  }}
                  className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-medium placeholder:text-gray-600 transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Identifier Slug</label>
                  <input
                    type="text"
                    placeholder="e.g. upi or bank_transfer"
                    value={identifier}
                    disabled={modalMode === "edit"}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono font-medium placeholder:text-gray-600 transition-colors disabled:opacity-60"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300">Channel Type</label>
                    <Link
                      href="/admin/p2p/channels"
                      target="_blank"
                      className="text-[11px] text-[#00A070] hover:underline"
                    >
                      + Manage Channels
                    </Link>
                  </div>
                  <select
                    value={channelTypeId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setChannelTypeId(selId);
                      const ct = channelTypes.find((c) => c.id === selId);
                      if (ct) setType(ct.identifier);
                    }}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-medium transition-colors"
                  >
                    {channelTypes.length > 0 ? (
                      channelTypes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.identifier})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="">Default (Bank)</option>
                      </>
                    )}
                  </select>

                  {/* Dynamic Fields Preview */}
                  {(() => {
                    const activeCt = channelTypes.find((c) => c.id === channelTypeId);
                    if (activeCt && activeCt.fields && activeCt.fields.length > 0) {
                      return (
                        <div className="p-2.5 bg-[#121216] rounded-lg border border-white/5 text-[11px] text-gray-400 mt-1">
                          <span className="text-gray-300 font-semibold block mb-1">
                            Associated Dynamic Custom Fields ({activeCt.fields.length}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {activeCt.fields.map((f: any) => (
                              <span
                                key={f.id}
                                className="px-1.5 py-0.5 rounded bg-[#1E202B] text-cyan-400 font-mono text-[10px] border border-white/5"
                              >
                                {f.fieldLabel} {(f.isRequired || f.required) && "*"}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Supported Currency</label>
                  <input
                    type="text"
                    placeholder="ALL or INR, USD, EUR"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-mono font-medium placeholder:text-gray-600 transition-colors uppercase"
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Instructions / Guidelines</label>
                <textarea
                  placeholder="e.g. Instant transfer via VPA. Third-party accounts strictly prohibited."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] p-3 rounded-xl outline-none text-white text-xs font-sans placeholder:text-gray-600 transition-colors resize-none"
                />
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3.5 bg-[#161822] rounded-xl border border-white/5">
                <div>
                  <span className="text-xs font-semibold text-white block">Active for Ad Publishing</span>
                  <span className="text-[11px] text-gray-400">
                    {isActive
                      ? "Traders can select this method when posting or editing P2P ads."
                      : "Hidden from ad publishing forms; existing ads continue safely."}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                    isActive ? "bg-[#00A070]" : "bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-[#161822] hover:bg-[#252836] text-gray-300 text-xs font-semibold rounded-xl transition-colors border border-white/5 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-[#00A070] hover:bg-[#00B07C] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#00A070]/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{modalMode === "create" ? "Create Method" : "Save Changes"}</span>
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
