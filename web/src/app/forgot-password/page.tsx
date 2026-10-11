"use client";

import { useState } from "react";
import { Mail, ArrowRight, Loader2, KeyRound, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPasswordReset } from "@/actions/auth";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your registered email address.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestPasswordReset({
        email,
        appOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
      });

      if (res.success) {
        setSentSuccess(true);
        toast.success("Recovery code dispatched!");
      } else {
        toast.error(res.error || "Unable to send recovery instructions.");
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
          <h1 className="text-xl font-bold tracking-tight text-white">Reset Password</h1>
          <p className="text-xs text-gray-400 mt-1 text-center">
            Enter your registered email to receive a single-use verification code and reset link.
          </p>
        </div>

        {sentSuccess ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
              <KeyRound className="w-8 h-8 text-[#00A070] mx-auto mb-2" />
              <h2 className="text-sm font-semibold text-white">Check Your Inbox</h2>
              <p className="text-xs text-gray-300 mt-1">
                If an account exists for <span className="font-mono text-white">{email}</span>, a 6-digit verification code and reset link have been dispatched. The code expires in 15 minutes.
              </p>
            </div>

            <button
              onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
              className="w-full py-3.5 bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold rounded-xl text-sm shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <span>Enter 6-Digit Code &amp; Reset</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center">
              <button
                onClick={() => setSentSuccess(false)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Didn&apos;t get it? Try again or change email
              </button>
            </div>
          </div>
        ) : (
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold rounded-xl text-sm shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Send Recovery Instructions</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Navigation */}
        <div className="mt-6 flex items-center justify-between text-xs text-gray-400 border-t border-white/5 pt-4">
          <Link href="/login" className="flex items-center gap-1 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
          <Link href="/forgot-pin" className="text-[#00A070] hover:underline">
            Forgot PIN?
          </Link>
        </div>
      </div>
    </div>
  );
}
