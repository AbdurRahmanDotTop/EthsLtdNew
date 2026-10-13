"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  User, 
  ChevronDown, 
  LogOut, 
  Shield, 
  Settings, 
  Wallet, 
  Menu, 
  X, 
  CheckCircle2, 
  Clock, 
  CreditCard,
  Lock,
  ExternalLink,
  UserCheck,
  ShieldCheck
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { getAuthSession, logoutUser } from "@/actions/auth";
import { toast } from "sonner";

export function Header() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const sessionUser = await getAuthSession();
        setUser(sessionUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
      setDropdownOpen(false);
      setMobileMenuOpen(false);
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Logout failed");
    }
  };

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Trade", href: "/trade" },
    { name: "Option", href: "/options" },
    { name: "P2P", href: "/p2p" },
    { name: "Advisory", href: "/relationship-managers" },
    { name: "Assets", href: "/assets" },
    { name: "Trust", href: "/trust" },
  ];

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isRM = user?.role === "RM";

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-[#121212]/95 backdrop-blur-md border-b border-white/5 transition-all">
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-90">
            <Logo className="h-9 sm:h-10 w-auto" priority />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "text-[#00A070] bg-[#00A070]/10"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Identity / Profile Section */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              {/* Profile Avatar Button */}
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 py-1.5 px-2.5 rounded-full bg-[#1A1C24] border border-white/10 hover:border-[#00A070]/50 transition-all select-none"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-7 h-7 rounded-full bg-[#00A070]/20 text-[#00A070] font-bold text-xs flex items-center justify-center font-mono border border-[#00A070]/30 overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"
                  )}
                </div>
                <span className="hidden sm:inline-block text-xs font-semibold text-white max-w-[110px] truncate">
                  {user.name || user.email.split("@")[0]}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#161822] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 divide-y divide-white/5 animate-in fade-in zoom-in-95 duration-100">
                  {/* Account Summary Header */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white truncate max-w-[140px]">{user.name || "Trader Account"}</span>
                      {user.isKycVerified ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00A070]/15 text-[#00A070] border border-[#00A070]/30">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Clock className="w-2.5 h-2.5" /> Pending KYC
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">{user.email}</div>
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">UID: {user.uid}</div>
                  </div>

                  {/* Profile Menu Links */}
                  <div className="py-1 text-xs">
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      <span>Account Overview</span>
                    </Link>

                    <Link
                      href="/profile#edit"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      <span>Edit Profile & Avatar</span>
                    </Link>

                    <Link
                      href="/security/password"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Lock className="w-4 h-4 text-gray-400" />
                      <span>Security & Password PIN</span>
                    </Link>

                    <Link
                      href="/security/bank-card"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span>Linked Bank Accounts</span>
                    </Link>

                    <Link
                      href="/security/crypto-wallet"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Wallet className="w-4 h-4 text-cyan-400" />
                      <span>Crypto Wallets</span>
                    </Link>

                    <Link
                      href="/profile/kyc"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Shield className="w-4 h-4 text-[#00A070]" />
                      <span>Identity Verification (KYC)</span>
                    </Link>

                    <Link
                      href="/assets"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Wallet className="w-4 h-4 text-blue-400" />
                      <span>My Wallets & Balances</span>
                    </Link>

                    <Link
                      href="/relationship-managers"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <UserCheck className="w-4 h-4 text-teal-400" />
                      <span>Relationship Managers</span>
                    </Link>

                    {isRM && (
                      <Link
                        href="/rm/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center justify-between px-4 py-2.5 text-[#00A070] hover:bg-[#00A070]/10 transition-colors font-semibold"
                      >
                        <div className="flex items-center gap-2.5">
                          <ShieldCheck className="w-4 h-4 text-[#00A070]" />
                          <span>RM Dashboard</span>
                        </div>
                        <span className="text-[10px] font-mono bg-[#00A070]/20 px-1.5 py-0.5 rounded text-[#00A070]">RM</span>
                      </Link>
                    )}

                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center justify-between px-4 py-2.5 text-amber-400 hover:bg-amber-500/10 transition-colors font-semibold"
                      >
                        <div className="flex items-center gap-2.5">
                          <Shield className="w-4 h-4 text-amber-400" />
                          <span>Admin Console</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                  {/* Sign Out Button */}
                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Unauthenticated Visitor */
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#00A070] text-white hover:bg-[#008f64] shadow-md shadow-[#00A070]/20 transition-all"
              >
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#161822] px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
          {user && (
            <div className="p-3 bg-[#10121A] rounded-xl border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#00A070]/20 text-[#00A070] font-bold text-xs flex items-center justify-center font-mono">
                  {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{user.name || user.email.split("@")[0]}</div>
                  <div className="text-[10px] text-gray-400 font-mono">UID: {user.uid}</div>
                </div>
              </div>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-semibold text-[#00A070] hover:underline"
              >
                Profile &rarr;
              </Link>
            </div>
          )}

          <nav className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`p-2.5 rounded-xl text-xs font-semibold transition-colors text-center ${
                  pathname === link.href ? "bg-[#00A070] text-white" : "bg-[#1E202B] text-gray-300"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {user ? (
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <Link
                href="/security/password"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Security Settings
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 bg-[#1E202B] text-gray-300 rounded-xl text-xs font-semibold"
              >
                Log In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 bg-[#00A070] text-white rounded-xl text-xs font-semibold"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
