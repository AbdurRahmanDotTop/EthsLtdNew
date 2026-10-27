"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  MinusCircle,
  User,
  Edit,
  KeyRound,
  UserCheck,
  X,
  Star,
  Loader2,
  PlusCircle,
  DollarSign,
} from "lucide-react";
import {
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  adjustUserBalance,
  getUserDetailsAdmin,
  updateUserProfileAdmin,
  adminAssignRmToUser,
  adminRemoveRmFromUser,
  adminResetUserPin,
  getAllRmsAdmin,
  type UserStatus,
  type UserRole,
  type UpdateUserProfileAdminInput,
} from "@/actions/admin";
import { toast } from "sonner";

interface WalletRecord {
  id: string;
  asset: string;
  type: string;
  balance: number;
}

interface UserListItem {
  id: string;
  uid: number;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  isKycVerified: boolean;
  phone?: string | null;
  wallets: WalletRecord[];
  createdAt: Date | string;
  _count?: {
    orders: number;
    transactions: number;
  };
}

interface RmOption {
  id: string;
  name: string | null;
  email: string;
  status: string;
  rmCode?: string;
  activeClientsCount?: number;
}

interface RmClientConnectionItem {
  id: string;
  rmId: string;
  status: string;
  requestedAt: Date | string;
  rm?: {
    id: string;
    uid: number;
    name: string | null;
    email: string;
    rmProfile?: {
      rmCode: string;
      designation?: string | null;
    } | null;
  } | null;
}

interface RmReviewItem {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: Date | string;
  rm?: {
    id: string;
    uid: number;
    name: string | null;
    email: string;
  } | null;
}

