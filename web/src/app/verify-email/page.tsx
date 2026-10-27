"use client";

import { useState, useEffect, Suspense } from "react";
import { MailCheck, CheckCircle2, RotateCw, ArrowRight, Loader2, ShieldCheck, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyEmailOtp, requestEmailVerificationOtp, logoutUser } from "@/actions/auth";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#121212] text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const codeParam = searchParams.get("code") || "";

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState(codeParam.replace(/\D/g, "").slice(0, 6));
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Sync state if query parameters change
  useEffect(() => {
    if (emailParam && emailParam !== email) {
      setEmail(emailParam);
    }
    if (codeParam) {
      const cleanCode = codeParam.replace(/\D/g, "").slice(0, 6);
      if (cleanCode && cleanCode !== otp) {
        setOtp(cleanCode);
      }
    }
  }, [emailParam, codeParam]);

  // Active countdown timer for OTP resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyEmailOtp({
        code: otp.trim(),
        email: email || undefined,
      });

      if (res.success) {
        toast.success(res.message || "Email verified successfully! Welcome to ETHSLTD.");
        router.push(res.redirectUrl || "/assets");
        router.refresh();
      } else {
        toast.error(res.error || "Verification failed. Please check the code.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An unexpected error occurred during verification.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await requestEmailVerificationOtp(email || undefined, origin);
      if (res.success) {
        toast.success(res.message || "A new 6-digit verification code has been dispatched.");
        setResendCooldown(60);
      } else {
        toast.error(res.error || "Failed to resend code.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Could not resend verification code.");
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    router.push("/login");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white select-none px-4 py-8 justify-center items-center font-sans">
      <div className="w-full max-w-md bg-[#1A1C24] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Header & Logo */}
        <div className="flex flex-col items-center mb-6">
          <Link href="/" className="hover:opacity-90 transition-opacity mb-4">
            <Logo className="h-12 w-auto" />
          </Link>
          <div className="w-12 h-12 rounded-full bg-[#00A070]/10 border border-[#00A070]/20 flex items-center justify-center mb-3">
            <MailCheck className="w-6 h-6 text-[#00A070]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Verify Your Email</h1>
          <p className="text-xs text-gray-400 mt-1.5 text-center max-w-sm">
            We sent a 6-digit confirmation code to{" "}
            <span className="text-gray-200 font-semibold">{email || "your registered email"}</span>.
            Please enter it below to activate your trading account.
          </p>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300 flex justify-between">
              <span>6-Digit Verification Code</span>
              <span className="text-[10px] text-gray-500">Expires in 15 mins</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl py-3.5 px-4 text-center text-xl text-white placeholder:text-gray-600 outline-none transition-colors font-mono tracking-[0.5em] font-bold"
                required
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold rounded-xl text-sm shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Confirm & Activate Account</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Resend Cooldown Section */}
        <div className="mt-6 pt-5 border-t border-white/5 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Didn&apos;t receive the code?</span>
            {resendCooldown > 0 ? (
              <span className="text-gray-500 font-mono text-[11px]">
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-[#00A070] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isResending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCw className="w-3 h-3" />
                )}
                <span>Resend Code</span>
              </button>
            )}
          </div>

          {/* Logout / Switch Account */}
          <button
            type="button"
            onClick={handleLogout}
            className="text-[11px] text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors cursor-pointer mt-1"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign in to a different account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
