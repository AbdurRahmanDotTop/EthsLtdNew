"use client";

import { useState, Suspense } from "react";
import { Eye, EyeOff, Lock, Mail, User, KeyRound, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { registerUser } from "@/actions/auth";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#121212] text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [transactionPin, setTransactionPin] = useState("123456");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerUser({
        name,
        email,
        password,
        transactionPin,
      });

      if (res.success) {
        toast.success("Account registered successfully! Welcome to ETHSLTD.");
        const destination = redirectTarget || res.redirectUrl || "/assets";
        router.push(destination);
        router.refresh();
      } else {
        toast.error(res.error || "Registration failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An error occurred during registration.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white select-none px-4 py-8 justify-center items-center">
      <div className="w-full max-w-md bg-[#1A1C24] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-6">
          <Link href="/" className="hover:opacity-90 transition-opacity mb-3">
            <Logo className="h-12 w-auto" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-white">Create an Account</h1>
          <p className="text-xs text-gray-400 mt-1">Start Trading with Institutional Precision</p>
        </div>

        {/* Register Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Full Name (Optional)</label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Email Address</label>
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
            <label className="text-xs font-medium text-gray-300">Password</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 outline-none transition-colors font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Confirm Password</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 outline-none transition-colors font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                className="absolute right-3.5 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-300">Security Transaction PIN</label>
              <span className="text-[10px] text-gray-500">Default: 123456</span>
            </div>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type={showPin ? "text" : "password"}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="6-digit PIN"
                value={transactionPin}
                onChange={(e) => setTransactionPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 outline-none transition-colors font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                aria-label={showPin ? "Hide transaction PIN" : "Show transaction PIN"}
                className="absolute right-3.5 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-gray-400">
          <span>Already have an account? </span>
          <Link
            href={
              redirectTarget
                ? `/login?redirect=${encodeURIComponent(redirectTarget)}`
                : "/login"
            }
            className="text-[#00A070] font-bold hover:underline"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
