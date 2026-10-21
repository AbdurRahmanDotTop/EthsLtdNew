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

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
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