interface UserProfileDetails extends UserListItem {
  rmClientConnections?: RmClientConnectionItem[];
  rmReviewsGiven?: RmReviewItem[];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Balance Adjustment Modal State
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [adjustAsset, setAdjustAsset] = useState("USDT");
  const [adjustType, setAdjustType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Available RMs for assignment
  const [availableRms, setAvailableRms] = useState<RmOption[]>([]);

  // User Profile Modal State
  const [profileModalUser, setProfileModalUser] = useState<UserListItem | null>(null);
  const [fullUserDetails, setFullUserDetails] = useState<UserProfileDetails | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<UpdateUserProfileAdminInput>({
    name: "",
    phone: "",
    status: "ACTIVE",
    role: "USER",
    isKycVerified: false,
  });
  const [selectedRmId, setSelectedRmId] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAssigningRm, setIsAssigningRm] = useState(false);
  const [isRemovingRm, setIsRemovingRm] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const [usersData, rmsData] = await Promise.all([
        getAllUsers(),
        getAllRmsAdmin(),
      ]);
      setUsers(usersData as unknown as UserListItem[]);
      setAvailableRms(rmsData.filter((r) => r.status === "ACTIVE") as unknown as RmOption[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [usersData, rmsData] = await Promise.all([
          getAllUsers(),
          getAllRmsAdmin(),
        ]);
        if (!ignore) {
          setUsers(usersData as unknown as UserListItem[]);
          setAvailableRms(rmsData.filter((r) => r.status === "ACTIVE") as unknown as RmOption[]);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg || "Failed to load users");
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    void init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleStatusChange = async (
    userId: string,
    newStatus: UserStatus
  ) => {
    try {
      const res = await updateUserStatus(userId, newStatus);
      if (res.success) {
        toast.success(`User status updated to ${newStatus}`);
        loadUsers();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const res = await updateUserRole(userId, newRole);
      if (res.success) {
        toast.success(`User role updated to ${newRole}`);
        loadUsers();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Adjustment reason is required for audit logs.");
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const res = await adjustUserBalance({
        userId: selectedUser.id,
        asset: adjustAsset,
        amount,
        type: adjustType,
        reason: adjustReason.trim(),
      });

      if (res.success) {
        toast.success(`Successfully adjusted balance! New ${adjustAsset} balance: ${res.newBalance}`);
        setSelectedUser(null);
        setAdjustAmount("");
        setAdjustReason("");
        loadUsers();
      } else {
        toast.error(res.error || "Adjustment failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      toast.error(msg);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const handleOpenProfileModal = async (user: UserListItem) => {
    setProfileModalUser(user);
    setIsLoadingProfile(true);
    setProfileForm({
      name: user.name || "",
      phone: user.phone || "",
      status: user.status || "ACTIVE",
      role: user.role || "USER",
      isKycVerified: Boolean(user.isKycVerified),
    });

    try {
      const res = await getUserDetailsAdmin(user.id);
      if (res.success && res.user) {
        const userDetails = res.user as UserProfileDetails;
        setFullUserDetails(userDetails);
        const activeConn = userDetails.rmClientConnections?.find(
          (c: RmClientConnectionItem) => c.status === "ACTIVE" || c.status === "ACCEPTED" || c.status === "REQUESTED"
        );
        setSelectedRmId(activeConn ? activeConn.rmId : "");
      } else {
        setFullUserDetails(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to load user profile details.");
      setFullUserDetails(null);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSaveProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileModalUser) return;

    setIsSavingProfile(true);
    try {
      const res = await updateUserProfileAdmin(profileModalUser.id, profileForm);
      if (res.success) {
        toast.success(res.message || "User profile updated successfully!");
        loadUsers();
        // Refresh detail view
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to update profile.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAssignRm = async () => {
    if (!profileModalUser || !selectedRmId) {
      toast.error("Please select a Relationship Manager from the dropdown.");
      return;
    }

    setIsAssigningRm(true);
    try {
      const res = await adminAssignRmToUser(profileModalUser.id, selectedRmId);
      if (res.success) {
        toast.success(res.message);
        loadUsers();
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to assign RM.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to assign RM.";
      toast.error(msg);
    } finally {
      setIsAssigningRm(false);
    }
  };

  const handleRemoveRm = async () => {
    if (!profileModalUser) return;
    if (!confirm("Are you sure you want to remove the assigned Relationship Manager from this client?")) return;

    setIsRemovingRm(true);
    try {
      const res = await adminRemoveRmFromUser(profileModalUser.id);
      if (res.success) {
        toast.success(res.message);
        setSelectedRmId("");
        loadUsers();
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to remove RM assignment.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove RM assignment.";
      toast.error(msg);
    } finally {
      setIsRemovingRm(false);
    }
  };

  const handleResetPin = async () => {
    if (!profileModalUser) return;
    if (!confirm(`Reset transaction PIN for ${profileModalUser.name || profileModalUser.email} to default (123456)?`)) return;

    setIsResettingPin(true);
    try {
      const res = await adminResetUserPin(profileModalUser.id);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.error || "Failed to reset PIN.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset PIN.";
      toast.error(msg);
    } finally {
      setIsResettingPin(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.uid.toString().includes(q) || (u.name && u.name.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-xs text-gray-400 mt-1">
            View accounts, KYC status, wallet balances, and perform authorized adjustments.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search email, UID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] pl-10 pr-4 py-2.5 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex justify-center text-[#00A070]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-500">
            No users found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E202B] text-gray-400 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-5 py-3.5">UID / User</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">KYC</th>
                  <th className="px-4 py-3.5">USDT Balance</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {filteredUsers.map((user) => {
                  const usdtWallet = user.wallets.find((w: WalletRecord) => w.asset === "USDT" && w.type === "Currency");
                  const balance = usdtWallet ? usdtWallet.balance : 0.0;

                  return (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#00A070]/20 text-[#00A070] flex items-center justify-center font-bold text-xs font-mono">
                            {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{user.email}</span>
                              <span className="text-[10px] font-mono text-[#00A070] bg-[#00A070]/10 px-1.5 py-0.2 rounded">
                                UID: {user.uid}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400">{user.name || "No name set"}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 font-mono">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                          className="bg-[#1E202B] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white outline-none cursor-pointer"
                        >
                          <option value="USER">USER</option>
                          <option value="RM">RM (Relationship Manager)</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      </td>

                      <td className="px-4 py-4 font-mono">
                        <select
                          value={user.status}
                          onChange={(e) => handleStatusChange(user.id, e.target.value as UserStatus)}
                          className={`border rounded-lg px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer ${
                            user.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : user.status === "PENDING_VERIFICATION"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              : user.status === "FLAGGED_SPAM"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold"
                              : user.status === "FROZEN"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          <option value="ACTIVE" className="bg-[#161822] text-white">ACTIVE</option>
                          <option value="PENDING_VERIFICATION" className="bg-[#161822] text-white">PENDING_VERIFICATION</option>
                          <option value="FLAGGED_SPAM" className="bg-[#161822] text-white">FLAGGED_SPAM</option>
                          <option value="FROZEN" className="bg-[#161822] text-white">FROZEN</option>
                          <option value="BANNED" className="bg-[#161822] text-white">BANNED</option>
                        </select>
                      </td>

                      <td className="px-4 py-4">
                        {user.isKycVerified ? (
                          <span className="flex items-center gap-1 text-[#00A070] font-semibold text-xs">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500 text-xs">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Unverified</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 font-mono font-bold text-white text-sm">
                        {balance.toFixed(4)} USDT
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenProfileModal(user)}
                            className="px-3 py-1.5 rounded-lg bg-[#00A070]/15 hover:bg-[#00A070]/25 text-[#00A070] border border-[#00A070]/30 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Manage Profile</span>
                          </button>
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="px-3 py-1.5 rounded-lg bg-[#222530] hover:bg-[#2A2D38] border border-white/10 text-white font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Adjust Balance
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Balance Adjustment Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white font-sans">
            <h3 className="text-base font-bold text-white mb-1">
              Adjust User Balance
            </h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              User: {selectedUser.email} (UID: {selectedUser.uid})
            </p>

            <form onSubmit={handleAdjustBalance} className="space-y-4">
              {/* Action: Credit or Debit */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType("CREDIT")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    adjustType === "CREDIT"
                      ? "bg-[#00A070] text-white shadow-lg shadow-[#00A070]/20"
                      : "bg-[#1E202B] text-gray-400"
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Credit (Add Funds)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType("DEBIT")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    adjustType === "DEBIT"
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                      : "bg-[#1E202B] text-gray-400"
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>Debit (Deduct)</span>
                </button>
              </div>

              {/* Asset Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Target Asset</label>
                <select
                  value={adjustAsset}
                  onChange={(e) => setAdjustAsset(e.target.value)}
                  className="bg-[#121212] border border-white/10 rounded-xl p-3 text-xs font-mono font-bold text-white outline-none cursor-pointer"
                >
                  <option value="USDT">USDT (Tether)</option>
                  <option value="BTC">BTC (Bitcoin)</option>
                  <option value="ETH">ETH (Ethereum)</option>
                </select>
              </div>

              {/* Amount Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Adjustment Amount</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl p-3 text-sm font-mono font-bold text-white outline-none"
                  required
                />
              </div>

              {/* Mandatory Reason */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Reason / Reference (Mandatory for Audit Trail)</label>
                <input
                  type="text"
                  placeholder="e.g. Approved bank transfer, manual bonus, correction"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl p-3 text-xs text-white outline-none"
                  required
                />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  disabled={isSubmittingAdjust}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1E202B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-[#00A070] hover:bg-[#00b880] flex items-center justify-center gap-1"
                >
                  {isSubmittingAdjust ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Profile & Account Control Modal */}
      {profileModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00A070]/20 text-[#00A070] flex items-center justify-center font-bold text-sm">
                  {profileModalUser.name ? profileModalUser.name.charAt(0).toUpperCase() : profileModalUser.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{profileModalUser.name || "User Profile"}</span>
                    <span className="text-[11px] font-mono font-bold text-[#00A070] bg-[#00A070]/10 px-2 py-0.5 rounded">
                      UID: #{profileModalUser.uid}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">{profileModalUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setProfileModalUser(null);
                  setFullUserDetails(null);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 text-xs">
              {isLoadingProfile ? (
                <div className="py-16 text-center text-[#00A070] flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs text-gray-400">Loading user profile and connected records...</span>
                </div>
              ) : (
                <>
                  {/* 1. Editable Profile Form */}
                  <form onSubmit={handleSaveProfileSubmit} className="space-y-4 p-4 bg-[#10121A] rounded-xl border border-white/5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#00A070]" />
                        <span>Core Profile & Permissions</span>
                      </h4>
                      <span className="text-[10px] text-gray-500">UID: #{profileModalUser.uid}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-300 font-semibold mb-1">Full Name</label>
                        <input
                          type="text"
                          value={profileForm.name || ""}
                          onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Client name"
                          className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 font-semibold mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={profileForm.phone || ""}
                          onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="+1234567890"
                          className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-gray-300 font-semibold mb-1">Account Status</label>
                        <select
                          value={profileForm.status || "ACTIVE"}
                          onChange={(e) => setProfileForm((prev) => ({ ...prev, status: e.target.value as UserStatus }))}
                          className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                          <option value="FLAGGED_SPAM">FLAGGED_SPAM</option>
                          <option value="FROZEN">FROZEN</option>
                          <option value="BANNED">BANNED</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-gray-300 font-semibold mb-1">Account Role</label>
                        <select
                          value={profileForm.role || "USER"}
                          onChange={(e) => setProfileForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                          className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                        >
                          <option value="USER">USER</option>
                          <option value="RM">RM (Relationship Manager)</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-gray-300 font-semibold mb-1">KYC Verification</label>
                        <select
                          value={profileForm.isKycVerified ? "VERIFIED" : "UNVERIFIED"}
                          onChange={(e) => setProfileForm((prev) => ({ ...prev, isKycVerified: e.target.value === "VERIFIED" }))}
                          className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                        >
                          <option value="VERIFIED">Verified</option>
                          <option value="UNVERIFIED">Unverified</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="px-4 py-2 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#00A070]/20 transition-all cursor-pointer"
                      >
                        {isSavingProfile ? "Saving Profile..." : "Save Profile Details"}
                      </button>
                    </div>
                  </form>

                  {/* 2. Relationship Manager (RM) Assignment */}
                  <div className="space-y-3 p-4 bg-[#10121A] rounded-xl border border-white/5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#00A070]" />
                        <span>Assigned Relationship Manager</span>
                      </h4>
                    </div>

                    {/* Current Assigned RM Status */}
                    {fullUserDetails?.rmClientConnections?.some((c: RmClientConnectionItem) => c.status === "ACTIVE" || c.status === "ACCEPTED" || c.status === "REQUESTED") ? (
                      (() => {
                        const conn = fullUserDetails.rmClientConnections?.find((c: RmClientConnectionItem) => c.status === "ACTIVE" || c.status === "ACCEPTED" || c.status === "REQUESTED");
                        if (!conn) return null;
                        return (
                          <div className="flex items-center justify-between p-3 bg-[#161822] border border-[#00A070]/30 rounded-xl">
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                <span>{conn.rm?.name || conn.rm?.email}</span>
                                <span className="text-[10px] text-[#00A070] font-mono font-bold bg-[#00A070]/10 px-2 py-0.5 rounded">
                                  {conn.rm?.rmProfile?.rmCode}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                Status: <span className="text-[#00A070] font-semibold">{conn.status}</span> • Connected: {new Date(conn.requestedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveRm}
                              disabled={isRemovingRm}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              {isRemovingRm ? "Removing..." : "Remove RM"}
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="p-3 bg-[#161822] border border-white/5 rounded-xl text-gray-400 text-xs">
                        No Relationship Manager is currently assigned to this user.
                      </div>
                    )}

                    {/* Assign / Change Dropdown */}
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={selectedRmId}
                        onChange={(e) => setSelectedRmId(e.target.value)}
                        className="flex-1 bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
                      >
                        <option value="">-- Select Active Relationship Manager --</option>
                        {availableRms.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            {rm.name} ({rm.rmCode}) • {rm.activeClientsCount} Clients
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAssignRm}
                        disabled={isAssigningRm || !selectedRmId}
                        className="px-4 py-2 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-[#00A070]/20 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {isAssigningRm ? "Assigning..." : "Assign Manager"}
                      </button>
                    </div>
                  </div>

                  {/* 3. Financial Asset Balances */}
                  <div className="space-y-3 p-4 bg-[#10121A] rounded-xl border border-white/5">
                    <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-white/5 pb-2">
                      <DollarSign className="w-3.5 h-3.5 text-[#00A070]" />
                      <span>Wallet Balances</span>
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {["USDT", "BTC", "ETH", "ACH"].map((asset) => {
                        const wallet = fullUserDetails?.wallets?.find((w: WalletRecord) => w.asset === asset && w.type === "Currency");
                        const bal = wallet ? wallet.balance : 0;
                        return (
                          <div key={asset} className="p-3 bg-[#161822] border border-white/5 rounded-xl">
                            <div className="text-[10px] text-gray-500 font-mono">{asset}</div>
                            <div className="text-sm font-bold text-white font-mono mt-0.5">
                              {bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Security & Reset Tools */}
                  <div className="space-y-3 p-4 bg-[#10121A] rounded-xl border border-white/5">
                    <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-white/5 pb-2">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Security & Authentication Controls</span>
                    </h4>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-[#161822] rounded-xl border border-white/5">
                      <div>
                        <div className="font-bold text-white">Transaction PIN Management</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Reset the user&apos;s secondary transfer PIN to the system default (<span className="font-mono text-[#00A070]">123456</span>) if locked or forgotten.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetPin}
                        disabled={isResettingPin}
                        className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {isResettingPin ? "Resetting..." : "Reset PIN to 123456"}
                      </button>
                    </div>
                  </div>

                  {/* 5. Reviews Submitted by this User */}
                  {fullUserDetails?.rmReviewsGiven && fullUserDetails.rmReviewsGiven.length > 0 && (
                    <div className="space-y-3 p-4 bg-[#10121A] rounded-xl border border-white/5">
                      <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-white/5 pb-2">
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <span>RM Reviews Given ({fullUserDetails.rmReviewsGiven.length})</span>
                      </h4>

                      <div className="space-y-2">
                        {fullUserDetails.rmReviewsGiven.map((rev: RmReviewItem) => (
                          <div key={rev.id} className="p-3 bg-[#161822] border border-white/5 rounded-xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">Manager: {rev.rm?.name}</span>
                              <div className="flex items-center gap-1 text-amber-400 font-bold">
                                <Star className="w-3 h-3 fill-amber-400" />
                                <span>{rev.rating}.0 / 5</span>
                              </div>
                            </div>
                            {rev.comment && <p className="text-gray-300 italic">&ldquo;{rev.comment}&rdquo;</p>}
                            <div className="text-[10px] text-gray-500 text-right">
                              {new Date(rev.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-white/10 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setProfileModalUser(null);
                  setFullUserDetails(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
