"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/BottomNavigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  // Global resilient deployment recovery
  useEffect(() => {
    // 1. Intercept unhandled promise rejections from stale client chunks / actions
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event?.reason?.message || event?.reason || "");
      if (
        msg.includes("Failed to find Server Action") ||
        msg.includes("older or newer deployment") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch RSC payload")
      ) {
        const lastReload = sessionStorage.getItem("__ethsltd_global_deploy_reload");
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
          sessionStorage.setItem("__ethsltd_global_deploy_reload", String(now));
          window.location.reload();
        }
      }
    };

    // 2. Intercept fetch responses for stale RSC requests that return 500/503
    const originalFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input?.url || "";
      const isRsc = url.includes("_rsc") || (init?.headers && (init.headers as any)["RSC"] === "1");

      const response = await originalFetch.apply(this, [input, init]);

      if (isRsc && (response.status === 500 || response.status === 503)) {
        const lastReload = sessionStorage.getItem("__ethsltd_deploy_reload");
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem("__ethsltd_deploy_reload", String(now));
          try {
            const parsed = new URL(url, window.location.origin);
            parsed.searchParams.delete("_rsc");
            window.location.href = parsed.pathname + parsed.search;
          } catch {
            window.location.reload();
          }
        }
      }

      return response;
    };

    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.fetch = originalFetch;
    };
  }, []);

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col pb-[calc(64px+env(safe-area-inset-bottom))]">
      <Header />
      <main className="flex-1 w-full max-w-screen-xl mx-auto pb-16">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
