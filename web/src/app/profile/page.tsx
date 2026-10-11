"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  CreditCard, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  LogOut, 
  Save, 
  RefreshCw, 
  FileCheck,
  KeyRound,
  ExternalLink,
  ChevronRight,
  Shield
} from "lucide-react";
import { getUserProfile, updateUserProfile } from "@/actions/user";
import { changeUserPassword, logoutUser } from "@/actions/auth";
import { toast } from "sonner";

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
];

export default function UserProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Edit Profile State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await getUserProfile();
      if (!data) {
        toast.error("Please log in to view your profile");
        router.push("/login?redirect=/profile");
        return;
      }
      setUser(data);
      setName(data.name || "");
      setPhone(data.phone || "");
      setAvatarUrl(data.avatarUrl || "");
    } catch {
      toast.error("Failed to load user profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await updateUserProfile({
        name,
        phone,
        avatarUrl,
      });

      if (res.success) {
        toast.success("Profile updated successfully!");
        setUser((prev: any) => ({ ...prev, name, phone, avatarUrl }));
      } else {
        toast.error(res.error || "Failed to update profile");
      }
    } catch {
      toast.error("An error occurred while saving profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await changeUserPassword({
        currentPassword,
        newPassword,
      });

      if (res.success) {
        toast.success("Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.error || "Failed to update password");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-gray-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[#00A070]" />
        <span className="text-sm font-medium">Loading profile data...</span>
      </div>
    );
  }

  if (!user) return null;

  const usdtWallet = user.wallets?.find((w: any) => w.asset === "USDT" && w.type === "Currency");
  const totalBalance = usdtWallet?.balance || 0;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  return (
    <div className="space-y-8 py-6 px-4 max-w-5xl mx-auto">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-[#00A070]" />
            User Account & Profile
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage your personal credentials, verification status, security preferences, and financial accounts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-[#161822] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-5">
          {/* Avatar with fallback */}
          <div className="w-20 h-20 rounded-2xl bg-[#1E202B] border-2 border-[#00A070]/40 flex items-center justify-center overflow-hidden shrink-0 shadow-lg relative group">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user.name || "Avatar"} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-extrabold text-[#00A070] font-mono">
                {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white">{user.name || "Trader Account"}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00A070]/15 text-[#00A070] border border-[#00A070]/30">
                {user.role}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                {user.status}
              </span>
            </div>

            <p className="text-xs text-gray-400 font-mono mt-1">{user.email}</p>
            <div className="flex items-center gap-4 text-[11px] text-gray-500 font-mono mt-2">
              <span>UID: <strong className="text-white">{user.uid}</strong></span>
              <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Verification Status Pill */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <Link
            href="/profile/kyc"
            className={`flex items-center justify-between sm:justify-start gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              user.isKycVerified
                ? "bg-[#00A070]/10 border-[#00A070]/30 text-[#00A070] hover:bg-[#00A070]/20"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
            }`}
          >
            <div className="flex items-center gap-2">
              {user.isKycVerified ? (
                <CheckCircle2 className="w-4 h-4 text-[#00A070]" />
              ) : (
                <Clock className="w-4 h-4 text-amber-400" />
              )}
              <span>{user.isKycVerified ? "Identity Verified (KYC Passed)" : "KYC Verification Required"}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>
      </div>

      {/* Grid of Sections: Edit Profile & Security Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Profile Info Form & Wallet Shortcuts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Profile Information */}
          <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 shadow-md" id="edit">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <User className="w-4 h-4 text-[#00A070]" />
                Personal Details & Display Profile
              </h3>
              <span className="text-[10px] text-gray-400">Public within platform</span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Full Name or Trader Handle"
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Contact Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
                />
              </div>

              {/* Avatar Preset Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Select Profile Avatar Preset
                </label>
                <div className="flex items-center gap-3">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setAvatarUrl(preset)}
                      className={`w-11 h-11 rounded-xl overflow-hidden border-2 transition-all ${
                        avatarUrl === preset
                          ? "border-[#00A070] scale-105 shadow-md shadow-[#00A070]/30"
                          : "border-white/10 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className={`px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all ${
                      !avatarUrl ? "border-[#00A070] text-[#00A070] bg-[#00A070]/10" : "border-white/10 text-gray-400"
                    }`}
                  >
                    Use Initials
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Custom Avatar Image URL
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/my-photo.jpg"
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#00A070] text-white rounded-xl text-xs font-bold hover:bg-[#008f64] transition-colors disabled:opacity-50 shadow-md shadow-[#00A070]/20"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingProfile ? "Saving Changes..." : "Save Profile Details"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Wallet Summary & Financial Account Card */}
          <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-400" />
                Asset Holdings & Wallet Summary
              </h3>
              <Link href="/assets" className="text-xs text-[#00A070] hover:underline flex items-center gap-1 font-semibold">
                Manage Assets <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#10121A] rounded-xl border border-white/5">
                <span className="text-[11px] text-gray-400">Available USDT</span>
                <div className="text-lg font-bold font-mono text-white mt-1">
                  ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-gray-500">Spot Currency Account</span>
              </div>

              <div className="p-4 bg-[#10121A] rounded-xl border border-white/5">
                <span className="text-[11px] text-gray-400">Linked Bank Card</span>
                <div className="text-sm font-bold text-white mt-1 truncate">
                  {user.bankCards?.[0]?.bankName || "None Linked"}
                </div>
                <span className="text-[10px] text-gray-500 font-mono">
                  {user.bankCards?.[0]?.iban ? `IBAN: ••••${user.bankCards[0].iban.slice(-4)}` : "Required for withdraw"}
                </span>
              </div>

              <div className="p-4 bg-[#10121A] rounded-xl border border-white/5">
                <span className="text-[11px] text-gray-400">Fund Password PIN</span>
                <div className="text-sm font-bold text-white mt-1">
                  {user.transactionPin ? "Configured ✓" : "Not Set"}
                </div>
                <span className="text-[10px] text-gray-500">Protects withdrawals</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2">
              <Link
                href="/assets/deposit"
                className="px-3 py-1.5 bg-[#1E202B] hover:bg-[#252836] text-gray-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Deposit Funds
              </Link>
              <Link
                href="/assets/withdraw"
                className="px-3 py-1.5 bg-[#1E202B] hover:bg-[#252836] text-gray-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Withdraw Funds
              </Link>
              <Link
                href="/assets/records"
                className="px-3 py-1.5 bg-[#1E202B] hover:bg-[#252836] text-gray-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Financial Records
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Security & Password Form */}
        <div className="space-y-6">
          {/* Change Password Form */}
          <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                Change Password
              </h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <button
                type="submit"
                disabled={updatingPassword}
                className="w-full py-2.5 bg-[#1E202B] hover:bg-[#252836] text-white border border-white/10 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 mt-2"
              >
                {updatingPassword ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          </div>

          {/* Quick Security Links */}
          <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 space-y-3 shadow-md">
            <h4 className="text-xs font-bold text-gray-300 uppercase font-mono tracking-wider mb-2">
              Security Shortcuts
            </h4>

            <Link
              href="/security/password"
              className="flex items-center justify-between p-3 rounded-xl bg-[#10121A] hover:bg-[#1E202B] border border-white/5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Transaction PIN / Fund PIN</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            </Link>

            <Link
              href="/security/bank-card"
              className="flex items-center justify-between p-3 rounded-xl bg-[#10121A] hover:bg-[#1E202B] border border-white/5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Manage Bank Accounts</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            </Link>

            <Link
              href="/security/crypto-wallet"
              className="flex items-center justify-between p-3 rounded-xl bg-[#10121A] hover:bg-[#1E202B] border border-white/5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span>Manage Crypto Wallets</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            </Link>

            <Link
              href="/profile/kyc"
              className="flex items-center justify-between p-3 rounded-xl bg-[#10121A] hover:bg-[#1E202B] border border-white/5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-4 h-4 text-[#00A070]" />
                <span>KYC Identity Verification</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
