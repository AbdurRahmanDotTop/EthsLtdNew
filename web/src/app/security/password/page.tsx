"use client";

import { useState } from "react";
import { ChevronLeft, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateFundPassword } from "@/actions/user";
import { toast } from "sonner";

export default function ModifyPasswordPage() {
  const router = useRouter();
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.length < 4) {
      toast.error("Transaction PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateFundPassword(newPin);
      if (res.success) {
        toast.success("Fund password / PIN updated successfully!");
        router.push("/assets");
      } else {
        toast.error(res.error || "Failed to update PIN.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-20 font-sans select-none">
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
        <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <span className="font-bold text-lg absolute left-1/2 -translate-x-1/2">Fund Password</span>
      </header>

      <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto w-full">
        <div className="bg-[#FFF8E6] text-amber-900 p-4 rounded-xl text-xs font-medium border border-amber-300">
          Set or modify your withdrawal transaction PIN. This fund password is required whenever you request a withdrawal.
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">New Transaction PIN</label>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                maxLength={6}
                placeholder="Enter 4 to 6 digit PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 rounded-xl outline-none text-sm text-white pr-12 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Confirm Transaction PIN</label>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                maxLength={6}
                placeholder="Confirm 4 to 6 digit PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 rounded-xl outline-none text-sm text-white pr-12 font-mono"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 mt-3 bg-gradient-to-r from-[#00A070] to-emerald-400 hover:from-[#00b880] hover:to-emerald-300 text-white font-bold rounded-xl text-base shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Transaction PIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
