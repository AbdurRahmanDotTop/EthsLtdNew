"use client";

import { useState, useEffect } from "react";
import { 
  ArrowUpCircle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Building2, 
  Wallet, 
  ShieldCheck, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Search, 
  ExternalLink, 
  FileText, 
  X, 
  AlertTriangle 
} from "lucide-react";
import { getAllWithdrawals, reviewWithdrawal } from "@/actions/admin";
import { toast } from "sonner";

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Unmasked accounts set
  const [unmaskedIds, setUnmaskedIds] = useState<Set<string>>(new Set());

  // Copied item indicator
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Inspect Modal state
  const [inspectingItem, setInspectingItem] = useState<any | null>(null);

  // Approve Modal state
  const [approvingItem, setApprovingItem] = useState<any | null>(null);
  const [txHash, setTxHash] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectAdminNotes, setRejectAdminNotes] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const loadWithdrawals = async () => {
    try {
      const data = await getAllWithdrawals();
      setWithdrawals(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load withdrawals");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedText(null), 2000);
  };

  const toggleMask = (id: string) => {
    setUnmaskedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingItem) return;

    setIsApproving(true);
    try {
      const res = await reviewWithdrawal(approvingItem.id, "APPROVED", {
        txHash: txHash.trim() || undefined,
        adminNotes: adminNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success("Withdrawal approved and marked as dispatched!");
        setApprovingItem(null);
        setTxHash("");
        setAdminNotes("");
        loadWithdrawals();
      } else {
        toast.error(res.error || "Approval failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;

    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason for the user.");
      return;
    }

    setIsRejecting(true);
    try {
      const res = await reviewWithdrawal(rejectingItem.id, "REJECTED", {
        rejectionReason: rejectionReason.trim(),
        adminNotes: rejectAdminNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success("Withdrawal rejected. Frozen funds refunded to user.");
        setRejectingItem(null);
        setRejectionReason("");
        setRejectAdminNotes("");
        loadWithdrawals();
      } else {
        toast.error(res.error || "Rejection failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsRejecting(false);
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (filter !== "ALL" && w.status !== filter) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const emailMatch = w.user?.email?.toLowerCase().includes(query);
    const uidMatch = w.user?.uid?.toString().includes(query);
    const bankMatch = w.bankName?.toLowerCase().includes(query);
    const accMatch = w.accountNumber?.toLowerCase().includes(query);
    const addrMatch = w.walletAddress?.toLowerCase().includes(query);
    const methodMatch = w.method?.toLowerCase().includes(query);

    return emailMatch || uidMatch || bankMatch || accMatch || addrMatch || methodMatch;
  });

  const parseSnapshot = (snapshotStr?: string | null) => {
    if (!snapshotStr) return null;
    try {
      return JSON.parse(snapshotStr);
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Withdrawal Requests Oversight</h1>
          <p className="text-xs text-gray-400 mt-1">
            Audit beneficiary snapshots, review KYC status, and authorize or refund frozen user withdrawals.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#161822] p-1 rounded-xl border border-white/5">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === tab
                  ? "bg-[#00A070] text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter by Email, UID, Bank, Account, or Address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#161822] border border-white/5 focus:border-[#00A070] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none"
        />
      </div>

      {/* Withdrawals Table */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex justify-center text-[#00A070]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-500">
            No withdrawal requests found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E202B] text-gray-400 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-5 py-3.5">User & KYC</th>
                  <th className="px-4 py-3.5">Method</th>
                  <th className="px-4 py-3.5">Gross / Net Amount</th>
                  <th className="px-4 py-3.5">Destination Details</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredWithdrawals.map((item) => {
                  const isUnmasked = unmaskedIds.has(item.id);
                  const isCrypto = item.method === "CRYPTO";
                  const snapshot = parseSnapshot(item.methodSnapshot);

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* User & KYC */}
                      <td className="px-5 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white block">{item.user?.email}</span>
                            {item.user?.isKycVerified ? (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                <ShieldCheck className="w-3 h-3" />
                                KYC OK
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                <ShieldAlert className="w-3 h-3" />
                                NO KYC
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-[#00A070]">UID: #{item.user?.uid}</span>
                            {item.user?.name && (
                              <span className="text-[10px] text-gray-400">({item.user.name})</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Method */}
                      <td className="px-4 py-4">
                        {isCrypto ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 w-fit">
                            <Wallet className="w-3 h-3 text-purple-400" />
                            CRYPTO ({item.network || "TRC20"})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 w-fit">
                            <Building2 className="w-3 h-3 text-blue-400" />
                            BANK ({item.country || "IN"})
                          </span>
                        )}
                      </td>

                      {/* Gross / Net Amount */}
                      <td className="px-4 py-4 font-mono">
                        <div className="font-bold text-white">
                          {item.amount.toFixed(4)} {item.asset}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-medium">
                          Net: {item.receiveAmount.toFixed(4)} {item.asset}
                        </div>
                      </td>

                      {/* Destination Details */}
                      <td className="px-4 py-4 text-gray-300 font-mono text-xs">
                        {isCrypto ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-sans font-semibold">
                                {item.walletLabel || `${item.network} Address`}:
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-gray-300">
                                {item.walletAddress ? `${item.walletAddress.slice(0, 8)}...${item.walletAddress.slice(-6)}` : "N/A"}
                              </span>
                              {item.walletAddress && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.walletAddress)}
                                  className="text-gray-400 hover:text-white"
                                  title="Copy Address"
                                >
                                  {copiedText === item.walletAddress ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                            {item.memo && (
                              <span className="text-[10px] text-gray-400 block mt-0.5">
                                Memo: {item.memo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-white font-sans font-semibold">{item.bankName || "Bank Account"}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span>
                                {isUnmasked
                                  ? item.accountNumber || "N/A"
                                  : item.accountNumber && item.accountNumber.length > 4
                                  ? `•••• •••• ${item.accountNumber.slice(-4)}`
                                  : item.accountNumber || "N/A"}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleMask(item.id)}
                                className="text-gray-400 hover:text-white"
                                title={isUnmasked ? "Mask Account" : "Unmask Account"}
                              >
                                {isUnmasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <div className="text-[10px] text-gray-400 font-sans">
                              {item.accountHolder || item.fullName}
                              {item.ifscCode && ` • ${item.ifscCode}`}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 font-mono">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : item.status === "REJECTED"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}>
                          {item.status}
                        </span>
                        {item.txHash && (
                          <span className="block text-[9px] text-gray-400 font-mono mt-1 truncate max-w-[120px]" title={item.txHash}>
                            Tx: {item.txHash}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 text-gray-400 text-[11px] font-mono">
                        <div>{new Date(item.createdAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-gray-500">{new Date(item.createdAt).toLocaleTimeString()}</div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setInspectingItem(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            title="Inspect Details & Frozen Snapshot"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {item.status === "PENDING" && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setApprovingItem(item);
                                  setTxHash("");
                                  setAdminNotes("");
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingItem(item);
                                  setRejectionReason("");
                                  setRejectAdminNotes("");
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 font-bold text-xs transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
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

      {/* ================= INSPECT MODAL ================= */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in overflow-y-auto py-10">
          <div className="w-full max-w-lg bg-[#161822] border border-white/10 rounded-3xl p-6 shadow-2xl text-white font-sans my-auto">
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#00A070]" />
                  Withdrawal Application Details
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">ID: {inspectingItem.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs font-mono">
              {/* User Identity Snapshot */}
              <div className="bg-[#10121A] p-4 rounded-2xl border border-white/5 space-y-2">
                <span className="text-gray-400 font-sans font-bold text-xs block mb-1">User Information</span>
                <div className="flex justify-between">
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white font-bold">{inspectingItem.user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">UID:</span>
                  <span className="text-[#00A070] font-bold">#{inspectingItem.user?.uid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">KYC Verification:</span>
                  <span className={inspectingItem.user?.isKycVerified ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {inspectingItem.user?.isKycVerified ? "VERIFIED (Approved)" : "UNVERIFIED"}
                  </span>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="bg-[#10121A] p-4 rounded-2xl border border-white/5 space-y-2">
                <span className="text-gray-400 font-sans font-bold text-xs block mb-1">Financial Breakdown</span>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gross Amount:</span>
                  <span className="text-white font-bold">{inspectingItem.amount.toFixed(4)} {inspectingItem.asset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Handling Fee:</span>
                  <span className="text-gray-400 font-bold">{inspectingItem.fee.toFixed(4)} {inspectingItem.asset}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2">
                  <span className="text-emerald-400 font-bold">Net Payout:</span>
                  <span className="text-emerald-400 font-bold text-sm">{inspectingItem.receiveAmount.toFixed(4)} {inspectingItem.asset}</span>
                </div>
              </div>

              {/* Immutable Frozen Snapshot */}
              <div className="bg-[#10121A] p-4 rounded-2xl border border-white/5 space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400 font-sans font-bold text-xs">Frozen Beneficiary Snapshot</span>
                  <span className="text-[10px] bg-[#00A070]/20 text-[#00A070] px-2 py-0.5 rounded font-bold">
                    IMMUTABLE
                  </span>
                </div>
                {inspectingItem.method === "CRYPTO" ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Method:</span>
                      <span className="text-purple-400 font-bold">CRYPTO</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Network:</span>
                      <span className="text-white">{inspectingItem.network}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-1">Wallet Address:</span>
                      <span className="text-white bg-black/40 p-2 rounded-lg block break-all text-[11px]">
                        {inspectingItem.walletAddress}
                      </span>
                    </div>
                    {inspectingItem.memo && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Memo / Tag:</span>
                        <span className="text-white">{inspectingItem.memo}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Method:</span>
                      <span className="text-blue-400 font-bold">BANK TRANSFER</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Bank Name:</span>
                      <span className="text-white">{inspectingItem.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Account Holder:</span>
                      <span className="text-white">{inspectingItem.accountHolder || inspectingItem.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Account Number:</span>
                      <span className="text-white font-bold">{inspectingItem.accountNumber}</span>
                    </div>
                    {inspectingItem.ifscCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">IFSC / SWIFT:</span>
                        <span className="text-white">{inspectingItem.ifscCode}</span>
                      </div>
                    )}
                    {inspectingItem.branchName && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Branch:</span>
                        <span className="text-white">{inspectingItem.branchName}</span>
                      </div>
                    )}
                    {inspectingItem.country && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Country:</span>
                        <span className="text-white">{inspectingItem.country}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Status & Audit */}
              <div className="bg-[#10121A] p-4 rounded-2xl border border-white/5 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="font-bold text-white">{inspectingItem.status}</span>
                </div>
                {inspectingItem.reviewedBy && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reviewed By:</span>
                    <span className="text-white">{inspectingItem.reviewedBy}</span>
                  </div>
                )}
                {inspectingItem.reviewedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reviewed Date:</span>
                    <span className="text-white">{new Date(inspectingItem.reviewedAt).toLocaleString()}</span>
                  </div>
                )}
                {inspectingItem.txHash && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tx Hash / Ref:</span>
                    <span className="text-emerald-400 break-all">{inspectingItem.txHash}</span>
                  </div>
                )}
                {inspectingItem.rejectionReason && (
                  <div className="pt-1 text-rose-400">
                    <span className="font-bold block">Rejection Reason:</span>
                    <p className="text-gray-300 font-sans mt-0.5">{inspectingItem.rejectionReason}</p>
                  </div>
                )}
                {inspectingItem.adminNotes && (
                  <div className="pt-1 text-gray-400">
                    <span className="font-bold block">Internal Admin Notes:</span>
                    <p className="text-gray-300 font-sans mt-0.5">{inspectingItem.adminNotes}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInspectingItem(null)}
              className="w-full py-3 bg-[#1E202B] hover:bg-white/10 text-white font-semibold text-xs rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= APPROVE & DISPATCH MODAL ================= */}
      {approvingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-3xl p-6 shadow-2xl text-white font-sans">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Authorize & Confirm Withdrawal
            </h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              User: {approvingItem.user?.email} | Net Payout: <strong className="text-white">{approvingItem.receiveAmount} {approvingItem.asset}</strong>
            </p>

            <form onSubmit={handleConfirmApprove} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Transaction Hash / Reference Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TRC20 TxID or Bank Transfer UTR"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Internal Processing Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dispatched via hot wallet batch 14."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl p-3 text-xs text-white outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovingItem(null)}
                  disabled={isApproving}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1E202B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApproving}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-[#00A070] hover:bg-[#00b880] flex items-center justify-center gap-1 shadow-lg shadow-[#00A070]/20"
                >
                  {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= REJECT & REFUND MODAL ================= */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-3xl p-6 shadow-2xl text-white font-sans">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-500" />
              Reject Withdrawal & Refund
            </h3>
            <p className="text-xs text-gray-400 mb-3 font-mono">
              User: {rejectingItem.user?.email} | Amount: {rejectingItem.amount} USDT
            </p>

            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-amber-400 text-xs mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Rejecting this application will automatically refund <strong>{rejectingItem.amount} USDT</strong> back to the user&apos;s available trading wallet balance.
              </span>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Rejection Reason (Displayed to User) <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Beneficiary name mismatch with KYC records. Please verify account holder name."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-rose-500 rounded-xl p-3 text-xs text-white outline-none resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Internal Administrative Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Suspicious repeated withdrawal attempt."
                  value={rejectAdminNotes}
                  onChange={(e) => setRejectAdminNotes(e.target.value)}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  disabled={isRejecting}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1E202B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1"
                >
                  {isRejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
