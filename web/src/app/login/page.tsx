"use client";

import { useState, Suspense } from "react";
import { Eye, EyeOff, Lock, Mail, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUser } from "@/actions/auth";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#121212] text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginUser({ email, password });
      if (res.success) {
        toast.success(`Welcome back! Logged in as ${res.role}`);
        const destination =
          redirectTarget ||
          (res.role === "ADMIN" || res.role === "SUPER_ADMIN" ? "/admin" : "/assets");
        router.push(destination);
        router.refresh();
      } else {
        toast.error(res.error || "Login failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An error occurred during login.");
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
          <h1 className="text-xl font-bold tracking-tight text-white">Sign In to ETHSLTD</h1>
          <p className="text-xs text-gray-400 mt-1">Institutional-Grade Crypto Trading Platform</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
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
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-300">Password</label>
              <Link href="/forgot-password" className="text-[11px] text-[#00A070] hover:underline">
                Forgot Password?
              </Link>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
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
            <div className="flex justify-between items-center pt-0.5 text-[11px]">
              <span className="text-gray-500">Need transaction recovery?</span>
              <Link href="/forgot-pin" className="text-gray-400 hover:text-[#00A070] hover:underline transition-colors">
                Forgot Transaction PIN?
              </Link>
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
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-gray-400">
          <span>Don&apos;t have an account? </span>
          <Link
            href={
              redirectTarget
                ? `/register?redirect=${encodeURIComponent(redirectTarget)}`
                : "/register"
            }
            className="text-[#00A070] font-bold hover:underline"
          >
            Register now
          </Link>
        </div>
      </div>
    </div>
  );
}
