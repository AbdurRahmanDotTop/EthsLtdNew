"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function P2PNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const links = [
    { name: "Marketplace", href: "/p2p", exact: true, isPublic: true },
    { name: "My Orders", href: "/p2p/orders", exact: false, isPublic: false },
    { name: "My Ads", href: "/p2p/my-ads", exact: false, isPublic: false },
    { name: "Payment Methods", href: "/p2p/payment-methods", exact: false, isPublic: false },
    { name: "Profile & Stats", href: "/p2p/profile", exact: false, isPublic: false },
  ];

  const handleProtectedClick = (e: React.MouseEvent, href: string) => {
    if (!isAuthenticated && !isLoading) {
      e.preventDefault();
      router.push(`/login?redirect=${encodeURIComponent(href)}`);
    }
  };

  return (
    <div className="border-b border-white/10 bg-[#121212]/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 flex items-center justify-between">
        <nav className="flex items-center gap-6 overflow-x-auto scrollbar-none py-1">
          {links.map((link) => {
            const isActive = link.exact 
              ? pathname === link.href 
              : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  if (!link.isPublic) {
                    handleProtectedClick(e, link.href);
                  }
                }}
                className={`py-3.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 tracking-wide uppercase ${
                  isActive
                    ? "border-[#00A070] text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/p2p/post-ad"
          onClick={(e) => handleProtectedClick(e, "/p2p/post-ad")}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#00A070] text-white hover:bg-[#00B07C] transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Post Ad
        </Link>
      </div>
    </div>
  );
}
