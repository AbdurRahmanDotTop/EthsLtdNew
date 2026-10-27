"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, Activity, Shield, Wallet, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNavigation() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Trade", href: "/trade", icon: LineChart },
    { name: "Option", href: "/options", icon: Activity },
    { name: "P2P", href: "/p2p", icon: ArrowLeftRight },
    { name: "Trust", href: "/trust", icon: Shield },
    { name: "Assets", href: "/assets", icon: Wallet },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/5 bg-[#121212] px-1 sm:px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(`${item.href}/`));
        
        return (
          <Link
            key={item.name}
            href={item.href}
            prefetch={false}
            className={cn(
              "flex flex-1 max-w-[64px] flex-col items-center justify-center gap-1 p-1 text-[10px] font-medium transition-colors",
              isActive ? "text-[#00A070]" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
