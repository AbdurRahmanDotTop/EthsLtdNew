"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  Shield, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  Loader2, 
  MoreVertical,
  PlusCircle,
  MinusCircle,
  AlertTriangle
} from "lucide-react";
import { getAllUsers, updateUserStatus, updateUserRole, adjustUserBalance } from "@/actions/admin";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Balance Adjustment Modal State
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [adjustAsset, setAdjustAsset] = useState("USDT");
  const [adjustType, setAdjustType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleStatusChange = async (userId: string, newStatus: "ACTIVE" | "FROZEN" | "BANNED") => {
    try {
      const res = await updateUserStatus(userId, newStatus);
      if (res.success) {
        toast.success(`User status updated to ${newStatus}`);
        loadUsers();
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "USER" | "ADMIN" | "SUPER_ADMIN" | "RM") => {
    try {
      const res = await updateUserRole(userId, newRole);
      if (res.success) {
        toast.success(`User role updated to ${newRole}`);
        loadUsers();
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmittingAdjust(false);
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
                  const usdtWallet = user.wallets.find((w: any) => w.asset === "USDT" && w.type === "Currency");
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
                          onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
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
                          onChange={(e) => handleStatusChange(user.id, e.target.value as any)}
                          className={`border rounded-lg px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer ${
                            user.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : user.status === "FROZEN"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          <option value="ACTIVE" className="bg-[#161822] text-white">ACTIVE</option>
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
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="px-3 py-1.5 rounded-lg bg-[#222530] hover:bg-[#2A2D38] border border-white/10 text-white font-semibold text-xs transition-colors"
                        >
                          Adjust Balance
                        </button>
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
    </div>
  );
}
