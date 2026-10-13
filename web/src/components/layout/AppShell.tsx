"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/BottomNavigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

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
