"use client";

import { useState, Suspense } from "react";
import { Eye, EyeOff, KeyRound, Mail, ArrowRight, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPinWithToken } from "@/actions/auth";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";

export default function ResetPinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#121212] text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
        </div>
      }
    >
      <ResetPinForm />
    </Suspense>
  );
}

function ResetPinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryEmail = searchParams.get("email") || "";
  const queryToken = searchParams.get("token") || "";

  const [email, setEmail] = useState(queryEmail);
  const [tokenOrCode, setTokenOrCode] = useState(queryToken);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !tokenOrCode || !newPin) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (newPin !== confirmPin) {
      toast.error("PIN entries do not match.");
      return;
    }

    const cleanPin = newPin.replace(/\D/g, "");
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      toast.error("PIN must be between 4 and 6 digits.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPinWithToken({
        email,
        tokenOrCode,
        newPin: cleanPin,
        confirmPin,
      });

      if (res.success) {
        toast.success(res.message || "Security Transaction PIN updated successfully!");
        router.push("/login");
      } else {
        toast.error(res.error || "Failed to reset Transaction PIN.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white select-none px-4 py-8 justify-center items-center font-sans">
      <div className="w-full max-w-md bg-[#1A1C24] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-6">
          <Link href="/" className="hover:opacity-90 transition-opacity mb-3">
            <Logo className="h-12 w-auto" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-white">Set New Transaction PIN</h1>
          <p className="text-xs text-gray-400 mt-1 text-center">
            Enter your recovery code and configure your 4 to 6-digit withdrawal PIN.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Registered Email Address</label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">6-Digit Code or Recovery Token</label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. 583920 or token"
                value={tokenOrCode}
                onChange={(e) => setTokenOrCode(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 outline-none transition-colors font-mono tracking-wider"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">New Transaction PIN</label>
            <div className="relative flex items-center">
              <ShieldCheck className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type={showPin ? "text" : "password"}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="4 to 6 digit numeric PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 outline-none transition-colors font-mono tracking-wider"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
                className="absolute right-3.5 text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Confirm New Transaction PIN</label>
            <div className="relative flex items-center">
              <ShieldCheck className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type={showConfirmPin ? "text" : "password"}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Re-enter 4 to 6 digit PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 outline-none transition-colors font-mono tracking-wider"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                aria-label={showConfirmPin ? "Hide confirm PIN" : "Show confirm PIN"}
                className="absolute right-3.5 text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold rounded-xl text-sm shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Save Transaction PIN</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-6 flex items-center justify-between text-xs text-gray-400 border-t border-white/5 pt-4">
          <Link href="/login" className="flex items-center gap-1 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
          <Link href="/forgot-pin" className="text-[#00A070] hover:underline">
            Request New PIN Code
          </Link>
        </div>
      </div>
    </div>
  );
}
