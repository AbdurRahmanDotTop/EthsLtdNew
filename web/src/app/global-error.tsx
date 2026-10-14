"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Layout Error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-[#1A1C24] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold mb-2 text-white">Application Notice</h1>
          <p className="text-sm text-gray-400 mb-6">
            A temporary connection issue occurred. Please retry to resume normal operation.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => reset()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#00A070] text-white text-xs font-semibold hover:bg-[#008f64] transition-all cursor-pointer shadow-md"
            >
              Retry
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#252836] text-gray-200 text-xs font-semibold hover:bg-[#2e3244] transition-all cursor-pointer border border-white/5"
            >
              Reload Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
