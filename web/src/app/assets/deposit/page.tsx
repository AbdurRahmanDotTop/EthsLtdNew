"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  Loader2,
  Copy,
  Check,
  Building2,
  QrCode,
  ShieldCheck,
  History,
  AlertTriangle,
  Wallet,
  Upload,
  FileText,
  X,
  ImageIcon,
  Eye,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitDeposit, getActivePaymentMethods } from "@/actions/user";
import { toast } from "sonner";

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  bankName?: string | null;
  accountHolder?: string | null;
  accountNumber?: string | null;
  ifscOrSwift?: string | null;
  address?: string | null;
  network?: string | null;
  instructions?: string | null;
  minAmount: number;
  maxAmount?: number | null;
  enabled: boolean;
  displayOrder: number;
}

export default function DepositPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Tab: "BANK" or "CRYPTO"
  const [activeTab, setActiveTab] = useState<"BANK" | "CRYPTO">("BANK");

  // Dynamic payment methods from database
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);

  // Selected Bank & Crypto Method IDs
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [selectedCryptoId, setSelectedCryptoId] = useState<string>("");

  // Form states
  const [amount, setAmount] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Proof upload states
  const [proofUrl, setProofUrl] = useState<string>("");
  const [proofFileName, setProofFileName] = useState<string>("");
  const [proofFileSize, setProofFileSize] = useState<number>(0);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchActiveMethods = () => {
    setIsLoadingMethods(true);
    getActivePaymentMethods()
      .then((methods) => {
        if (methods && methods.length > 0) {
          const list = methods as PaymentMethod[];
          setPaymentMethods(list);
          const banks = list.filter((m) => m.type === "BANK");
          const cryptos = list.filter((m) => m.type === "CRYPTO");
          if (banks.length > 0) {
            setSelectedBankId(banks[0].id);
          }
          if (cryptos.length > 0) {
            setSelectedCryptoId(cryptos[0].id);
          }
        } else {
          setPaymentMethods([]);
        }
      })
      .catch((err) => {
        console.error("Error loading payment methods:", err);
        toast.error("Failed to load payment methods.");
      })
      .finally(() => setIsLoadingMethods(false));
  };

  useEffect(() => {
    fetchActiveMethods();
  }, []);

  const bankMethods = paymentMethods.filter((m) => m.type === "BANK");
  const cryptoMethods = paymentMethods.filter((m) => m.type === "CRYPTO");

  const currentBankMethod = bankMethods.find((m) => m.id === selectedBankId) || bankMethods[0];
  const currentCryptoMethod = cryptoMethods.find((m) => m.id === selectedCryptoId) || cryptoMethods[0];

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Proof file upload handler
  const handleProofFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be re-selected if needed
    e.target.value = "";

    // 1. Client-side size validation (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      toast.error(`File size exceeds 5MB limit (${sizeMB}MB). Please upload a smaller file.`);
      setUploadError(`File is too large (${sizeMB}MB). Max allowed size is 5MB.`);
      return;
    }

    // 2. Client-side extension validation
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExts.includes(ext)) {
      toast.error("Invalid file format. Please upload JPG, PNG, WEBP, or PDF.");
      setUploadError("Invalid file type. Allowed: JPG, PNG, WEBP, PDF.");
      return;
    }

    // 3. Upload to secure endpoint
    setIsUploadingProof(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/deposit/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as any;

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload payment proof.");
      }

      setProofUrl(data.url);
      setProofFileName(file.name);
      setProofFileSize(file.size);
      toast.success("Payment proof uploaded successfully!");
    } catch (err: any) {
      console.error("Upload error:", err);
      const msg = err.message || "Failed to upload file.";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const removeProof = () => {
    setProofUrl("");
    setProofFileName("");
    setProofFileSize(0);
    setUploadError(null);
  };

  // Submit Deposit
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentMethod = activeTab === "BANK" ? currentBankMethod : currentCryptoMethod;
    if (!currentMethod) {
      toast.error("No active payment method available. Please select another channel.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    const minRequired = currentMethod.minAmount ?? (activeTab === "BANK" ? 50 : 10);

    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid deposit amount.");
      return;
    }

    if (parsedAmount < minRequired) {
      toast.error(`Minimum deposit for this channel is ${minRequired} USDT.`);
      return;
    }

    if (!referenceNumber.trim()) {
      toast.error(
        activeTab === "BANK"
          ? "Please enter your Bank Transfer / UTR reference number."
          : "Please enter your Blockchain Transaction Hash (TXID)."
      );
      return;
    }

    // MANDATORY Proof Validation
    if (!proofUrl || !proofUrl.trim()) {
      toast.error("Payment proof receipt or transfer screenshot is mandatory. Please attach your proof.");
      fileInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSubmitting(true);
    try {
      const channelLabel =
        activeTab === "BANK"
          ? currentBankMethod?.bankName || currentBankMethod?.name || "Bank Transfer"
          : `${currentCryptoMethod?.name || "USDT"}-${currentCryptoMethod?.network || "CRYPTO"}`;

      const res = await submitDeposit({
        amount: parsedAmount,
        method: activeTab,
        networkOrBank: channelLabel,
        referenceNumber: referenceNumber.trim(),
        proofUrl: proofUrl.trim(),
      });

      if (res.success) {
        toast.success("Deposit request submitted successfully! Pending admin approval.");
        router.push("/assets/records?tab=deposit");
      } else {
        toast.error(res.error || "Failed to submit deposit.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPdfProof = proofFileName.toLowerCase().endsWith(".pdf") || proofUrl.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-20">
        <Link href="/assets" className="text-gray-400 hover:text-white transition-colors p-1">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <span className="font-bold text-lg text-white">Deposit</span>
        <Link
          href="/assets/records?tab=deposit"
          className="text-xs text-[#00A070] hover:text-emerald-300 transition-colors flex items-center gap-1 font-medium bg-[#1A1C24] px-3 py-1.5 rounded-lg border border-white/5"
        >
          <History className="w-3.5 h-3.5" />
          <span>Records</span>
        </Link>
      </header>

      <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto w-full">
        {/* Hidden File Input for Proof Upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleProofFileSelect}
          accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
          className="hidden"
        />

        {/* Payment Rail Selector Tabs */}
        <div className="bg-[#1A1C24] p-1 rounded-xl border border-white/5 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("BANK");
              setAmount("");
              setReferenceNumber("");
              setUploadError(null);
            }}
            className={`py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === "BANK"
                ? "bg-[#00A070] text-white shadow-md shadow-[#00A070]/20"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Bank Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("CRYPTO");
              setAmount("");
              setReferenceNumber("");
              setUploadError(null);
            }}
            className={`py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === "CRYPTO"
                ? "bg-[#00A070] text-white shadow-md shadow-[#00A070]/20"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Crypto Wallet</span>
          </button>
        </div>

        {/* Loading Indicator */}
        {isLoadingMethods ? (
          <div className="py-16 text-center text-gray-500 bg-[#1A1C24] rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#00A070]" />
            <span className="text-xs font-mono">Loading payment channels...</span>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* BANK TRANSFER TAB */}
            {/* ========================================================================= */}
            {activeTab === "BANK" && (
              <>
                {bankMethods.length === 0 ? (
                  <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-6 text-center">
                    <Building2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-white mb-1">Bank Transfer Currently Unavailable</h3>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto mb-4">
                      Direct bank settlement channels are currently offline for maintenance. Please use the Crypto Deposit rail.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("CRYPTO")}
                      className="px-4 py-2 bg-[#00A070] text-white text-xs font-bold rounded-xl"
                    >
                      Switch to Crypto Deposit
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Multiple Bank Selector */}
                    {bankMethods.length > 1 && (
                      <div className="flex flex-col gap-1.5 mb-1">
                        <label className="text-xs font-semibold text-gray-300">Select Bank Account</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {bankMethods.map((bm) => {
                            const isSelected = currentBankMethod?.id === bm.id;
                            return (
                              <button
                                key={bm.id}
                                type="button"
                                onClick={() => setSelectedBankId(bm.id)}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                  isSelected
                                    ? "bg-[#00A070]/10 border-[#00A070] text-white"
                                    : "bg-[#1A1C24] border-white/5 text-gray-400 hover:border-white/20"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="font-bold text-xs text-white truncate">{bm.bankName || bm.name}</span>
                                  {isSelected && <span className="w-2 h-2 rounded-full bg-[#00A070]" />}
                                </div>
                                <span className="text-[10px] text-gray-400 font-mono block truncate">
                                  {bm.accountNumber}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Beneficiary Card (Loaded dynamically from database) */}
                    <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#00A070]/5 rounded-full blur-2xl pointer-events-none" />

                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#00A070]/10 flex items-center justify-center text-[#00A070]">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-white block">Beneficiary Account</span>
                            <span className="text-[10px] text-gray-400">Direct Bank Settlement Channel</span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-[#00A070]/10 text-[#00A070] px-2 py-0.5 rounded-full font-mono border border-[#00A070]/20 font-bold">
                          Verified
                        </span>
                      </div>

                      <div className="space-y-3 text-xs font-mono">
                        {currentBankMethod?.bankName && (
                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-400 font-sans">Bank Name:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold">{currentBankMethod.bankName}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentBankMethod.bankName!, "Bank Name")}
                                className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white"
                              >
                                {copiedField === "Bank Name" ? (
                                  <Check className="w-3.5 h-3.5 text-[#00A070]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {currentBankMethod?.accountHolder && (
                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-400 font-sans">Account Holder:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold">{currentBankMethod.accountHolder}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentBankMethod.accountHolder!, "Account Holder")}
                                className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white"
                              >
                                {copiedField === "Account Holder" ? (
                                  <Check className="w-3.5 h-3.5 text-[#00A070]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {currentBankMethod?.accountNumber && (
                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-400 font-sans">Account Number:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[#00A070] font-bold tracking-wider text-sm">
                                {currentBankMethod.accountNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentBankMethod.accountNumber!, "Account Number")}
                                className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white"
                              >
                                {copiedField === "Account Number" ? (
                                  <Check className="w-3.5 h-3.5 text-[#00A070]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {currentBankMethod?.ifscOrSwift && (
                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-400 font-sans">IFSC / Swift:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold">{currentBankMethod.ifscOrSwift}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentBankMethod.ifscOrSwift!, "IFSC Code")}
                                className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white"
                              >
                                {copiedField === "IFSC Code" ? (
                                  <Check className="w-3.5 h-3.5 text-[#00A070]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                        <span>Minimum Deposit:</span>
                        <span className="font-mono font-bold text-white">
                          {currentBankMethod?.minAmount ?? 50} USDT
                        </span>
                      </div>

                      {currentBankMethod?.instructions && (
                        <div className="mt-2 text-[10px] text-gray-400 font-sans bg-[#121216] p-2.5 rounded-lg border border-white/5">
                          {currentBankMethod.instructions}
                        </div>
                      )}
                    </div>

                    {/* Bank Deposit Form */}
                    <form onSubmit={handleDeposit} className="flex flex-col gap-4">
                      {/* Amount Input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex justify-between">
                          <span>Transfer Amount *</span>
                          <span className="text-gray-500 font-normal">USDT Equivalent</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            placeholder={`Min. ${currentBankMethod?.minAmount ?? 50}`}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 pr-16 rounded-xl outline-none text-white text-base font-mono font-bold placeholder:text-gray-600 transition-colors"
                            required
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-mono">
                            USDT
                          </span>
                        </div>
                      </div>

                      {/* Reference Number Input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-300">
                          UTR / Bank Reference Number *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. UTR24910284729 or Bank Ref"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 rounded-xl outline-none text-white text-sm font-mono placeholder:text-gray-600 transition-colors"
                          required
                        />
                      </div>

                      {/* MANDATORY PAYMENT PROOF UPLOAD FIELD */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-[#00A070]" />
                            <span>Payment Proof / Transfer Screenshot *</span>
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">Max 5MB (JPG, PNG, WEBP, PDF)</span>
                        </label>

                        {/* Upload Drop Zone / Card */}
                        {!proofUrl ? (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                              isUploadingProof
                                ? "bg-[#161822] border-[#00A070]"
                                : uploadError
                                ? "bg-rose-500/5 border-rose-500/40 hover:border-rose-500"
                                : "bg-[#1A1C24] border-white/15 hover:border-[#00A070] hover:bg-[#1E202B]"
                            }`}
                          >
                            {isUploadingProof ? (
                              <div className="flex flex-col items-center gap-2 py-2">
                                <Loader2 className="w-7 h-7 text-[#00A070] animate-spin" />
                                <span className="text-xs font-mono text-gray-300">Uploading payment proof...</span>
                              </div>
                            ) : (
                              <>
                                <div className="w-10 h-10 rounded-full bg-[#00A070]/10 flex items-center justify-center text-[#00A070]">
                                  <Upload className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-white block">
                                    Click to Upload Payment Proof
                                  </span>
                                  <span className="text-[11px] text-gray-400 mt-0.5 block">
                                    Upload transaction receipt, screenshot, or payment voucher
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-[#00A070] bg-[#00A070]/10 px-2 py-0.5 rounded-full border border-[#00A070]/20">
                                  Mandatory for Verification
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          /* Proof Uploaded Preview */
                          <div className="bg-[#161822] border border-[#00A070]/40 rounded-xl p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                                {isPdfProof ? (
                                  <FileText className="w-6 h-6 text-rose-400" />
                                ) : (
                                  <img
                                    src={proofUrl}
                                    alt="Receipt Preview"
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="overflow-hidden">
                                <div className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-[#00A070] shrink-0" />
                                  <span className="text-xs font-bold text-white truncate block">
                                    {proofFileName || "Payment Receipt"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">
                                  {proofFileSize > 0 ? `${(proofFileSize / (1024 * 1024)).toFixed(2)} MB • ` : ""}
                                  Ready for review
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={removeProof}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                                title="Remove proof"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {uploadError && (
                          <span className="text-[11px] text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{uploadError}</span>
                          </span>
                        )}
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting || isUploadingProof}
                        className="w-full py-4 mt-2 bg-gradient-to-r from-[#00A070] to-emerald-400 hover:from-[#00b880] hover:to-emerald-300 text-white font-bold rounded-xl text-base shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Submitting Deposit...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-5 h-5" />
                            <span>Submit Deposit Request</span>
                          </>
                        )}
                      </button>
                    </form>

                    {/* Bank Instructions */}
                    <div className="bg-[#1A1C24] p-4 rounded-xl text-xs text-gray-400 flex flex-col gap-2 border border-white/5 leading-relaxed">
                      <h4 className="text-white font-bold flex items-center gap-1.5 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Important Deposit Instructions:</span>
                      </h4>
                      <p>• Transfer funds to the official beneficiary account shown above using IMPS, NEFT, or RTGS.</p>
                      <p>• Uploading a clear payment screenshot or bank receipt is mandatory for verification.</p>
                      <p>• Ensure the transaction UTR / Reference number is entered accurately.</p>
                      <p>• Processing typically completes within 5 to 30 minutes following admin verification.</p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ========================================================================= */}
            {/* CRYPTO TAB */}
            {/* ========================================================================= */}
            {activeTab === "CRYPTO" && (
              <>
                {cryptoMethods.length === 0 ? (
                  <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-6 text-center">
                    <QrCode className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-white mb-1">Crypto Channels Currently Offline</h3>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto mb-4">
                      Crypto deposit channels are currently undergoing scheduled maintenance. Please check back shortly.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Network / Channel Selector */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-gray-300">Select Network / Asset</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2">
                        {cryptoMethods.map((cm) => {
                          const isSelected = currentCryptoMethod?.id === cm.id;
                          return (
                            <button
                              key={cm.id}
                              type="button"
                              onClick={() => setSelectedCryptoId(cm.id)}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? "bg-[#00A070]/10 border-[#00A070] text-white"
                                  : "bg-[#1A1C24] border-white/5 text-gray-400 hover:border-white/20"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs text-white">
                                  {cm.network || cm.name}
                                </span>
                                {isSelected && <span className="w-2 h-2 rounded-full bg-[#00A070]" />}
                              </div>
                              <span className="text-[10px] text-gray-400 block truncate">{cm.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* QR Code & Address Card */}
                    {currentCryptoMethod && (
                      <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col items-center text-center">
                        {/* QR Code display */}
                        {currentCryptoMethod.address && (
                          <div className="bg-white p-3 rounded-xl shadow-lg mb-3">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                                currentCryptoMethod.address
                              )}`}
                              alt="Deposit QR"
                              className="w-40 h-40 object-contain"
                            />
                          </div>
                        )}

                        <span className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-[#00A070]" />
                          <span>Scan QR code with your crypto wallet</span>
                        </span>

                        {/* Wallet Address Box */}
                        {currentCryptoMethod.address && (
                          <div className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                            <span className="text-[11px] text-gray-500 font-sans text-left">
                              Deposit Address ({currentCryptoMethod.network || "Crypto"}):
                            </span>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-mono text-[#00A070] font-bold break-all text-left">
                                {currentCryptoMethod.address}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentCryptoMethod.address!, "Wallet Address")}
                                className="p-2 rounded-lg bg-[#1A1C24] hover:bg-[#252834] text-gray-300 hover:text-white transition-colors shrink-0 border border-white/5"
                                title="Copy Address"
                              >
                                {copiedField === "Wallet Address" ? (
                                  <Check className="w-4 h-4 text-[#00A070]" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="w-full mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                          <span>Minimum Deposit:</span>
                          <span className="font-mono font-bold text-white">
                            {currentCryptoMethod.minAmount ?? 10} USDT
                          </span>
                        </div>

                        {currentCryptoMethod.instructions && (
                          <div className="w-full mt-2 text-[10px] text-gray-400 font-sans bg-[#121216] p-2.5 rounded-lg border border-white/5 text-left">
                            {currentCryptoMethod.instructions}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Crypto Deposit Form */}
                    <form onSubmit={handleDeposit} className="flex flex-col gap-4">
                      {/* Amount Input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex justify-between">
                          <span>Deposited Amount *</span>
                          <span className="text-gray-500 font-normal">USDT Equivalent</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            placeholder={`Min. ${currentCryptoMethod?.minAmount ?? 10}`}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 pr-16 rounded-xl outline-none text-white text-base font-mono font-bold placeholder:text-gray-600 transition-colors"
                            required
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-mono">
                            USDT
                          </span>
                        </div>
                      </div>

                      {/* TXID Input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-300">
                          Transaction Hash (TXID) *
                        </label>
                        <input
                          type="text"
                          placeholder="Paste blockchain transaction hash (TXID)"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 rounded-xl outline-none text-white text-sm font-mono placeholder:text-gray-600 transition-colors"
                          required
                        />
                      </div>

                      {/* MANDATORY PAYMENT PROOF UPLOAD FIELD */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-[#00A070]" />
                            <span>Payment Proof / Wallet Screenshot *</span>
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">Max 5MB (JPG, PNG, WEBP, PDF)</span>
                        </label>

                        {/* Upload Drop Zone / Card */}
                        {!proofUrl ? (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                              isUploadingProof
                                ? "bg-[#161822] border-[#00A070]"
                                : uploadError
                                ? "bg-rose-500/5 border-rose-500/40 hover:border-rose-500"
                                : "bg-[#1A1C24] border-white/15 hover:border-[#00A070] hover:bg-[#1E202B]"
                            }`}
                          >
                            {isUploadingProof ? (
                              <div className="flex flex-col items-center gap-2 py-2">
                                <Loader2 className="w-7 h-7 text-[#00A070] animate-spin" />
                                <span className="text-xs font-mono text-gray-300">Uploading payment proof...</span>
                              </div>
                            ) : (
                              <>
                                <div className="w-10 h-10 rounded-full bg-[#00A070]/10 flex items-center justify-center text-[#00A070]">
                                  <Upload className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-white block">
                                    Click to Upload Transfer Screenshot
                                  </span>
                                  <span className="text-[11px] text-gray-400 mt-0.5 block">
                                    Screenshot of your wallet transfer showing TXID and amount
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-[#00A070] bg-[#00A070]/10 px-2 py-0.5 rounded-full border border-[#00A070]/20">
                                  Mandatory for Verification
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          /* Proof Uploaded Preview */
                          <div className="bg-[#161822] border border-[#00A070]/40 rounded-xl p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                                {isPdfProof ? (
                                  <FileText className="w-6 h-6 text-rose-400" />
                                ) : (
                                  <img
                                    src={proofUrl}
                                    alt="Receipt Preview"
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="overflow-hidden">
                                <div className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-[#00A070] shrink-0" />
                                  <span className="text-xs font-bold text-white truncate block">
                                    {proofFileName || "Payment Screenshot"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">
                                  {proofFileSize > 0 ? `${(proofFileSize / (1024 * 1024)).toFixed(2)} MB • ` : ""}
                                  Ready for review
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={removeProof}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                                title="Remove proof"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {uploadError && (
                          <span className="text-[11px] text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{uploadError}</span>
                          </span>
                        )}
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting || isUploadingProof}
                        className="w-full py-4 mt-2 bg-gradient-to-r from-[#00A070] to-emerald-400 hover:from-[#00b880] hover:to-emerald-300 text-white font-bold rounded-xl text-base shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Submitting Deposit...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-5 h-5" />
                            <span>Confirm Crypto Deposit</span>
                          </>
                        )}
                      </button>
                    </form>

                    {/* Crypto Notes */}
                    <div className="bg-[#1A1C24] p-4 rounded-xl text-xs text-gray-400 flex flex-col gap-2 border border-white/5 leading-relaxed">
                      <h4 className="text-white font-bold flex items-center gap-1.5 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Notice:</span>
                      </h4>
                      <p>
                        • Send only the designated asset via{" "}
                        <strong className="text-white">{currentCryptoMethod?.network || "selected network"}</strong> to this address.
                      </p>
                      <p>• Uploading a clear screenshot of the confirmed transaction is mandatory.</p>
                      <p>• Balance will be credited following network confirmation and admin verification.</p>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
