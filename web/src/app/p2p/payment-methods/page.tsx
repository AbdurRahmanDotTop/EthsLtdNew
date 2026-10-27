"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getP2pPaymentMethods,
  addP2pPaymentMethod,
  updateP2pPaymentMethod,
  deleteP2pPaymentMethod,
  getP2pSupportedPaymentMethods,
} from "@/actions/p2p";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Check,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [methods, setMethods] = useState<any[]>([]);
  const [supportedMethods, setSupportedMethods] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMethod, setEditingMethod] = useState<any | null>(null);

  // Dynamic Form state
  const [selectedMethodName, setSelectedMethodName] = useState("");
  const [formDetails, setFormDetails] = useState<Record<string, any>>({});

  // Immediate authentication guard
  useEffect(() => {
    if (!isAuthenticated && !isAuthLoading) {
      router.replace(`/login?redirect=${encodeURIComponent("/p2p/payment-methods")}`);
    }
  }, [isAuthenticated, isAuthLoading, router]);

  const fetchMethods = async () => {
    if (!isAuthenticated && !isAuthLoading) return;
    setIsLoading(true);
    try {
      const [res, sysRes] = await Promise.all([
        getP2pPaymentMethods(),
        getP2pSupportedPaymentMethods({ activeOnly: true }),
      ]);
      if (res.success && res.data) {
        setMethods(res.data);
      } else if (res.error?.includes("Unauthorized") || res.error?.includes("Log in")) {
        router.replace(`/login?redirect=${encodeURIComponent("/p2p/payment-methods")}`);
        return;
      }
      if (sysRes.success && sysRes.data) {
        setSupportedMethods(sysRes.data);
        if (sysRes.data.length > 0 && !selectedMethodName) {
          setSelectedMethodName(sysRes.data[0].name);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMethods();
    }
  }, [isAuthenticated]);

  const currentMethodConfig = supportedMethods.find(
    (m) => m.name === selectedMethodName || m.identifier === selectedMethodName
  );

  const activeFields: any[] =
    currentMethodConfig && Array.isArray(currentMethodConfig.fields) && currentMethodConfig.fields.length > 0
      ? currentMethodConfig.fields
      : [
          {
            fieldName: "accountName",
            fieldLabel: "Account Holder Name",
            fieldType: "text",
            isRequired: true,
            placeholder: "e.g. John Doe",
          },
          {
            fieldName: "accountNumber",
            fieldLabel: "Account Number / Identifier",
            fieldType: "text",
            isRequired: true,
            placeholder: "e.g. Bank Account, UPI ID, or Email",
          },
        ];

  const openAddModal = () => {
    setEditingMethod(null);
    const firstMethod = supportedMethods[0]?.name || "Bank Transfer (IMPS / NEFT)";
    setSelectedMethodName(firstMethod);
    setFormDetails({});
    setShowModal(true);
  };

  const openEditModal = (pm: any) => {
    setEditingMethod(pm);
    setSelectedMethodName(pm.type || supportedMethods[0]?.name || "Bank Transfer (IMPS / NEFT)");
    setFormDetails(pm.details || {});
    setShowModal(true);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormDetails((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    for (const field of activeFields) {
      if (field.isRequired) {
        const val = formDetails[field.fieldName];
        if (val === undefined || val === null || val.toString().trim() === "") {
          toast.error(`'${field.fieldLabel}' is required.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      // Find a primary label to append to name, e.g., accountName or identifier
      const primaryVal =
        formDetails.accountName ||
        formDetails.vpa ||
        formDetails.email ||
        formDetails.accountNumber ||
        Object.values(formDetails)[0] ||
        "";

      const displayName = primaryVal
        ? `${selectedMethodName} (${primaryVal.toString().trim()})`
        : selectedMethodName;

      if (editingMethod) {
        const res = await updateP2pPaymentMethod(editingMethod.id, {
          type: selectedMethodName,
          name: displayName,
          details: formDetails,
        });

        if (res.success) {
          toast.success("Payment method updated successfully!");
          setShowModal(false);
          fetchMethods();
        } else {
          if (res.error?.includes("Unauthorized") || res.error?.includes("Log in")) {
            router.push(`/login?redirect=${encodeURIComponent("/p2p/payment-methods")}`);
          } else {
            toast.error(res.error || "Failed to update payment method");
          }
        }
      } else {
        const res = await addP2pPaymentMethod({
          type: selectedMethodName,
          name: displayName,
          details: formDetails,
        });

        if (res.success) {
          toast.success("Payment method added!");
          setShowModal(false);
          fetchMethods();
        } else {
          if (res.error?.includes("Unauthorized") || res.error?.includes("Log in")) {
            router.push(`/login?redirect=${encodeURIComponent("/p2p/payment-methods")}`);
          } else {
            toast.error(res.error || "Failed to add payment method");
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment method");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this payment method?")) return;
    try {
      const res = await deleteP2pPaymentMethod(id);
      if (res.success) {
        toast.success("Payment method removed.");
        fetchMethods();
      } else {
        toast.error(res.error || "Failed to remove payment method");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove payment method");
    }
  };

  // Helper to format field key nicely
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/_/g, " ");
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 md:px-8 py-6 md:py-12 pb-36 md:pb-16">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <Link
            href="/p2p"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Marketplace
          </Link>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">
            P2P Payment Methods
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Add or edit bank accounts, UPI, or e-wallets to receive payments when selling crypto.
          </p>
        </div>

        <Button
          onClick={openAddModal}
          className="bg-[#00A070] hover:bg-[#00B07C] text-white font-semibold text-xs gap-2 cursor-pointer w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Add Payment Method
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070] mb-3" />
          <p className="text-xs">Loading payment methods...</p>
        </div>
      ) : methods.length === 0 ? (
        <div className="bg-[#161822] border border-white/10 rounded-2xl p-10 text-center text-gray-400 max-w-lg mx-auto">
          <CreditCard className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No payment methods added yet</h3>
          <p className="text-xs text-gray-400 mb-6">
            You must have at least one verified payment method to sell crypto on P2P.
          </p>
          <Button
            onClick={openAddModal}
            className="bg-[#00A070] hover:bg-[#00B07C] text-white text-xs font-semibold"
          >
            Add Your First Method
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {methods.map((pm) => {
            const matchedSys = supportedMethods.find((s) => s.name === pm.type);
            const channelType = matchedSys?.channelType;

            return (
              <div
                key={pm.id}
                className="bg-[#161822] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-lg bg-[#00A070]/15 text-[#00A070]">
                        <CreditCard className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="font-bold text-white text-sm block">{pm.type}</span>
                        {channelType && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Layers className="w-2.5 h-2.5 text-[#00A070]" />
                            {channelType.name || channelType.code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(pm)}
                        className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        title="Edit Payment Method"
                      >
                        <Pencil className="w-4 h-4 text-[#00A070]" />
                      </button>
                      <button
                        onClick={() => handleDelete(pm.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        title="Delete Payment Method"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Render all custom details dynamically */}
                  <div className="space-y-1.5 text-xs pt-1 border-t border-white/5">
                    {pm.details && typeof pm.details === "object" ? (
                      Object.entries(pm.details).map(([key, val]) => {
                        if (!val) return null;
                        const matchingField = matchedSys?.fields?.find(
                          (f: any) => f.fieldName === key
                        );
                        const label = matchingField ? matchingField.fieldLabel : formatKey(key);

                        return (
                          <div key={key} className="flex justify-between py-0.5">
                            <span className="text-gray-400">{label}</span>
                            <span className="font-medium text-white font-mono break-all text-right max-w-[60%]">
                              {String(val)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-gray-500 italic">No details specified</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Trading
                  </span>
                  <span>Added {new Date(pm.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="w-[92vw] sm:max-w-md bg-[#161822] border-white/10 text-white p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#00A070]" />
              {editingMethod ? "Edit Payment Method" : "Add Payment Method"}
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-xs">
              Ensure recipient details match your KYC verified account identity.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Supported Method</Label>
              <select
                disabled={Boolean(editingMethod)}
                value={selectedMethodName}
                onChange={(e) => {
                  setSelectedMethodName(e.target.value);
                  setFormDetails({});
                }}
                className="w-full h-11 rounded-lg border border-white/10 bg-[#121212] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070] disabled:opacity-60"
              >
                {supportedMethods.length > 0 ? (
                  supportedMethods.map((m) => (
                    <option key={m.id || m.identifier} value={m.name}>
                      {m.name} {m.currency !== "ALL" ? `(${m.currency})` : ""}
                    </option>
                  ))
                ) : (
                  <option value="Bank Transfer (IMPS / NEFT)">Bank Transfer (IMPS / NEFT)</option>
                )}
              </select>
            </div>

            {/* Dynamic Custom Fields from Channel Type / Method */}
            <div className="space-y-3 pt-1">
              {activeFields.map((field: any) => {
                const fieldKey = field.fieldName;
                const fieldValue = formDetails[fieldKey] ?? field.defaultValue ?? "";

                return (
                  <div key={field.id || fieldKey} className="space-y-1.5">
                    <Label className="text-xs text-gray-300">
                      {field.fieldLabel}{" "}
                      {field.isRequired && <span className="text-red-400">*</span>}
                    </Label>

                    {field.fieldType === "textarea" ? (
                      <textarea
                        rows={2}
                        placeholder={field.placeholder || `Enter ${field.fieldLabel}`}
                        value={fieldValue}
                        onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#121212] p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#00A070]"
                      />
                    ) : field.fieldType === "dropdown" ? (
                      <select
                        value={fieldValue}
                        onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                        className="w-full h-10 rounded-lg border border-white/10 bg-[#121212] px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
                      >
                        <option value="">Select {field.fieldLabel}</option>
                        {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.fieldType === "checkbox" ? (
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(fieldValue)}
                          onChange={(e) => handleFieldChange(fieldKey, e.target.checked)}
                          className="w-4 h-4 rounded text-[#00A070] bg-[#121212] border-white/10"
                        />
                        <span className="text-xs text-gray-300">{field.fieldLabel}</span>
                      </label>
                    ) : (
                      <input
                        type={
                          field.fieldType === "number"
                            ? "number"
                            : field.fieldType === "email"
                            ? "email"
                            : field.fieldType === "phone"
                            ? "tel"
                            : "text"
                        }
                        placeholder={field.placeholder || `Enter ${field.fieldLabel}`}
                        value={fieldValue}
                        onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                        className="w-full h-10 rounded-lg border border-white/10 bg-[#121212] px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#00A070]"
                      />
                    )}

                    {field.helpText && (
                      <p className="text-[10px] text-gray-500">{field.helpText}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-[#00A070]/10 border border-[#00A070]/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-gray-300">
              <ShieldCheck className="w-4 h-4 text-[#00A070] shrink-0 mt-0.5" />
              <p>
                To prevent fraud and preserve trader reputation, third-party payment accounts are strictly prohibited.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
                className="border-white/10 w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#00A070] hover:bg-[#00B07C] text-white font-bold w-full sm:w-auto justify-center"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1.5" />
                )}
                {editingMethod ? "Update Method" : "Save Method"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
