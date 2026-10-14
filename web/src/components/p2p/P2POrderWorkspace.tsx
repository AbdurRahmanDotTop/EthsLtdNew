"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getP2pOrder,
  markP2pOrderPaid,
  releaseP2pOrder,
  cancelP2pOrder,
  disputeP2pOrder,
} from "@/actions/p2p";
import { useCurrencies } from "@/hooks/use-currencies";
import { P2PChat } from "@/components/p2p/P2PChat";
import {
  Loader2,
  AlertCircle,
  Copy,
  CheckCircle2,
  Clock,
  Check,
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  Landmark,
  QrCode,
  Wallet,
  CopyCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface P2POrderWorkspaceProps {
  orderId: string;
}

export function P2POrderWorkspace({ orderId }: P2POrderWorkspaceProps) {
  const router = useRouter();
  const { fiats } = useCurrencies();

  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [allCopied, setAllCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dispute modal state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");

  const fetchOrder = async (isPolling = false) => {
    try {
      const res = await getP2pOrder(orderId);
      if (res.success && res.data) {
        setOrder(res.data);
      }
    } catch (e) {
      console.error("Failed to fetch order", e);
    } finally {
      if (!isPolling) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchOrder(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Countdown timer
  useEffect(() => {
    if (order && (order.status === "AWAITING_PAYMENT" || order.status === "ESCROW_LOCKED")) {
      const updateTimer = () => {
        const expiry = new Date(order.expiresAt).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiry - now) / 1000));
        setTimeLeft(diff);
      };
      updateTimer();
      const t = setInterval(updateTimer, 1000);
      return () => clearInterval(t);
    }
  }, [order]);

  const copyToClipboard = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copied ${field === "ALL" ? "all details" : "to clipboard"}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Safely parse payment details snapshot with client-side fallback
  const paymentDetails: Record<string, any> = useMemo(() => {
    let details: Record<string, any> = {};
    if (order?.paymentDetails) {
      if (typeof order.paymentDetails === "string") {
        try {
          details = JSON.parse(order.paymentDetails);
        } catch {}
      } else if (typeof order.paymentDetails === "object") {
        details = order.paymentDetails;
      }
    }
    if (details && Object.keys(details).length > 0) return details;

    // Fallback to ad payment methods if order.paymentDetails is not present
    if (order?.ad?.paymentMethods) {
      try {
        const adMethods =
          typeof order.ad.paymentMethods === "string"
            ? JSON.parse(order.ad.paymentMethods)
            : order.ad.paymentMethods;
        if (Array.isArray(adMethods)) {
          const matched = adMethods.find((m: any) => {
            const name = typeof m === "string" ? m : (m.name || m.type || "");
            const ordM = (order.paymentMethod || "").toLowerCase();
            return (
              name.toLowerCase() === ordM ||
              name.toLowerCase().includes(ordM) ||
              ordM.includes(name.toLowerCase())
            );
          });
          if (matched?.details && Object.keys(matched.details).length > 0) {
            return matched.details;
          }
        }
      } catch {}
    }

    return details || {};
  }, [order?.paymentDetails, order?.ad?.paymentMethods, order?.paymentMethod]);

  const hasPaymentDetails = Object.keys(paymentDetails).length > 0;

  const handleMarkPaid = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await markP2pOrderPaid(order.id);
      if (res.success) {
        toast.success("Payment marked as sent!");
        fetchOrder();
      } else {
        toast.error(res.error || "Failed to mark paid");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to mark paid");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelease = async () => {
    if (isSubmitting) return;
    if (
      !confirm(
        "Are you sure you have verified the funds directly in your bank/wallet account? Releasing escrow is irreversible."
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await releaseP2pOrder(order.id);
      if (res.success) {
        toast.success("Crypto released to buyer!");
        fetchOrder();
      } else {
        toast.error(res.error || "Failed to release crypto");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to release crypto");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (isSubmitting) return;
    if (!confirm("Are you sure you want to cancel this order?")) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await cancelP2pOrder(order.id);
      if (res.success) {
        toast.success("Order cancelled");
        fetchOrder();
      } else {
        toast.error(res.error || "Failed to cancel");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason.trim() || !disputeDescription.trim()) {
      toast.error("Please fill in dispute reason and description");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await disputeP2pOrder(order.id, {
        reason: disputeReason,
        description: disputeDescription,
      });
      if (res.success) {
        toast.success("Dispute raised. An admin moderator will investigate.");
        setShowDisputeModal(false);
        fetchOrder();
      } else {
        toast.error(res.error || "Failed to raise dispute");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to raise dispute");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldLabel = (key: string) => {
    const map: Record<string, string> = {
      accountName: "Account Holder Name",
      accountHolder: "Account Holder Name",
      payeeName: "Payee / Account Holder Name",
      name: "Account Holder Name",
      accountNumber: "Bank Account Number / Identifier",
      accountNo: "Bank Account Number",
      bankName: "Bank Name",
      bank: "Bank Name",
      routingOrIfsc: "IFSC / Routing / Swift Code",
      ifscCode: "IFSC Code",
      ifsc: "IFSC Code",
      swiftCode: "SWIFT / BIC Code",
      vpaAddress: "UPI ID / VPA",
      upiId: "UPI ID / VPA",
      walletEmail: "Wallet Email / ID",
      accountType: "Account Type (Savings/Current)",
      cityRegion: "Trading Location / City",
      branchName: "Branch Name",
      contactPhone: "Contact Phone Number",
      phoneNumber: "Phone Number",
    };
    return (
      map[key] ||
      key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .replace(/_/g, " ")
    );
  };

  const copyAllPaymentDetails = () => {
    if (!order) return;
    const lines = [
      `--- P2P Payment Details ---`,
      `Order: #${order.orderNumber || order.id?.slice(0, 8)}`,
      `Amount to Pay: ${fiatSymbol}${order.fiatAmount} ${fiatCode}`,
      `Selected Method: ${order.paymentMethod?.replace(/_/g, " ")}`,
    ];
    Object.entries(paymentDetails).forEach(([k, v]) => {
      if (v && typeof v !== "object") {
        lines.push(`${getFieldLabel(k)}: ${String(v).trim()}`);
      }
    });
    navigator.clipboard.writeText(lines.join("\n"));
    setAllCopied(true);
    toast.success("All payment details copied to clipboard!");
    setTimeout(() => setAllCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <Loader2 className="w-10 h-10 animate-spin text-[#00A070] mb-4" />
        <p className="text-sm font-semibold">Loading secure P2P workspace...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-24 bg-[#161822] rounded-2xl border border-white/10 max-w-lg mx-auto p-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Order Not Found</h2>
        <p className="text-xs text-gray-400 mb-6">
          This order does not exist or you do not have permission to access it.
        </p>
        <Button onClick={() => router.push("/p2p")} className="bg-[#00A070] hover:bg-[#00B07C]">
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const isBuyer = order.role === "BUYER";
  const fiatCode = order.fiatCurrency || "USD";
  const fiatSymbol =
    fiats.find((f) => f.code === fiatCode)?.symbol ||
    (fiatCode === "INR" ? "₹" : fiatCode === "USD" ? "$" : fiatCode);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const counterpart = isBuyer ? order.seller : order.buyer;
  const counterpartName =
    counterpart?.name || counterpart?.email?.split("@")[0] || (isBuyer ? "Seller" : "Buyer");

  // Determine method icon
  const methodUpper = (order.paymentMethod || "").toUpperCase();
  const isBank = methodUpper.includes("BANK") || methodUpper.includes("IMPS") || methodUpper.includes("NEFT");
  const isUpi = methodUpper.includes("UPI") || methodUpper.includes("GPAY") || methodUpper.includes("PHONEPE");
  const isWallet = methodUpper.includes("PAYPAL") || methodUpper.includes("WALLET");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 pb-36 sm:pb-40 lg:pb-16 max-w-full">
      {/* Left 2 Cols: Order Flow, Financial Details & Seller Payment Credentials */}
      <div className="lg:col-span-2 space-y-5">
        {/* Status Card */}
        <div className="bg-[#161822] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                Order #{order.orderNumber || order.id?.slice(0, 8)}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  order.status === "COMPLETED"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : order.status === "CANCELLED" || order.status === "EXPIRED"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : order.status === "DISPUTED"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                }`}
              >
                {order.status.replace(/_/g, " ")}
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-white break-words">
              {isBuyer
                ? `Buy ${order.cryptoAmount} ${order.asset}`
                : `Sell ${order.cryptoAmount} ${order.asset}`}
            </h1>
          </div>

          {(order.status === "AWAITING_PAYMENT" || order.status === "ESCROW_LOCKED") && (
            <div className="text-left sm:text-right bg-[#121212] sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-white/5">
              <p className="text-xs text-gray-400 mb-0.5">Payment Window Remaining</p>
              <div className="text-xl sm:text-2xl font-mono font-bold text-amber-400 flex items-center gap-1.5 sm:justify-end">
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                {formatTime(timeLeft)}
              </div>
            </div>
          )}
        </div>

        {/* Financial Summary & Counterparty */}
        <div className="bg-[#161822] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Financial Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Financial Details
              </h3>
              <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs gap-2">
                  <span className="text-gray-400 shrink-0">
                    {isBuyer ? "Total Fiat to Pay" : "Total Fiat to Receive"}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white font-mono break-all text-right">
                    {fiatSymbol}
                    {Number(order.fiatAmount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {fiatCode}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs gap-2">
                  <span className="text-gray-400 shrink-0">Crypto Volume in Escrow</span>
                  <span className="text-sm sm:text-base font-bold text-[#00A070] font-mono break-all text-right">
                    {Number(order.cryptoAmount).toLocaleString()} {order.asset}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs gap-2">
                  <span className="text-gray-400 shrink-0">Unit Price</span>
                  <span className="font-mono text-gray-300 break-all text-right">
                    {fiatSymbol}
                    {Number(order.price).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    / {order.asset}
                  </span>
                </div>
              </div>
            </div>

            {/* Counterpart / Payment Info Card */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Trade Counterparty
              </h3>
              <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#00A070]/20 text-[#00A070] font-bold flex items-center justify-center text-sm border border-[#00A070]/30 shrink-0">
                    {counterpartName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-sm truncate">{counterpartName}</span>
                    <span className="text-gray-400 text-[11px]">
                      {isBuyer ? "Seller / Advertiser" : "Buyer"}
                    </span>
                  </div>
                </div>

                {/* Selected Payment Method Header inside Counterparty Box */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                  <span className="text-gray-400">Selected Method:</span>
                  <span className="font-bold text-white uppercase text-xs px-2.5 py-1 rounded bg-[#00A070]/10 text-[#00A070] border border-[#00A070]/30 flex items-center gap-1.5">
                    {isBank ? (
                      <Landmark className="w-3.5 h-3.5" />
                    ) : isUpi ? (
                      <QrCode className="w-3.5 h-3.5" />
                    ) : (
                      <CreditCard className="w-3.5 h-3.5" />
                    )}
                    {order.paymentMethod?.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Quick Summary of Payment Details directly inside this box */}
                {hasPaymentDetails && (
                  <div className="pt-2 border-t border-white/5 space-y-1.5 text-[11px]">
                    {(paymentDetails.accountName || paymentDetails.payeeName) && (
                      <div className="flex justify-between items-center text-gray-300">
                        <span className="text-gray-400">Payee:</span>
                        <span className="font-semibold text-white truncate max-w-[170px]">
                          {paymentDetails.accountName || paymentDetails.payeeName}
                        </span>
                      </div>
                    )}
                    {(paymentDetails.bankName || paymentDetails.bank) && (
                      <div className="flex justify-between items-center text-gray-300">
                        <span className="text-gray-400">Bank:</span>
                        <span className="font-semibold text-white truncate max-w-[170px]">
                          {paymentDetails.bankName || paymentDetails.bank}
                        </span>
                      </div>
                    )}
                    {(paymentDetails.accountNumber || paymentDetails.upiId || paymentDetails.vpaAddress || paymentDetails.walletEmail) && (
                      <div className="flex justify-between items-center bg-white/5 p-1.5 rounded-lg border border-white/5">
                        <span className="text-gray-400 text-[10px]">
                          {paymentDetails.accountNumber ? "A/C:" : "ID:"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white text-[11px]">
                            {paymentDetails.accountNumber || paymentDetails.upiId || paymentDetails.vpaAddress || paymentDetails.walletEmail}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                paymentDetails.accountNumber ||
                                  paymentDetails.upiId ||
                                  paymentDetails.vpaAddress ||
                                  paymentDetails.walletEmail,
                                "quick-account"
                              )
                            }
                            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            title="Copy"
                          >
                            {copiedField === "quick-account" ? (
                              <Check className="w-3 h-3 text-[#00A070]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Seller Receiving Account / Bank Details Section */}
        <div className="bg-[#161822] border border-[#00A070]/30 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#00A070]/15 text-[#00A070] border border-[#00A070]/30 shrink-0">
                {isBank ? (
                  <Landmark className="w-5 h-5" />
                ) : isUpi ? (
                  <QrCode className="w-5 h-5" />
                ) : isWallet ? (
                  <Wallet className="w-5 h-5" />
                ) : (
                  <CreditCard className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>
                    {isBuyer ? "Seller Payment Credentials (Pay To)" : "Your Receiving Account Details"}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00A070]/10 text-[#00A070] border border-[#00A070]/20 uppercase">
                    {order.paymentMethod?.replace(/_/g, " ")}
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {isBuyer
                    ? "Transfer the exact fiat order amount to the seller credentials below before clicking Transferred."
                    : "The buyer has been provided with these receiving credentials for settlement."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Account</span>
              </div>
              {hasPaymentDetails && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyAllPaymentDetails}
                  className="h-7 text-[11px] border-white/10 hover:border-[#00A070]/40 text-gray-300 hover:text-white"
                >
                  {allCopied ? (
                    <>
                      <Check className="w-3 h-3 mr-1 text-[#00A070]" /> Copied All
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" /> Copy All
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Payment Detail Fields Grid */}
          {hasPaymentDetails ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(paymentDetails).map(([key, val]) => {
                  if (!val || typeof val === "object") return null;
                  const strVal = String(val).trim();
                  if (!strVal) return null;
                  const label = getFieldLabel(key);
                  const isPrimary =
                    key === "accountNumber" ||
                    key === "accountNo" ||
                    key === "vpaAddress" ||
                    key === "upiId" ||
                    key === "walletEmail";

                  return (
                    <div
                      key={key}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isPrimary
                          ? "bg-[#121212] border-[#00A070]/50 shadow-md sm:col-span-2"
                          : "bg-[#121212]/80 border-white/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] text-gray-400 block font-medium">
                          {label}
                        </span>
                        <span
                          className={`block font-mono mt-0.5 select-all break-all ${
                            isPrimary
                              ? "text-sm sm:text-base font-extrabold text-white tracking-wide"
                              : "text-xs sm:text-sm font-semibold text-gray-200"
                          }`}
                        >
                          {strVal}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(strVal, key)}
                        className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-[#00A070]/20 hover:text-[#00A070] text-gray-400 transition-colors shrink-0 cursor-pointer border border-white/5 active:scale-95"
                        title={`Copy ${label}`}
                      >
                        {copiedField === key ? (
                          <Check className="w-4 h-4 text-[#00A070]" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Safety notice */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Important:</strong> Please ensure the payment is sent exclusively from
                  your own verified bank account matching your platform name. Do <strong>NOT</strong> write crypto-related terms
                  (e.g., BTC, USDT, P2P, Crypto) in payment remarks.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">No Receiving Details Specified in Ad</p>
                <p className="text-[11px] text-gray-300 mt-1">
                  The seller has not attached account credentials for this method in their ad.
                  Please ask the seller in the live trade chat below for their payment account
                  details before transferring funds.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Step Bar based on current state */}
        <div className="bg-[#161822] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl">
          {/* Case 1: Buyer needs to pay */}
          {isBuyer &&
            (order.status === "AWAITING_PAYMENT" || order.status === "ESCROW_LOCKED") && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-white text-base">
                    Step 1: Transfer Funds Directly
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Transfer exactly{" "}
                    <strong className="text-white font-mono">
                      {fiatSymbol}
                      {order.fiatAmount} {fiatCode}
                    </strong>{" "}
                    to the seller credentials displayed above. Once transferred, click below to
                    notify the seller.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                  <Button
                    onClick={handleMarkPaid}
                    disabled={isSubmitting}
                    className="bg-[#00A070] hover:bg-[#00B07C] text-white font-bold px-6 w-full sm:w-auto h-12 sm:h-11 text-xs sm:text-sm shadow-lg shadow-[#00A070]/20 cursor-pointer order-1 sm:order-2 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Transferred, Notify Seller</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="border-white/10 text-gray-400 hover:text-white w-full sm:w-auto h-11 text-xs font-semibold cursor-pointer order-2 sm:order-1"
                  >
                    Cancel Order
                  </Button>
                </div>
              </div>
            )}

          {/* Case 2: Buyer has marked paid, awaiting seller release */}
          {isBuyer && order.status === "PAYMENT_MARKED" && (
            <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-xl text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
              <h4 className="font-bold text-white text-sm">Payment Marked as Complete</h4>
              <p className="text-xs text-gray-300 max-w-md mx-auto">
                The seller is verifying receipt of funds in their account and will release the
                cryptocurrency from escrow shortly.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDisputeModal(true)}
                className="border-white/10 text-amber-400 hover:bg-amber-500/10 mt-2"
              >
                Raise Dispute / Appeal
              </Button>
            </div>
          )}

          {/* Case 3: Seller waiting for buyer payment */}
          {!isBuyer &&
            (order.status === "AWAITING_PAYMENT" || order.status === "ESCROW_LOCKED") && (
              <div className="bg-[#121212] p-5 rounded-xl border border-white/10 text-center space-y-2">
                <Clock className="w-7 h-7 text-amber-400 mx-auto" />
                <h4 className="font-bold text-white text-sm">Waiting for Buyer to Pay</h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  The buyer has {formatTime(timeLeft)} to make the transfer of {fiatSymbol}
                  {order.fiatAmount} {fiatCode}.
                </p>
              </div>
            )}

          {/* Case 4: Seller needs to confirm payment and release */}
          {!isBuyer && order.status === "PAYMENT_MARKED" && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-xl space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-sm">Buyer Has Marked Payment</h4>
                  <p className="text-xs text-gray-300 mt-1">
                    Please log in to your banking app to confirm you have received exactly{" "}
                    <strong className="text-white">
                      {fiatSymbol}
                      {order.fiatAmount} {fiatCode}
                    </strong>
                    . Do NOT release crypto until you verify the deposit.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                <Button
                  onClick={handleRelease}
                  disabled={isSubmitting}
                  className="bg-[#00A070] hover:bg-[#00B07C] text-white font-bold px-6 w-full sm:w-auto h-12 sm:h-11 text-xs sm:text-sm shadow-lg shadow-[#00A070]/20 order-1 sm:order-2 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Payment Received, Release Crypto</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDisputeModal(true)}
                  className="border-white/10 text-amber-400 hover:bg-amber-500/10 w-full sm:w-auto h-11 text-xs order-2 sm:order-1"
                >
                  Payment Not Received? Dispute
                </Button>
              </div>
            </div>
          )}

          {/* Case 5: Completed */}
          {order.status === "COMPLETED" && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-xl text-center space-y-2">
              <Check className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-white text-base">Trade Completed Successfully</h4>
              <p className="text-xs text-gray-300">
                {order.cryptoAmount} {order.asset} has been released to buyer wallet.
              </p>
            </div>
          )}

          {/* Case 6: Disputed */}
          {order.status === "DISPUTED" && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <h4 className="font-bold text-white text-base">Order is Under Admin Dispute</h4>
              <p className="text-xs text-gray-300 max-w-md mx-auto">
                A moderator is inspecting the transaction and chat logs to resolve escrow.
              </p>
            </div>
          )}

          {/* Case 7: Cancelled */}
          {order.status === "CANCELLED" && (
            <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <h4 className="font-bold text-white text-base">Order Cancelled</h4>
              <p className="text-xs text-gray-400">
                Escrowed funds have been returned to seller.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Col: Real-time chat */}
      <div className="min-h-[480px] h-[520px] sm:h-[580px] lg:h-[680px] lg:sticky lg:top-20">
        <P2PChat order={order} currentUserId={order?.currentUserId} />
      </div>

      {/* Dispute Modal */}
      <Dialog open={showDisputeModal} onOpenChange={setShowDisputeModal}>
        <DialogContent className="w-[92vw] sm:max-w-md bg-[#161822] border-white/10 text-white p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" /> Raise Dispute / Appeal
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-xs">
              Our moderation team will review banking records, evidence, and chat history.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDisputeSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Dispute Reason</label>
              <Input
                placeholder="e.g. Payment not received / Incorrect amount / Fraudulent claim"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Detailed Explanation</label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-[#121212] p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
                placeholder="Explain what happened in detail..."
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDisputeModal(false)}
                className="border-white/10 w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold w-full sm:w-auto"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit Dispute
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
