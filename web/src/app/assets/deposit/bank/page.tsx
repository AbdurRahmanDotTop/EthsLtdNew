"use client";

import { useState } from "react";
import { ChevronLeft, Loader2, Copy, Check, Building2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitBankDeposit } from "@/actions/user";
import { toast } from "sonner";

export default function DepositBankPage() {
  const router = useRouter();
  const [amount, setAmount] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const bankDetails = {
    bankName: "Axis Bank Ltd",
    accountHolder: "ETHSLTD TRADING CORP",
    accountNumber: "921020048192384",
    ifscCode: "UTIB0000004",
    branch: "Mumbai Central Branch",
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
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid transfer amount.");
      return;
    }

    if (!referenceNumber.trim()) {
      toast.error("Please enter your Bank Transfer / UTR reference number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitBankDeposit({
        amount: parsedAmount,
        bankName: bankDetails.bankName,
        referenceNumber: referenceNumber.trim(),
      });

      if (res.success) {
        toast.success("Deposit request submitted successfully! Pending admin approval.");
        router.push("/assets/records?tab=deposit");
      } else {
        toast.error(res.error || "Failed to submit deposit.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
        <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <span className="font-bold text-lg absolute left-1/2 -translate-x-1/2">Deposit Bank</span>
      </header>

      <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto w-full">
        {/* Bank Details Card */}
        <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
            <Building2 className="w-5 h-5 text-[#00A070]" />
            <span className="font-bold text-sm text-white">Beneficiary Account Details</span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-sans">Bank Name:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">{bankDetails.bankName}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(bankDetails.bankName, "Bank Name")}
                  className="text-gray-400 hover:text-white"
                >
                  {copiedField === "Bank Name" ? <Check className="w-3.5 h-3.5 text-[#00A070]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-sans">Account Name:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">{bankDetails.accountHolder}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(bankDetails.accountHolder, "Account Name")}
                  className="text-gray-400 hover:text-white"
                >
                  {copiedField === "Account Name" ? <Check className="w-3.5 h-3.5 text-[#00A070]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-sans">Account Number:</span>
              <div className="flex items-center gap-2">
                <span className="text-[#00A070] font-bold tracking-wider">{bankDetails.accountNumber}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(bankDetails.accountNumber, "Account Number")}
                  className="text-gray-400 hover:text-white"
                >
                  {copiedField === "Account Number" ? <Check className="w-3.5 h-3.5 text-[#00A070]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-sans">IFSC / Swift:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">{bankDetails.ifscCode}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(bankDetails.ifscCode, "IFSC Code")}
                  className="text-gray-400 hover:text-white"
                >
                  {copiedField === "IFSC Code" ? <Check className="w-3.5 h-3.5 text-[#00A070]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleDeposit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-300">Transfer Amount (USDT equivalent)</label>
            <input
              type="number"
              step="any"
              placeholder="Please enter the bank transfer amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 rounded-xl outline-none text-white text-base font-mono font-bold placeholder:text-gray-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-300">UTR / Transaction Reference Number</label>
            <input
              type="text"
              placeholder="e.g. UTR1234567890 or Bank Ref"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 rounded-xl outline-none text-white text-sm font-mono placeholder:text-gray-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 mt-2 bg-gradient-to-r from-[#00A070] to-emerald-400 hover:from-[#00b880] hover:to-emerald-300 text-white font-bold rounded-xl text-base shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Deposit Request"}
          </button>
        </form>

        {/* Notes matching Screenshot 3 */}
        <div className="bg-[#1A1C24] p-4 rounded-xl text-xs text-gray-500 flex flex-col gap-2 border border-white/5 leading-relaxed">
          <h4 className="text-gray-400 font-bold mb-1">Notes:</h4>
          <p>• Be sure to confirm whether the beneficiary account information is entered accurately in your bank transfer.</p>
          <p>• After transfer, input the exact transaction UTR / Reference number and click &quot;Submit Deposit Request&quot; for rapid verification.</p>
          <p>• Typical processing time is 5 to 30 minutes following admin verification.</p>
        </div>
      </div>
    </div>
  );
}
