"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createP2pOrder } from "@/actions/p2p";
import { P2PAdvertisement, P2PMerchant } from "@/lib/p2p/types";
import { toast } from "sonner";
import { useP2PStore } from "@/stores/p2p-store";
import { useCurrencies } from "@/hooks/use-currencies";
import { X, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

interface P2POrderDrawerProps {
  ad: P2PAdvertisement | null;
  merchant: P2PMerchant | null;
  onClose: () => void;
}

export function P2POrderDrawer({ ad, merchant, onClose }: P2POrderDrawerProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { fiats } = useCurrencies();
  const { query } = useP2PStore();

  const [fiatAmount, setFiatAmount] = useState<string>("");
  const [cryptoAmount, setCryptoAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user is not authenticated, redirect to login preserving trade intent
  useEffect(() => {
    if (!isAuthenticated && !isAuthLoading && ad) {
      toast.error("Please log in to initiate a P2P trade.");
      onClose();
      router.push(`/login?redirect=${encodeURIComponent(`/p2p?action=trade&adId=${ad.id}`)}`);
    }
  }, [isAuthenticated, isAuthLoading, ad, onClose, router]);

  // Initialize payment methods
  useEffect(() => {
    if (ad) {
      const methods = Array.isArray(ad.paymentMethods) ? ad.paymentMethods : [];
      if (methods.length > 0) {
        const first = methods[0];
        setPaymentMethod(typeof first === "string" ? first : (first?.type || first?.name || "bank_transfer"));
      } else {
        setPaymentMethod("bank_transfer");
      }
    }
  }, [ad]);

  if (!ad || !merchant) return null;

  const fiatCode = ad.fiatCurrency || ad.fiat || "USD";
  const fiatSymbol = fiats.find(f => f.code === fiatCode)?.symbol || (fiatCode === "INR" ? "₹" : (fiatCode === "USD" ? "$" : fiatCode));
  const isBuyMode = query.side.toLowerCase() === "buy";

  const handleFiatChange = (val: string) => {
    setFiatAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && ad.price > 0) {
      setCryptoAmount((num / ad.price).toFixed(6));
    } else {
      setCryptoAmount("");
    }
  };

  const handleCryptoChange = (val: string) => {
    setCryptoAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && ad.price > 0) {
      setFiatAmount((num * ad.price).toFixed(2));
    } else {
      setFiatAmount("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fNum = parseFloat(fiatAmount);
    const cNum = parseFloat(cryptoAmount);

    if (isNaN(fNum) || fNum <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (fNum < Number(ad.minLimit)) {
      toast.error(`Minimum order limit is ${fiatSymbol}${Number(ad.minLimit).toLocaleString()}`);
      return;
    }
    if (fNum > Number(ad.maxLimit)) {
      toast.error(`Maximum order limit is ${fiatSymbol}${Number(ad.maxLimit).toLocaleString()}`);
      return;
    }
    if (cNum > Number(ad.availableAmount)) {
      toast.error(`Requested volume exceeds available amount (${ad.availableAmount} ${ad.asset})`);
      return;
    }
    if (!paymentMethod) {
      toast.error("Please select a payment method.");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please log in to initiate a P2P trade.");
      onClose();
      router.push(`/login?redirect=${encodeURIComponent(`/p2p?action=trade&adId=${ad.id}`)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createP2pOrder({
        adId: ad.id,
        fiatAmount: fNum,
        cryptoAmount: cNum,
        paymentMethod,
      });

      if (res.success && res.data) {
        toast.success("Order created successfully!");
        onClose();
        router.push(`/p2p/order/${res.data.id}`);
      } else {
        if (res.error?.includes("Unauthorized") || res.error?.includes("Log in")) {
          toast.error("Please log in to initiate a P2P trade.");
          onClose();
          router.push(`/login?redirect=${encodeURIComponent(`/p2p?action=trade&adId=${ad.id}`)}`);
        } else {
          toast.error(res.error || "Failed to create order");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const methods = Array.isArray(ad.paymentMethods) ? ad.paymentMethods : [];

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] transition-opacity" 
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 w-full md:w-[480px] lg:w-[520px] bg-[#161822] border-l border-white/10 shadow-2xl z-[70] flex flex-col text-white animate-in slide-in-from-right duration-200">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/10 shrink-0 bg-[#161822]">
            <div>
              <h2 className="text-lg font-bold text-white">
                {isBuyMode ? `Buy ${ad.asset}` : `Sell ${ad.asset}`}
              </h2>
              <p className="text-xs text-gray-400">Institutional Escrow Protection</p>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
            {/* Merchant Profile */}
            <div className="flex items-center gap-4 bg-[#121212] p-4 rounded-xl border border-white/5">
              <div className="w-12 h-12 rounded-full bg-[#00A070]/15 border border-[#00A070]/30 text-[#00A070] font-bold flex items-center justify-center text-lg">
                {merchant.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">{merchant.displayName}</span>
                  {merchant.verified && <CheckCircle2 className="w-4 h-4 text-[#00A070]" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                  <span className="text-emerald-400 font-semibold">{merchant.completionRate}% completion</span>
                  <span>•</span>
                  <span>{merchant.totalOrders} trades</span>
                </div>
              </div>
            </div>

            {/* Ad Stats Grid */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#121212] border border-white/5 text-xs">
              <div>
                <p className="text-gray-400 mb-0.5">Unit Price</p>
                <p className="font-mono font-bold text-sm text-[#00A070]">
                  {fiatSymbol}{Number(ad.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Available Volume</p>
                <p className="font-mono font-bold text-sm text-white">
                  {Number(ad.availableAmount).toLocaleString()} {ad.asset}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Order Limit</p>
                <p className="font-mono text-gray-300">
                  {fiatSymbol}{Number(ad.minLimit).toLocaleString()} - {fiatSymbol}{Number(ad.maxLimit).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Payment Window</p>
                <p className="font-semibold text-gray-300">
                  {ad.paymentTimeLimit || 15} minutes
                </p>
              </div>
            </div>

            {/* Terms */}
            {ad.terms && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Merchant Terms</h3>
                <p className="text-xs bg-[#121212] p-3 rounded-lg border border-white/5 text-gray-300 leading-relaxed">
                  {ad.terms}
                </p>
              </div>
            )}

            {/* Order Inputs */}
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <Label htmlFor="fiatAmount" className="text-gray-300">
                    {isBuyMode ? "I want to pay" : "I will receive"}
                  </Label>
                  <span className="text-gray-400">
                    Limit: {fiatSymbol}{Number(ad.minLimit).toLocaleString()} - {fiatSymbol}{Number(ad.maxLimit).toLocaleString()}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="fiatAmount"
                    type="number"
                    step="any"
                    placeholder={`Enter ${fiatCode} amount`}
                    value={fiatAmount}
                    onChange={(e) => handleFiatChange(e.target.value)}
                    className="pr-16 h-11 text-sm font-semibold bg-[#121212] border-white/10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs pointer-events-none">
                    {fiatCode}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cryptoAmount" className="text-gray-300 text-xs">
                  {isBuyMode ? "I will receive" : "I will sell"}
                </Label>
                <div className="relative">
                  <Input
                    id="cryptoAmount"
                    type="number"
                    step="any"
                    placeholder={`Enter ${ad.asset} amount`}
                    value={cryptoAmount}
                    onChange={(e) => handleCryptoChange(e.target.value)}
                    className="pr-16 h-11 text-sm font-semibold bg-[#121212] border-white/10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00A070] font-bold text-xs pointer-events-none">
                    {ad.asset}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2 pt-1">
                <Label className="text-gray-300 text-xs">Select Payment Method</Label>
                <div className="space-y-2">
                  {methods.length > 0 ? (
                    methods.map((methodObj: any, idx: number) => {
                      const mName = typeof methodObj === "string" ? methodObj : (methodObj?.type || methodObj?.name || "Payment");
                      const isSelected = paymentMethod === mName;
                      return (
                        <label 
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "border-[#00A070] bg-[#00A070]/10 text-white"
                              : "border-white/10 bg-[#121212] text-gray-300 hover:border-white/20"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={mName}
                            checked={isSelected}
                            onChange={() => setPaymentMethod(mName)}
                            className="accent-[#00A070]"
                          />
                          <span className="text-xs font-semibold">
                            {String(mName).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#00A070] bg-[#00A070]/10 text-white">
                      <input type="radio" checked readOnly className="accent-[#00A070]" />
                      <span className="text-xs font-semibold">Bank Transfer</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Escrow Badge */}
              <div className="bg-[#00A070]/10 border border-[#00A070]/20 rounded-xl p-3 flex items-start gap-3 text-xs text-gray-300">
                <ShieldCheck className="w-5 h-5 text-[#00A070] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white mb-0.5">Secure Escrow Lock</p>
                  <p>The seller's cryptocurrency is held safely in escrow before payment is made.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pinned Sticky Bottom Action Bar */}
          <div className="shrink-0 p-4 md:p-5 bg-[#121212] border-t border-white/10 shadow-2xl pb-[max(env(safe-area-inset-bottom),16px)]">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2.5 px-0.5">
              <span>
                {isBuyMode ? "You Pay" : "You Receive"}:{" "}
                <strong className="text-white font-mono">
                  {fiatAmount ? `${fiatSymbol}${Number(fiatAmount).toLocaleString()}` : "--"}
                </strong>
              </span>
              <span>
                {isBuyMode ? "You Receive" : "You Sell"}:{" "}
                <strong className="text-[#00A070] font-mono">
                  {cryptoAmount ? `${cryptoAmount} ${ad.asset}` : "--"}
                </strong>
              </span>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className={`w-full h-12 text-base font-bold shadow-xl rounded-xl transition-transform active:scale-[0.98] ${
                isBuyMode ? "bg-[#00A070] hover:bg-[#00B07C]" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating Order...</>
              ) : isBuyMode ? (
                `Buy ${ad.asset}`
              ) : (
                `Sell ${ad.asset}`
              )}
            </Button>
          </div>
        </form>
      </div>


    </>
  );
}
