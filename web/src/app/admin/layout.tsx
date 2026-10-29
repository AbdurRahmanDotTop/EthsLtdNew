"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  UserCheck,
  FileCheck, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  TrendingUp, 
  CreditCard, 
  ShieldAlert, 
  LogOut, 
  ExternalLink,
  Menu,
  X,
  ShieldCheck,
  Presentation,
  Coins,
  Mail,
  ArrowLeftRight,
  Layers,
  Banknote,
  Radio,
  Globe,
  Database
} from "lucide-react";
import { logoutUser, getAuthSession } from "@/actions/auth";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    getAuthSession().then((session) => {
      if (!session) {
        router.push("/login?redirect=" + encodeURIComponent(pathname));
      } else if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
        toast.error("Access denied. Admin privileges required.");
        router.push("/assets");
      }
    });
  }, [pathname, router]);

  const navItems = [
    { name: "Overview", href: "/admin", icon: LayoutDashboard },
    { name: "P2P Marketplace", href: "/admin/p2p", icon: ArrowLeftRight },
    { name: "P2P Channel Types", href: "/admin/p2p/channels", icon: Layers },
    { name: "P2P Payment Methods", href: "/admin/p2p/payment-methods", icon: CreditCard },
    { name: "Crypto Assets", href: "/admin/assets/crypto", icon: Coins },
    { name: "Fiat Currencies", href: "/admin/assets/fiat", icon: Banknote },
    { name: "User Management", href: "/admin/users", icon: Users },
    { name: "Relationship Managers", href: "/admin/rm", icon: UserCheck },
    { name: "KYC Verification", href: "/admin/kyc", icon: FileCheck },
    { name: "Deposits Review", href: "/admin/deposits", icon: ArrowDownCircle },
    { name: "Withdrawals Review", href: "/admin/withdrawals", icon: ArrowUpCircle },
    { name: "Trading Oversight", href: "/admin/trading", icon: TrendingUp },
    { name: "Market Management", href: "/admin/markets", icon: Coins },
    { name: "Deposit Gateways", href: "/admin/payment-methods", icon: CreditCard },
    { name: "Email Settings", href: "/admin/email-settings", icon: Mail },
    { name: "Tracking & Pixels", href: "/admin/tracking", icon: Radio },
    { name: "Sitemap & SEO", href: "/admin/sitemap", icon: Globe },
    { name: "Hero Slider", href: "/admin/hero-slider", icon: Presentation },
    { name: "Backup & Restore", href: "/admin/backups", icon: Database },
    { name: "Audit Logs", href: "/admin/audit-logs", icon: ShieldAlert },
  ];


  const handleLogout = async () => {
    await logoutUser();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <div className="flex h-screen h-[100dvh] w-full bg-[#0F1015] text-white font-sans overflow-hidden select-none">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 shrink-0 h-full max-h-screen bg-[#161822] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo / Brand Header - Pinned at top */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#161822]">
          <Link href="/admin" className="flex flex-col gap-0.5 group">
            <Logo className="h-8 w-auto" />
            <span className="text-[9px] text-[#00A070] font-mono tracking-widest font-bold pl-0.5">ADMIN CONSOLE</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Links */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-3 space-y-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && item.href !== "/admin/p2p" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#00A070] text-white shadow-lg shadow-[#00A070]/20"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#1E202B]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer - Pinned at bottom */}
        <div className="shrink-0 p-3 border-t border-white/5 bg-[#141620] space-y-2 mt-auto">
          <Link
            href="/assets"
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs text-gray-300 font-medium transition-colors border border-white/5"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-[#00A070]" />
              <span>Go to Trader App</span>
            </div>
            <span className="text-[10px] text-[#00A070] font-mono font-bold bg-[#00A070]/10 px-1.5 py-0.5 rounded border border-[#00A070]/20">Live</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border border-rose-500/10 font-semibold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 shrink-0 bg-[#161822] border-b border-white/5 flex items-center justify-between px-3 sm:px-4 lg:px-8 z-10 min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-[#1E202B] text-gray-400 hover:text-white cursor-pointer shrink-0"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#00A070] animate-pulse"></span>
              <span>Node: Production Active</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#1E202B] border border-white/5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00A070] shrink-0" />
              <span className="font-semibold text-white text-[11px] sm:text-xs">Super Admin</span>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 lg:p-8 bg-[#0F1015] w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
