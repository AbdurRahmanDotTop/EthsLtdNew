"use client";

import { useState, useEffect } from "react";
import { 
  FileCheck, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  Search, 
  ExternalLink,
  Eye,
  FileText,
  X,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { getAllKycApplications, reviewKyc } from "@/actions/admin";
import { toast } from "sonner";

export default function AdminKycPage() {
  const [kycs, setKycs] = useState<any[]>([]);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    title: string;
    userEmail: string;
    uid?: number;
  } | null>(null);

  // Reject modal state
  const [rejectingKyc, setRejectingKyc] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadKyc = async () => {
    try {
      const data = await getAllKycApplications();
      setKycs(data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load KYC applications");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  const handleApprove = async (kycId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to approve KYC for ${userEmail}?`)) return;
    try {
      const res = await reviewKyc(kycId, "APPROVED");
      if (res.success) {
        toast.success(`KYC approved for ${userEmail}`);
        if (previewDoc) setPreviewDoc(null);
        loadKyc();
      } else {
        toast.error(res.error || "Approval failed");
      }
    } catch (e: any) {
      toast.error(e.message || "An error occurred during approval");
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingKyc) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await reviewKyc(rejectingKyc.id, "REJECTED", rejectionReason.trim());
      if (res.success) {
        toast.success(`KYC rejected for ${rejectingKyc.user?.email}`);
        setRejectingKyc(null);
        setRejectionReason("");
        if (previewDoc) setPreviewDoc(null);
        loadKyc();
      } else {
        toast.error(res.error || "Rejection failed");
      }
    } catch (e: any) {
      toast.error(e.message || "An error occurred during rejection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredKycs = kycs.filter((k) => {
    if (filter !== "ALL" && k.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const email = k.user?.email?.toLowerCase() || "";
      const uid = String(k.user?.uid || "");
      const idNum = k.idNumber?.toLowerCase() || "";
      const addr = k.address?.toLowerCase() || "";
      return email.includes(q) || uid.includes(q) || idNum.includes(q) || addr.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#00A070]" />
            KYC Verification Review
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Review user identity proofs, documents, personal details, and approve/reject verification status.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#161822] p-1 rounded-xl border border-white/5 overflow-x-auto">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                filter === tab
                  ? "bg-[#00A070] text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab}
              <span className="ml-1.5 px-1.5 py-0.2 bg-black/40 rounded-full text-[10px] font-mono">
                {kycs.filter((k) => (tab === "ALL" ? true : k.status === tab)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by email, UID, ID Number, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#161822] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-gray-500 outline-none focus:border-[#00A070] transition-colors"
        />
      </div>

      {/* KYC Table */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex justify-center text-[#00A070]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredKycs.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-500">
            No KYC applications found matching current criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E202B] text-gray-400 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">ID Number</th>
                  <th className="px-4 py-3.5">Address</th>
                  <th className="px-4 py-3.5">Uploaded Documents</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Submitted At</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredKycs.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* User column */}
                    <td className="px-5 py-4">
                      <div>
                        <span className="font-bold text-white block">{item.user?.email}</span>
                        <span className="text-[10px] font-mono text-[#00A070]">UID: {item.user?.uid}</span>
                      </div>
                    </td>

                    {/* ID Number */}
                    <td className="px-4 py-4 font-mono font-bold text-gray-200">
                      {item.idNumber}
                    </td>

                    {/* Address */}
                    <td className="px-4 py-4 text-gray-300 max-w-[180px] truncate" title={item.address}>
                      {item.address}
                    </td>

                    {/* Uploaded Documents Column with Previews */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {item.idFrontUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                url: item.idFrontUrl,
                                title: "Front Side of ID",
                                userEmail: item.user?.email,
                                uid: item.user?.uid,
                              })
                            }
                            className="relative group w-12 h-9 rounded-md bg-[#121212] border border-white/10 overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#00A070] transition-colors"
                            title="Click to view Front ID"
                          >
                            <img
                              src={item.idFrontUrl}
                              alt="Front ID"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] font-mono text-center text-gray-300">
                              Front
                            </span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic">No Front</span>
                        )}

                        {item.idBackUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                url: item.idBackUrl,
                                title: "Back Side of ID",
                                userEmail: item.user?.email,
                                uid: item.user?.uid,
                              })
                            }
                            className="relative group w-12 h-9 rounded-md bg-[#121212] border border-white/10 overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#00A070] transition-colors"
                            title="Click to view Back ID"
                          >
                            <img
                              src={item.idBackUrl}
                              alt="Back ID"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] font-mono text-center text-gray-300">
                              Back
                            </span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic">No Back</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 font-mono">
                      <div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                            item.status === "APPROVED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : item.status === "REJECTED"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.rejectionReason && item.status === "REJECTED" && (
                          <span
                            className="block text-[10px] text-rose-400 mt-1 max-w-[150px] truncate"
                            title={item.rejectionReason}
                          >
                            {item.rejectionReason}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-gray-400 text-[11px] font-mono whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      {item.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(item.id, item.user?.email)}
                            className="px-3 py-1.5 rounded-lg bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setRejectingKyc(item);
                              setRejectionReason("");
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 font-bold text-xs transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-gray-500 text-xs">Reviewed</span>
                          {item.reviewedBy && (
                            <span className="block text-[9px] text-gray-600 font-mono">
                              by {item.reviewedBy}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Preview Lightbox Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#161822] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#1E202B]">
              <div>
                <h3 className="text-sm font-bold text-white">{previewDoc.title}</h3>
                <span className="text-xs text-gray-400 font-mono">
                  {previewDoc.userEmail} {previewDoc.uid ? `(UID: ${previewDoc.uid})` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors flex items-center gap-1 text-xs"
                  title="Open full image in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Full</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image/Document Viewer */}
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-[#10121A]">
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                className="max-w-full max-h-[65vh] object-contain rounded-lg border border-white/10 shadow-lg"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#1E202B] border-t border-white/5 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingKyc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white font-sans">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Reject KYC Application
              </h3>
              <button
                type="button"
                onClick={() => setRejectingKyc(null)}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4 font-mono">
              User: {rejectingKyc.user?.email} (UID: {rejectingKyc.user?.uid})
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-300 font-semibold">
                  Rejection Reason (Visible to user)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Identity photo is blurry, please re-upload clear front and back photos."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="bg-[#121212] border border-white/10 focus:border-rose-500 rounded-xl p-3 text-xs text-white outline-none resize-none transition-colors"
                  required
                />
              </div>

              {/* Quick Select Preset Reasons */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-mono">Quick Preset Reasons:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Photo is blurry or unreadable",
                    "Document has expired",
                    "Address does not match ID",
                    "Back side photo missing or cropped",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectionReason(preset)}
                      className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 px-2 py-1 rounded-md border border-white/5 cursor-pointer transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setRejectingKyc(null)}
                  disabled={isSubmitting}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1E202B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1 cursor-pointer transition-colors"
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
