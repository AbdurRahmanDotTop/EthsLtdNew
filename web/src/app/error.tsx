"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home, ArrowLeft } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors safely
    console.error("Client Error Boundary caught error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-[#121212] text-white">
      <div className="max-w-md w-full bg-[#1A1C24] border border-white/10 rounded-2xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold tracking-tight mb-2 text-white">
          Something went wrong
        </h2>

        <p className="text-xs sm:text-sm text-gray-400 mb-6 leading-relaxed">
          The page encountered an unexpected issue while loading data. Your account and funds remain secure.
        </p>

        {error?.message && process.env.NODE_ENV !== "production" && (
          <div className="mb-6 p-3 rounded-lg bg-black/40 border border-white/5 text-left text-xs font-mono text-rose-300 overflow-x-auto max-h-32">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-semibold shadow-lg shadow-[#00A070]/20 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#252836] hover:bg-[#2e3244] text-gray-200 text-xs font-semibold border border-white/5 transition-all active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>Go to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
