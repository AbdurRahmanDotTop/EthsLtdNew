"use client";

import { useState, useEffect } from "react";
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
}

export default function DepositPage() {
  const router = useRouter();

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

  useEffect(() => {
    getActivePaymentMethods()
      .then((methods) => {
        if (methods && methods.length > 0) {
          const list = methods as PaymentMethod[];
          setPaymentMethods(list);
          const banks = list.filter((m) => m.type === "BANK");
          const cryptos = list.filter((m) => m.type === "CRYPTO");
          if (banks.length > 0) setSelectedBankId(banks[0].id);
          if (cryptos.length > 0) setSelectedCryptoId(cryptos[0].id);
        }
      })
      .catch((err) => console.error("Error loading payment methods:", err))
      .finally(() => setIsLoadingMethods(false));
  }, []);

  const bankMethods = paymentMethods.filter((m) => m.type === "BANK");
  const cryptoMethods = paymentMethods.filter((m) => m.type === "CRYPTO");

  const currentBankMethod = bankMethods.find((m) => m.id === selectedBankId) || bankMethods[0];
  const currentCryptoMethod = cryptoMethods.find((m) => m.id === selectedCryptoId) || cryptoMethods[0];

  // Bank details (database or official fallback)
  const bankDetails = {
    bankName: currentBankMethod?.bankName || "Axis Bank Ltd",
    accountHolder: currentBankMethod?.accountHolder || "ETHSLTD TRADING CORP",
    accountNumber: currentBankMethod?.accountNumber || "921020048192384",
    ifscCode: currentBankMethod?.ifscOrSwift || "UTIB0000004",
    branch: "Mumbai Central Branch",
    minAmount: currentBankMethod?.minAmount ?? 50,
    instructions: currentBankMethod?.instructions,
  };

  // Crypto details (database or official fallback)
  const currentCrypto = {
    network: currentCryptoMethod?.network || "TRC-20",
    name: currentCryptoMethod?.name || `USDT (${currentCryptoMethod?.network || "TRC-20"})`,
    address: currentCryptoMethod?.address || "TYDzsYUEW245Ghtr8274jhkdsh293HGsQx",
    minAmount: currentCryptoMethod?.minAmount ?? 10,
    instructions: currentCryptoMethod?.instructions,
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const minRequired = activeTab === "BANK" ? bankDetails.minAmount : currentCrypto.minAmount;

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

    setIsSubmitting(true);
    try {
      const res = await submitDeposit({
        amount: parsedAmount,
        method: activeTab,
        networkOrBank: activeTab === "BANK" ? bankDetails.bankName : `USDT-${currentCrypto.network}`,
        referenceNumber: referenceNumber.trim(),
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
        {/* Payment Rail Selector Tabs */}
        <div className="bg-[#1A1C24] p-1 rounded-xl border border-white/5 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("BANK");
              setAmount("");
              setReferenceNumber("");
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
            }}
            className={`py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === "CRYPTO"
                ? "bg-[#00A070] text-white shadow-md shadow-[#00A070]/20"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>USDT Crypto</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* BANK TRANSFER TAB */}
        {/* ========================================================================= */}
        {activeTab === "BANK" && (
          <>
            {/* Multiple Bank Selector */}
            {bankMethods.length > 1 && (
              <div className="flex flex-col gap-1.5 mb-1">
                <label className="text-xs font-semibold text-gray-300">Select Bank Account</label>
                <div className="grid grid-cols-2 gap-2">
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

            {/* Beneficiary Card */}
            <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00A070]/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#00A070]/10 flex items-center justify-center text-[#00A070]">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block">Beneficiary Account</span>
                    <span className="text-[11px] text-gray-400">Direct Bank Settlement Channel</span>
                  </div>
                </div>
                <span className="text-[10px] bg-[#00A070]/20 text-[#00A070] px-2.5 py-0.5 rounded-full font-semibold border border-[#00A070]/30">
                  Instant Verification
                </span>
              </div>

              <div className="space-y-3.5 text-xs font-mono">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400 font-sans">Bank Name:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{bankDetails.bankName}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankDetails.bankName, "Bank Name")}
                      className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                      title="Copy Bank Name"
                    >
                      {copiedField === "Bank Name" ? (
                        <Check className="w-3.5 h-3.5 text-[#00A070]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400 font-sans">Account Holder:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{bankDetails.accountHolder}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankDetails.accountHolder, "Account Holder")}
                      className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                      title="Copy Account Holder"
                    >
                      {copiedField === "Account Holder" ? (
                        <Check className="w-3.5 h-3.5 text-[#00A070]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400 font-sans">Account Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#00A070] font-bold tracking-wider text-sm">
                      {bankDetails.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankDetails.accountNumber, "Account Number")}
                      className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                      title="Copy Account Number"
                    >
                      {copiedField === "Account Number" ? (
                        <Check className="w-3.5 h-3.5 text-[#00A070]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400 font-sans">IFSC / Swift:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{bankDetails.ifscCode}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankDetails.ifscCode, "IFSC Code")}
                      className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                      title="Copy IFSC"
                    >
                      {copiedField === "IFSC Code" ? (
                        <Check className="w-3.5 h-3.5 text-[#00A070]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400 font-sans">Branch:</span>
                  <span className="text-gray-300 font-sans text-xs">{bankDetails.branch}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                <span>Minimum Deposit:</span>
                <span className="font-mono font-bold text-white">{bankDetails.minAmount} USDT</span>
              </div>
            </div>

            {/* Bank Deposit Form */}
            <form onSubmit={handleDeposit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 flex justify-between">
                  <span>Transfer Amount</span>
                  <span className="text-gray-500 font-normal">USDT Equivalent</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder={`Min. ${bankDetails.minAmount}`}
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  UTR / Bank Reference Number
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 mt-2 bg-gradient-to-r from-[#00A070] to-emerald-400 hover:from-[#00b880] hover:to-emerald-300 text-white font-bold rounded-xl text-base shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Submit Deposit Request</span>
                  </>
                )}
              </button>
            </form>

            {/* Bank Notes */}
            <div className="bg-[#1A1C24] p-4 rounded-xl text-xs text-gray-400 flex flex-col gap-2 border border-white/5 leading-relaxed">
              <h4 className="text-white font-bold flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Important Deposit Instructions:</span>
              </h4>
              <p>• Transfer funds to the official beneficiary account shown above using IMPS, NEFT, or RTGS.</p>
              <p>• Ensure the transaction UTR / Reference number is entered accurately for instant admin verification.</p>
              <p>• Processing typically completes within 5 to 30 minutes following submission.</p>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* CRYPTO TAB */}
        {/* ========================================================================= */}
        {activeTab === "CRYPTO" && (
          <>
            {/* Network Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-300">Select Network</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cryptoMethods.length > 0 ? (
                  cryptoMethods.map((cm) => {
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
                          <span className="font-bold text-xs text-white">{cm.network || "USDT"}</span>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-[#00A070]" />}
                        </div>
                        <span className="text-[10px] text-gray-400 block truncate">{cm.name}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-full text-xs text-gray-500 py-2">
                    No active crypto channels found.
                  </div>
                )}
              </div>
            </div>

            {/* QR Code & Address Card */}
            <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col items-center text-center">
              {/* QR Code display */}
              <div className="bg-white p-3 rounded-xl shadow-lg mb-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    currentCrypto.address
                  )}`}
                  alt="USDT Deposit QR"
                  className="w-40 h-40 object-contain"
                />
              </div>

              <span className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-[#00A070]" />
                <span>Scan QR code with your crypto wallet</span>
              </span>

              {/* Wallet Address Box */}
              <div className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                <span className="text-[11px] text-gray-500 font-sans text-left">
                  Deposit Address ({currentCrypto.network}):
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-[#00A070] font-bold break-all text-left">
                    {currentCrypto.address}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentCrypto.address, "Wallet Address")}
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

              <div className="w-full mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                <span>Minimum Deposit:</span>
                <span className="font-mono font-bold text-white">{currentCrypto.minAmount} USDT</span>
              </div>
            </div>

            {/* Crypto Deposit Form */}
            <form onSubmit={handleDeposit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 flex justify-between">
                  <span>Deposited Amount</span>
                  <span className="text-gray-500 font-normal">USDT</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder={`Min. ${currentCrypto.minAmount}`}
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  Transaction Hash (TXID)
                </label>
                <input
                  type="text"
                  placeholder="Paste your blockchain transaction hash"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 rounded-xl outline-none text-white text-sm font-mono placeholder:text-gray-600 transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 mt-2 bg-gradient-to-r from-[#00A070] to-emerald-400 hover:from-[#00b880] hover:to-emerald-300 text-white font-bold rounded-xl text-base shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting Request...</span>
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
                • Send only <strong className="text-white">USDT</strong> to this address. Depositing any other
                token or using an unsupported network will result in permanent loss.
              </p>
              <p>• Coins will be credited to your balance after network confirmation and admin verification.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
