"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createP2pAd,
  updateP2pAd,
  getP2pAdById,
  getP2pSupportedPaymentMethods,
  getP2pPaymentMethods,
} from "@/actions/p2p";
import { useCurrencies } from "@/hooks/use-currencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  ShieldCheck,
  Check,
  CreditCard,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface PaymentMethodItem {
  id: string;
  type: string;
  name: string;
  identifier?: string;
  details: Record<string, any>;
}

function PostAdContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const isEditMode = Boolean(editId);

  const { assets, fiats } = useCurrencies();

  const [isLoadingAd, setIsLoadingAd] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supportedMethods, setSupportedMethods] = useState<any[]>([]);
  const [userSavedMethods, setUserSavedMethods] = useState<any[]>([]);

  // Form State
  const [side, setSide] = useState<"BUY" | "SELL">("SELL");
  const [asset, setAsset] = useState("USDT");
  const [fiatCurrency, setFiatCurrency] = useState("INR");
  const [priceType, setPriceType] = useState<"FIXED" | "FLOATING">("FIXED");
  const [price, setPrice] = useState("");
  const [floatingMargin, setFloatingMargin] = useState("0");
  const [totalAmount, setTotalAmount] = useState("");
  const [minLimit, setMinLimit] = useState("");
  const [maxLimit, setMaxLimit] = useState("");
  const [paymentTimeLimit, setPaymentTimeLimit] = useState("15");
  const [terms, setTerms] = useState("");
  const [autoReply, setAutoReply] = useState("");

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);

  // 1. Fetch System Supported Payment Methods and User Saved Methods
  useEffect(() => {
    let mounted = true;
    Promise.all([
      getP2pSupportedPaymentMethods({ activeOnly: true, currency: fiatCurrency }),
      getP2pPaymentMethods(),
    ])
      .then(([sysRes, userRes]) => {
        if (!mounted) return;
        if (sysRes.success && sysRes.data) {
          setSupportedMethods(sysRes.data);
          // If no payment methods are initialized yet and not in edit mode
          if (!isEditMode && paymentMethods.length === 0 && sysRes.data.length > 0) {
            const first = sysRes.data[0];
            setPaymentMethods([
              {
                id: Date.now().toString(),
                type: first.name,
                name: first.name,
                identifier: first.identifier,
                details: {},
              },
            ]);
          }
        }
        if (userRes.success && userRes.data) {
          setUserSavedMethods(userRes.data);
        }
      })
      .catch((err) => console.error("Failed to fetch payment methods:", err));

    return () => {
      mounted = false;
    };
  }, [fiatCurrency, isEditMode]);

  // 2. Fetch Ad Data in Edit Mode
  useEffect(() => {
    if (!editId) return;

    let mounted = true;
    setIsLoadingAd(true);

    getP2pAdById(editId)
      .then((res) => {
        if (!mounted) return;
        if (res.success && res.data) {
          const ad = res.data;
          setSide(ad.side || "SELL");
          setAsset(ad.asset || "USDT");
          setFiatCurrency(ad.fiatCurrency || "INR");
          setPriceType(ad.isFloating ? "FLOATING" : "FIXED");
          setPrice(ad.price?.toString() || "");
          setFloatingMargin(ad.priceMargin?.toString() || "0");
          setTotalAmount(ad.totalAmount?.toString() || "");
          setMinLimit(ad.minLimit?.toString() || "");
          setMaxLimit(ad.maxLimit?.toString() || "");
          setPaymentTimeLimit(ad.paymentTimeLimit?.toString() || "15");
          setTerms(ad.terms || "");
          setAutoReply(ad.autoReply || "");

          if (Array.isArray(ad.paymentMethods) && ad.paymentMethods.length > 0) {
            setPaymentMethods(
              ad.paymentMethods.map((m: any, idx: number) => {
                const name = typeof m === "string" ? m : m.name || m.type || "Bank Transfer";
                return {
                  id: String(idx + 1),
                  type: name,
                  name,
                  identifier: m.identifier,
                  details: typeof m === "object" ? m.details || {} : {},
                };
              })
            );
          }
        } else {
          toast.error(res.error || "Failed to load advertisement details");
          router.push("/p2p/my-ads");
        }
      })
      .catch((err) => {
        toast.error(err.message || "Failed to load advertisement");
        router.push("/p2p/my-ads");
      })
      .finally(() => {
        if (mounted) setIsLoadingAd(false);
      });

    return () => {
      mounted = false;
    };
  }, [editId, router]);

  const addPaymentMethod = () => {
    const defaultOption = supportedMethods[0]?.name || "Bank Transfer (IMPS / NEFT)";
    const defaultIdent = supportedMethods[0]?.identifier;
    setPaymentMethods((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: defaultOption,
        name: defaultOption,
        identifier: defaultIdent,
        details: {},
      },
    ]);
  };

  const removePaymentMethod = (index: number) => {
    setPaymentMethods((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePaymentMethodType = (index: number, val: string) => {
    const matched = supportedMethods.find((m) => m.name === val || m.identifier === val);
    setPaymentMethods((prev) =>
      prev.map((pm, i) =>
        i === index
          ? {
              ...pm,
              type: matched?.name || val,
              name: matched?.name || val,
              identifier: matched?.identifier,
              details: {}, // reset fields for new method type
            }
          : pm
      )
    );
  };

  const updatePaymentMethodDetail = (pmIndex: number, fieldName: string, value: any) => {
    setPaymentMethods((prev) =>
      prev.map((pm, i) => {
        if (i !== pmIndex) return pm;
        return {
          ...pm,
          details: {
            ...pm.details,
            [fieldName]: value,
          },
        };
      })
    );
  };

  const applyUserSavedMethod = (pmIndex: number, savedMethod: any) => {
    setPaymentMethods((prev) =>
      prev.map((pm, i) => {
        if (i !== pmIndex) return pm;
        return {
          ...pm,
          details: {
            ...pm.details,
            ...(savedMethod.details || {}),
          },
        };
      })
    );
    toast.success(`Loaded details from saved ${savedMethod.name}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const p = parseFloat(price);
    const tot = parseFloat(totalAmount);
    const minL = parseFloat(minLimit);
    const maxL = parseFloat(maxLimit);

    if (isNaN(p) || p <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (isNaN(tot) || tot <= 0) {
      toast.error("Please enter total volume");
      return;
    }
    if (isNaN(minL) || minL <= 0) {
      toast.error("Please enter a valid minimum limit");
      return;
    }
    if (isNaN(maxL) || maxL < minL) {
      toast.error("Maximum limit must be greater than or equal to minimum limit");
      return;
    }
    if (paymentMethods.length === 0) {
      toast.error("Please add at least one payment method");
      return;
    }

    // Validate required dynamic fields if SELL ad
    if (side === "SELL") {
      for (const pm of paymentMethods) {
        const matched = supportedMethods.find(
          (m) => m.name === pm.type || m.identifier === pm.identifier
        );
        if (matched && Array.isArray(matched.fields)) {
          for (const field of matched.fields) {
            if (field.isRequired) {
              const val = pm.details[field.fieldName];
              if (val === undefined || val === null || val.toString().trim() === "") {
                toast.error(
                  `Field '${field.fieldLabel}' is required for ${pm.name}. Please enter your receiving details.`
                );
                return;
              }
            }
          }
        }
      }
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && editId) {
        const res = await updateP2pAd(editId, {
          price: p,
          priceType,
          floatingMarginPercent: parseFloat(floatingMargin) || 0,
          totalAmount: tot,
          availableAmount: tot,
          minLimit: minL,
          maxLimit: maxL,
          paymentMethods,
          paymentTimeLimit: parseInt(paymentTimeLimit) || 15,
          terms,
          autoReply,
        });

        if (res.success) {
          toast.success("Advertisement updated successfully!");
          router.push("/p2p/my-ads");
        } else {
          toast.error(res.error || "Failed to update ad");
        }
      } else {
        const res = await createP2pAd({
          side,
          asset,
          fiatCurrency,
          priceType,
          price: p,
          floatingMarginPercent: parseFloat(floatingMargin) || 0,
          totalAmount: tot,
          minLimit: minL,
          maxLimit: maxL,
          paymentMethods,
          paymentTimeLimit: parseInt(paymentTimeLimit) || 15,
          terms,
          autoReply,
        });

        if (res.success) {
          toast.success("Advertisement posted successfully!");
          router.push("/p2p/my-ads");
        } else {
          toast.error(res.error || "Failed to create ad");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save advertisement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fiatSymbol = fiats.find((f) => f.code === fiatCurrency)?.symbol || "$";

  if (isLoadingAd) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A070] mx-auto mb-3" />
        <p className="text-xs">Loading advertisement details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 md:py-12 pb-36 md:pb-16">
      <div className="mb-6">
        <Link
          href="/p2p/my-ads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Advertisements
        </Link>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">
          {isEditMode ? "Edit P2P Advertisement" : "Post P2P Advertisement"}
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          {isEditMode
            ? "Update pricing, trade limits, payment methods, or terms for this active offer."
            : "Create a buy or sell offer with your preferred pricing, trade limits, and payment methods."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Type and Asset */}
        <div className="bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#00A070]/20 text-[#00A070] text-xs flex items-center justify-center font-bold">1</span>
            Ad Type & Target Asset
          </h2>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={isEditMode}
              onClick={() => setSide("SELL")}
              className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                side === "SELL"
                  ? "border-[#00A070] bg-[#00A070]/10 text-white font-bold"
                  : "border-white/10 bg-[#121212] text-gray-400 hover:text-white"
              } ${isEditMode ? "opacity-80 cursor-not-allowed" : ""}`}
            >
              <div className="text-sm font-bold">I Want to Sell Crypto</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Buyers will pay you fiat</div>
            </button>
            <button
              type="button"
              disabled={isEditMode}
              onClick={() => setSide("BUY")}
              className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                side === "BUY"
                  ? "border-[#00A070] bg-[#00A070]/10 text-white font-bold"
                  : "border-white/10 bg-[#121212] text-gray-400 hover:text-white"
              } ${isEditMode ? "opacity-80 cursor-not-allowed" : ""}`}
            >
              <div className="text-sm font-bold">I Want to Buy Crypto</div>
              <div className="text-[11px] text-gray-400 mt-0.5">You will pay sellers fiat</div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Crypto Asset</Label>
              <select
                disabled={isEditMode}
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className={`w-full h-11 rounded-lg border border-white/10 bg-[#121212] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070] ${
                  isEditMode ? "opacity-80 cursor-not-allowed" : ""
                }`}
              >
                {assets.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Fiat Currency</Label>
              <select
                disabled={isEditMode}
                value={fiatCurrency}
                onChange={(e) => setFiatCurrency(e.target.value)}
                className={`w-full h-11 rounded-lg border border-white/10 bg-[#121212] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070] ${
                  isEditMode ? "opacity-80 cursor-not-allowed" : ""
                }`}
              >
                {fiats.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code} ({f.symbol}) - {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Pricing & Volume */}
        <div className="bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#00A070]/20 text-[#00A070] text-xs flex items-center justify-center font-bold">2</span>
            Pricing & Trading Limits
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price" className="text-xs text-gray-300">
                Fixed Unit Price ({fiatCurrency})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs">
                  {fiatSymbol}
                </span>
                <Input
                  id="price"
                  type="number"
                  step="any"
                  placeholder="e.g. 91.50"
                  className="pl-8 h-11 text-sm font-semibold"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="totalAmount" className="text-xs text-gray-300">
                Total Trading Volume ({asset})
              </Label>
              <div className="relative">
                <Input
                  id="totalAmount"
                  type="number"
                  step="any"
                  placeholder="e.g. 500"
                  className="h-11 text-sm font-semibold"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="minLimit" className="text-xs text-gray-300">
                Minimum Order Limit ({fiatCurrency})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs">
                  {fiatSymbol}
                </span>
                <Input
                  id="minLimit"
                  type="number"
                  step="any"
                  placeholder="e.g. 1000"
                  className="pl-8 h-11 text-sm font-semibold"
                  value={minLimit}
                  onChange={(e) => setMinLimit(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxLimit" className="text-xs text-gray-300">
                Maximum Order Limit ({fiatCurrency})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs">
                  {fiatSymbol}
                </span>
                <Input
                  id="maxLimit"
                  type="number"
                  step="any"
                  placeholder="e.g. 50000"
                  className="pl-8 h-11 text-sm font-semibold"
                  value={maxLimit}
                  onChange={(e) => setMaxLimit(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs text-gray-300">Payment Time Limit</Label>
            <select
              value={paymentTimeLimit}
              onChange={(e) => setPaymentTimeLimit(e.target.value)}
              className="w-full h-11 rounded-lg border border-white/10 bg-[#121212] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
            >
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes</option>
              <option value="45">45 Minutes</option>
              <option value="60">60 Minutes</option>
            </select>
          </div>
        </div>

        {/* Step 3: Centralized Payment Methods & Dynamic Fields */}
        <div className="bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#00A070]/20 text-[#00A070] text-xs flex items-center justify-center font-bold">3</span>
                Supported Payment Methods
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {side === "SELL"
                  ? "Select methods and enter your receiving payment account details for buyers to transfer fiat."
                  : "Select payment methods you are willing to use to pay sellers."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPaymentMethod}
              className="border-white/10 text-xs gap-1 hover:border-[#00A070]/40"
            >
              <Plus className="w-3.5 h-3.5" /> Add Method
            </Button>
          </div>

          <div className="space-y-4">
            {paymentMethods.map((pm, pmIdx) => {
              const matched = supportedMethods.find(
                (m) => m.name === pm.type || m.identifier === pm.identifier
              );
              const customFields = Array.isArray(matched?.fields) ? matched.fields : [];
              const channelType = matched?.channelType;

              // Find if user has saved methods matching this type
              const matchingSaved = userSavedMethods.filter(
                (sm) => sm.type === pm.type || (matched && sm.type === matched.name)
              );

              return (
                <div
                  key={pm.id || pmIdx}
                  className="bg-[#121212] p-4 rounded-xl border border-white/10 space-y-3"
                >
                  {/* Selector Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <div className="flex-1 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#161822] text-[#00A070] border border-white/5">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <select
                        value={pm.type}
                        onChange={(e) => updatePaymentMethodType(pmIdx, e.target.value)}
                        className="flex-1 max-w-sm h-10 rounded-lg border border-white/10 bg-[#161822] px-3 text-sm text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#00A070]"
                      >
                        {supportedMethods.length > 0 ? (
                          supportedMethods.map((m) => (
                            <option key={m.id || m.identifier} value={m.name}>
                              {m.name} {m.currency !== "ALL" ? `(${m.currency})` : ""}
                            </option>
                          ))
                        ) : (
                          <option value="Bank Transfer (IMPS / NEFT)">
                            Bank Transfer (IMPS / NEFT)
                          </option>
                        )}
                      </select>
                      {channelType && (
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/5 text-gray-400 border border-white/5">
                          <Layers className="w-3 h-3 text-[#00A070]" />
                          {channelType.name || channelType.code}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {side === "SELL" && matchingSaved.length > 0 && (
                        <select
                          onChange={(e) => {
                            const found = matchingSaved.find((s) => s.id === e.target.value);
                            if (found) applyUserSavedMethod(pmIdx, found);
                          }}
                          defaultValue=""
                          className="h-8 px-2 rounded-lg bg-[#00A070]/10 border border-[#00A070]/30 text-[#00A070] text-xs font-medium cursor-pointer"
                        >
                          <option value="" disabled>
                            ⚡ Fill from Saved Profile
                          </option>
                          {matchingSaved.map((sm) => (
                            <option key={sm.id} value={sm.id} className="bg-[#161822] text-white">
                              {sm.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {paymentMethods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePaymentMethod(pmIdx)}
                          className="p-2 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove method"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Custom Fields (Rendered for SELL Ads or when configured) */}
                  {side === "SELL" ? (
                    <div className="pt-1">
                      {customFields.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {customFields.map((field: any) => {
                            const fieldKey = field.fieldName;
                            const fieldValue = pm.details[fieldKey] ?? field.defaultValue ?? "";

                            return (
                              <div
                                key={field.id || fieldKey}
                                className={
                                  field.fieldType === "textarea" ? "sm:col-span-2 space-y-1" : "space-y-1"
                                }
                              >
                                <label className="block text-xs font-medium text-gray-300">
                                  {field.fieldLabel}{" "}
                                  {field.isRequired && <span className="text-red-400">*</span>}
                                </label>

                                {field.fieldType === "textarea" ? (
                                  <textarea
                                    rows={2}
                                    placeholder={field.placeholder || `Enter ${field.fieldLabel}`}
                                    value={fieldValue}
                                    onChange={(e) =>
                                      updatePaymentMethodDetail(pmIdx, fieldKey, e.target.value)
                                    }
                                    className="w-full rounded-lg border border-white/10 bg-[#161822] p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#00A070]"
                                  />
                                ) : field.fieldType === "dropdown" ? (
                                  <select
                                    value={fieldValue}
                                    onChange={(e) =>
                                      updatePaymentMethodDetail(pmIdx, fieldKey, e.target.value)
                                    }
                                    className="w-full h-10 rounded-lg border border-white/10 bg-[#161822] px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
                                  >
                                    <option value="">Select {field.fieldLabel}</option>
                                    {(Array.isArray(field.options) ? field.options : []).map(
                                      (opt: string) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      )
                                    )}
                                  </select>
                                ) : field.fieldType === "checkbox" ? (
                                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(fieldValue)}
                                      onChange={(e) =>
                                        updatePaymentMethodDetail(pmIdx, fieldKey, e.target.checked)
                                      }
                                      className="w-4 h-4 rounded text-[#00A070] bg-[#161822] border-white/10"
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
                                    onChange={(e) =>
                                      updatePaymentMethodDetail(pmIdx, fieldKey, e.target.value)
                                    }
                                    className="w-full h-10 rounded-lg border border-white/10 bg-[#161822] px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#00A070]"
                                  />
                                )}

                                {field.helpText && (
                                  <p className="text-[10px] text-gray-500">{field.helpText}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-xs text-gray-400 flex items-center gap-2">
                          <Info className="w-4 h-4 text-gray-500" />
                          <span>
                            No additional custom fields configured for this channel type. Buyers will be instructed to use standard {pm.name} transfer.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-white/5 text-xs text-gray-400 flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#00A070]" />
                      <span>
                        Buyers offer to pay via <span className="font-semibold text-white">{pm.name}</span>. Sellers will provide their payment details when the order opens.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 4: Terms & Auto-Reply */}
        <div className="bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#00A070]/20 text-[#00A070] text-xs flex items-center justify-center font-bold">4</span>
            Trade Terms & Automated Reply
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="terms" className="text-xs text-gray-300">
              Terms & Conditions (Visible to traders before placing order)
            </Label>
            <textarea
              id="terms"
              rows={3}
              placeholder="e.g. Only payments from your own verified account accepted. No third-party transfers."
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#121212] p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="autoReply" className="text-xs text-gray-300">
              Automated Chat Greeting (Sent instantly when order opens)
            </Label>
            <textarea
              id="autoReply"
              rows={2}
              placeholder="e.g. Hello! Please make payment and send receipt in chat. Releasing within 2 mins."
              value={autoReply}
              onChange={(e) => setAutoReply(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#121212] p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
            />
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-[#00A070]/10 border border-[#00A070]/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-gray-300">
          <ShieldCheck className="w-5 h-5 text-[#00A070] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white mb-0.5">Automated Escrow Protection</p>
            <p>
              When a trader opens an order, crypto is automatically reserved and locked in escrow until the seller verifies fiat receipt in their bank/wallet and releases the crypto.
            </p>
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 text-base font-bold bg-[#00A070] hover:bg-[#00B07C] shadow-lg cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {isEditMode ? "Saving Changes..." : "Publishing Advertisement..."}
            </>
          ) : isEditMode ? (
            <>
              <Check className="w-5 h-5 mr-2" /> Save & Update Advertisement
            </>
          ) : (
            `Publish ${side} Advertisement`
          )}
        </Button>
      </form>
    </div>
  );
}

export default function PostAdPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-24 text-center text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070] mx-auto mb-3" />
          <p className="text-xs">Loading...</p>
        </div>
      }
    >
      <PostAdContent />
    </Suspense>
  );
}
