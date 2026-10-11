"use client";

import { useState, useEffect } from "react";
import { ArrowDownCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { getAllDeposits, reviewDeposit } from "@/actions/admin";
import { toast } from "sonner";

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [isLoading, setIsLoading] = useState(true);

  // Reject modal state
  const [rejectingDeposit, setRejectingDeposit] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDeposits = async () => {
    try {
      const data = await getAllDeposits();
      setDeposits(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load deposits");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, []);

  const handleApprove = async (depositId: string) => {
    try {
      const res = await reviewDeposit(depositId, "APPROVED");
      if (res.success) {
        toast.success("Deposit approved and funds credited to user wallet!");
        loadDeposits();
      } else {
        toast.error(res.error || "Approval failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingDeposit) return;

    setIsSubmitting(true);
    try {
      const res = await reviewDeposit(rejectingDeposit.id, "REJECTED", rejectionReason.trim());
      if (res.success) {
        toast.success("Deposit rejected.");
        setRejectingDeposit(null);
        setRejectionReason("");
        loadDeposits();
      } else {
        toast.error(res.error || "Rejection failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDeposits = deposits.filter((d) => {
    if (filter === "ALL") return true;
    return d.status === filter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Deposit Requests Review</h1>
          <p className="text-xs text-gray-400 mt-1">
            Audit bank transfer UTR references and authorize automated balance crediting.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#161822] p-1 rounded-xl border border-white/5">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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

      {/* Deposits Table */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex justify-center text-[#00A070]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-500">
            No deposit requests found in this category.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E202B] text-gray-400 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">Amount (USDT)</th>
                  <th className="px-4 py-3.5">Bank / Channel</th>
                  <th className="px-4 py-3.5">Reference / UTR</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredDeposits.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <span className="font-bold text-white block">{item.user?.email}</span>
                        <span className="text-[10px] font-mono text-[#00A070]">UID: {item.user?.uid}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 font-mono font-bold text-emerald-400 text-sm">
                      +{item.amount.toFixed(4)} USDT
                    </td>

                    <td className="px-4 py-4 text-gray-300">
                      {item.bankName || item.method}
                    </td>

                    <td className="px-4 py-4 font-mono text-gray-200">
                      <span className="bg-[#121212] px-2 py-1 rounded border border-white/5">
                        {item.referenceNumber}
                      </span>
                    </td>

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
                    </td>

                    <td className="px-4 py-4 text-gray-400 text-[11px] font-mono">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {item.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs transition-colors"
                          >
                            Approve & Credit
                          </button>
                          <button
                            onClick={() => setRejectingDeposit(item)}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 font-bold text-xs transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectingDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white font-sans">
            <h3 className="text-base font-bold text-white mb-2">
              Reject Deposit Request
            </h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              Amount: {rejectingDeposit.amount} USDT | Ref: {rejectingDeposit.referenceNumber}
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Rejection Reason</label>
                <textarea
                  rows={3}
                  placeholder="e.g. UTR reference not found in bank statement, amount mismatch."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="bg-[#121212] border border-white/10 focus:border-rose-500 rounded-xl p-3 text-xs text-white outline-none resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingDeposit(null)}
                  disabled={isSubmitting}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1E202B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
