"use client";

import { useState } from "react";
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
  Mail
} from "lucide-react";
import { logoutUser } from "@/actions/auth";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { name: "Overview", href: "/admin", icon: LayoutDashboard },
    { name: "User Management", href: "/admin/users", icon: Users },
    { name: "Relationship Managers", href: "/admin/rm", icon: UserCheck },
    { name: "KYC Verification", href: "/admin/kyc", icon: FileCheck },
    { name: "Deposits Review", href: "/admin/deposits", icon: ArrowDownCircle },
    { name: "Withdrawals Review", href: "/admin/withdrawals", icon: ArrowUpCircle },
    { name: "Trading Oversight", href: "/admin/trading", icon: TrendingUp },
    { name: "Market Management", href: "/admin/markets", icon: Coins },
    { name: "Payment Methods", href: "/admin/payment-methods", icon: CreditCard },
    { name: "Email Settings", href: "/admin/email-settings", icon: Mail },
    { name: "Hero Slider", href: "/admin/hero-slider", icon: Presentation },
    { name: "Audit Logs", href: "/admin/audit-logs", icon: ShieldAlert },
  ];

  const handleLogout = async () => {
    await logoutUser();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-[#0F1015] text-white font-sans overflow-hidden select-none">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-[#161822] border-r border-white/5 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div>
          {/* Logo / Brand Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <Link href="/admin" className="flex flex-col gap-1 group">
              <Logo className="h-8 w-auto" />
              <span className="text-[9px] text-[#00A070] font-mono tracking-widest font-bold pl-0.5">ADMIN CONSOLE</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#00A070] text-white shadow-lg shadow-[#00A070]/20"
                      : "text-gray-400 hover:text-gray-200 hover:bg-[#1E202B]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <Link
            href="/assets"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-xs text-gray-300 font-medium transition-colors"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-[#00A070]" />
              <span>Go to Trader App</span>
            </div>
            <span className="text-[10px] text-gray-500">Live</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-[#161822] border-b border-white/5 flex items-center justify-between px-4 lg:px-8 z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-[#1E202B] text-gray-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#00A070] animate-pulse"></span>
              <span>Node: Production Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#1E202B] border border-white/5 px-3 py-1.5 rounded-full text-xs">
              <ShieldCheck className="w-4 h-4 text-[#00A070]" />
              <span className="font-semibold text-white">Super Admin</span>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-[#0F1015]">
          {children}
        </main>
      </div>
    </div>
  );
}
