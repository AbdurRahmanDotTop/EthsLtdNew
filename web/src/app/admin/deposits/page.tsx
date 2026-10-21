"use client";

import { useState, useEffect } from "react";
import {
  ArrowDownCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  FileText,
  ExternalLink,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  Check,
  X,
  Building2,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { getAllDeposits, reviewDeposit } from "@/actions/admin";
import { toast } from "sonner";

export const dynamic = "force-dynamic";

interface DepositItem {
  id: string;
  userId: string;
  amount: number;
  asset: string;
  method: string;
  bankName?: string | null;
  referenceNumber: string;
  proofUrl?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | Date | null;
  createdAt: string | Date;
  user?: {
    email: string;
    uid: number;
  };
}

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [isLoading, setIsLoading] = useState(true);

  // Reject modal state
  const [rejectingDeposit, setRejectingDeposit] = useState<DepositItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Proof inspection modal state
  const [inspectingDeposit, setInspectingDeposit] = useState<DepositItem | null>(null);
  const [proofZoom, setProofZoom] = useState(1);
  const [proofRotation, setProofRotation] = useState(0);
  const [copiedRef, setCopiedRef] = useState(false);

  const loadDeposits = async () => {
    setIsLoading(true);
    try {
      const data = await getAllDeposits(100);
      setDeposits(data as DepositItem[]);
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
        if (inspectingDeposit?.id === depositId) {
          setInspectingDeposit(null);
        }
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
        if (inspectingDeposit?.id === rejectingDeposit.id) {
          setInspectingDeposit(null);
        }
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

  const openProofModal = (item: DepositItem) => {
    setInspectingDeposit(item);
    setProofZoom(1);
    setProofRotation(0);
    setCopiedRef(false);
  };

  const copyRefToClipboard = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(true);
    toast.success("Reference number copied to clipboard");
    setTimeout(() => setCopiedRef(false), 2000);
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
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ArrowDownCircle className="w-6 h-6 text-[#00A070]" />
            <span>Deposit Requests Review</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Audit bank transfer UTR references, verify submitted payment proofs, and authorize automated balance crediting.
          </p>
        </div>

        {/* Filter Pills & Refresh */}
        <div className="flex items-center gap-2">
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

          <button
            onClick={loadDeposits}
            disabled={isLoading}
            className="p-2 bg-[#161822] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
            title="Refresh deposit requests"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#00A070]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Deposits Table */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-[#00A070]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs text-gray-400 font-mono">Loading deposit records...</span>
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
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Channel</th>
                  <th className="px-4 py-3.5">Reference / UTR</th>
                  <th className="px-4 py-3.5">Payment Proof</th>
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
                        <span className="font-bold text-white block">{item.user?.email || "Unknown User"}</span>
                        <span className="text-[10px] font-mono text-[#00A070]">UID: {item.user?.uid ?? "N/A"}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 font-mono font-bold text-emerald-400 text-sm whitespace-nowrap">
                      +{item.amount.toFixed(2)} {item.asset || "USDT"}
                    </td>

                    <td className="px-4 py-4 text-gray-300">
                      <div className="flex items-center gap-1.5">
                        {item.method === "BANK" ? (
                          <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        ) : (
                          <QrCode className="w-3.5 h-3.5 text-[#00A070] shrink-0" />
                        )}
                        <span className="font-medium text-xs text-white">{item.bankName || item.method}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 font-mono text-gray-200">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-[#121212] px-2 py-1 rounded border border-white/5 text-[11px] font-bold">
                          {item.referenceNumber}
                        </span>
                        <button
                          onClick={() => copyRefToClipboard(item.referenceNumber)}
                          className="text-gray-500 hover:text-white transition-colors"
                          title="Copy Reference"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Payment Proof Column */}
                    <td className="px-4 py-4">
                      {item.proofUrl ? (
                        <button
                          onClick={() => openProofModal(item)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00A070]/10 hover:bg-[#00A070]/20 border border-[#00A070]/30 text-[#00A070] font-semibold text-[11px] transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Proof</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-500 italic">No proof</span>
                      )}
                    </td>

                    <td className="px-4 py-4 font-mono">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : item.status === "REJECTED"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-gray-400 text-[11px] font-mono whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {item.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs transition-colors shadow-sm"
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

      {/* ========================================================================= */}
      {/* MODAL: PAYMENT PROOF INSPECTION */}
      {/* ========================================================================= */}
      {inspectingDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#161822] border border-white/10 rounded-2xl shadow-2xl text-white font-sans overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#1A1C24] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00A070]/10 flex items-center justify-center text-[#00A070]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Deposit Payment Proof Inspection</h3>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {inspectingDeposit.user?.email} • UID: {inspectingDeposit.user?.uid}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectingDeposit(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Deposit Metadata Bar */}
            <div className="px-5 py-3 bg-[#121216] border-b border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono shrink-0">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-sans">Amount</span>
                <span className="text-emerald-400 font-bold text-sm">
                  +{inspectingDeposit.amount} {inspectingDeposit.asset || "USDT"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-sans">Channel</span>
                <span className="text-white font-medium">{inspectingDeposit.bankName || inspectingDeposit.method}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 block text-[10px] uppercase font-sans">UTR / Reference</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#00A070] font-bold truncate">{inspectingDeposit.referenceNumber}</span>
                  <button
                    onClick={() => copyRefToClipboard(inspectingDeposit.referenceNumber)}
                    className="text-gray-400 hover:text-white"
                  >
                    {copiedRef ? <Check className="w-3 h-3 text-[#00A070]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Proof Preview Container */}
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center min-h-[300px] bg-[#0A0B0E] relative">
              {inspectingDeposit.proofUrl ? (
                inspectingDeposit.proofUrl.toLowerCase().endsWith(".pdf") ? (
                  <div className="w-full h-full min-h-[360px] flex flex-col items-center justify-center gap-3">
                    <FileText className="w-16 h-16 text-rose-400" />
                    <span className="text-xs text-gray-300">PDF Receipt Document</span>
                    <a
                      href={inspectingDeposit.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#00A070] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open PDF in New Tab</span>
                    </a>
                  </div>
                ) : (
                  <div className="relative overflow-hidden w-full h-full flex items-center justify-center p-2">
                    <img
                      src={inspectingDeposit.proofUrl}
                      alt="Deposit Payment Proof"
                      className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-xl transition-transform duration-200"
                      style={{
                        transform: `scale(${proofZoom}) rotate(${proofRotation}deg)`,
                      }}
                    />
                  </div>
                )
              ) : (
                <div className="text-gray-500 text-xs text-center p-8">
                  No payment proof file was attached to this deposit record.
                </div>
              )}
            </div>

            {/* Proof Controls & Actions Footer */}
            <div className="p-4 bg-[#1A1C24] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              {/* Zoom & Rotate Controls */}
              {inspectingDeposit.proofUrl && !inspectingDeposit.proofUrl.toLowerCase().endsWith(".pdf") && (
                <div className="flex items-center gap-1.5 bg-[#161822] px-2 py-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setProofZoom((z) => Math.min(z + 0.25, 3))}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setProofZoom((z) => Math.max(z - 0.25, 0.75))}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setProofRotation((r) => (r + 90) % 360)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                    title="Rotate"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <a
                    href={inspectingDeposit.proofUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                    title="Download Proof"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {inspectingDeposit.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => handleApprove(inspectingDeposit.id)}
                      className="px-4 py-2 bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                    >
                      Approve & Credit
                    </button>
                    <button
                      onClick={() => setRejectingDeposit(inspectingDeposit)}
                      className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-xl transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => setInspectingDeposit(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REJECT DEPOSIT */}
      {/* ========================================================================= */}
      {rejectingDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white font-sans">
            <h3 className="text-base font-bold text-white mb-2">Reject Deposit Request</h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              Amount: {rejectingDeposit.amount} USDT | Ref: {rejectingDeposit.referenceNumber}
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Rejection Reason</label>
                <textarea
                  rows={3}
                  placeholder="e.g. UTR reference not found in bank statement, amount mismatch, or invalid payment proof."
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
