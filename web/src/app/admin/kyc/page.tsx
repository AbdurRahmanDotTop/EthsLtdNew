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
  ShieldAlert,
  AlertTriangle,
  Calendar,
  MapPin,
  User,
  CreditCard,
  Building,
  CheckSquare,
  Square,
  HelpCircle,
  RefreshCw,
  History,
  Download,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { getAllKycApplications, reviewKyc, getKycAuditHistory } from "@/actions/admin";
import { toast } from "sonner";
import KycDocumentViewer from "@/components/kyc/KycDocumentViewer";

interface VerificationChecklistState {
  isLegible: boolean;
  nameMatches: boolean;
  idMatches: boolean;
  isValidNonExpired: boolean;
  photoClear: boolean;
}

export default function AdminKycPage() {
  const [kycs, setKycs] = useState<any[]>([]);
  const [filter, setFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "ADDITIONAL_INFO_REQUIRED"
  >("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Active KYC being inspected in the verification modal
  const [selectedKyc, setSelectedKyc] = useState<any | null>(null);
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");
  const [mobileTab, setMobileTab] = useState<"document" | "details">("document");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);

  // Mandatory verification checklist for approval
  const [checklist, setChecklist] = useState<VerificationChecklistState>({
    isLegible: false,
    nameMatches: false,
    idMatches: false,
    isValidNonExpired: false,
    photoClear: false,
  });

  // Action Dialog States
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "REQUEST_INFO" | null>(null);
  const [actionReason, setActionReason] = useState("");
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

  // Open review modal
  const handleOpenReview = async (kyc: any) => {
    setSelectedKyc(kyc);
    setActiveSide("front");
    setMobileTab("document");
    setActionType(null);
    setActionReason("");

    // Parse stored checklist if any
    let initialChecklist: VerificationChecklistState = {
      isLegible: false,
      nameMatches: false,
      idMatches: false,
      isValidNonExpired: false,
      photoClear: false,
    };

    if (kyc.adminChecklist) {
      try {
        const stored = JSON.parse(kyc.adminChecklist);
        if (Array.isArray(stored)) {
          initialChecklist = {
            isLegible: stored.includes("LEGIBLE"),
            nameMatches: stored.includes("NAME_MATCH"),
            idMatches: stored.includes("ID_MATCH"),
            isValidNonExpired: stored.includes("VALID_DATE"),
            photoClear: stored.includes("PHOTO_CLEAR"),
          };
        }
      } catch (err) {
        // ignore parse error
      }
    } else if (kyc.status === "APPROVED") {
      initialChecklist = {
        isLegible: true,
        nameMatches: true,
        idMatches: true,
        isValidNonExpired: true,
        photoClear: true,
      };
    }

    setChecklist(initialChecklist);

    // Fetch audit history
    setLoadingAudits(true);
    try {
      const logs = await getKycAuditHistory(kyc.id);
      setAuditLogs(logs || []);
    } catch (e) {
      console.warn("Failed to load KYC audits:", e);
      setAuditLogs([]);
    } finally {
      setLoadingAudits(false);
    }
  };

  const handleToggleCheck = (key: keyof VerificationChecklistState) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecksSatisfied =
    checklist.isLegible &&
    checklist.nameMatches &&
    checklist.idMatches &&
    checklist.isValidNonExpired &&
    checklist.photoClear;

  // Execute decision
  const handleExecuteDecision = async () => {
    if (!selectedKyc || !actionType) return;

    if (actionType === "REJECT" && !actionReason.trim()) {
      toast.error("Please enter a mandatory rejection reason.");
      return;
    }

    if (actionType === "REQUEST_INFO" && !actionReason.trim()) {
      toast.error("Please specify what additional document or information the user must provide.");
      return;
    }

    if (actionType === "APPROVE" && !allChecksSatisfied) {
      toast.error("Please complete all verification checklist items before approving.");
      return;
    }

    const decision =
      actionType === "APPROVE"
        ? "APPROVED"
        : actionType === "REJECT"
        ? "REJECTED"
        : "ADDITIONAL_INFO_REQUIRED";

    const passedChecks: string[] = [];
    if (checklist.isLegible) passedChecks.push("LEGIBLE");
    if (checklist.nameMatches) passedChecks.push("NAME_MATCH");
    if (checklist.idMatches) passedChecks.push("ID_MATCH");
    if (checklist.isValidNonExpired) passedChecks.push("VALID_DATE");
    if (checklist.photoClear) passedChecks.push("PHOTO_CLEAR");

    setIsSubmitting(true);
    try {
      const res = await reviewKyc(
        selectedKyc.id,
        decision,
        actionReason.trim() || undefined,
        passedChecks
      );

      if (res.success) {
        toast.success(
          decision === "APPROVED"
            ? `KYC approved for ${selectedKyc.user?.email}`
            : decision === "REJECTED"
            ? `KYC rejected for ${selectedKyc.user?.email}`
            : `Additional info requested from ${selectedKyc.user?.email}`
        );

        setSelectedKyc(null);
        setActionType(null);
        setActionReason("");
        await loadKyc();
      } else {
        toast.error(res.error || "Action failed.");
      }
    } catch (e: any) {
      toast.error(e.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Expiry check logic
  const isDocumentExpired = (expiryDateStr?: string | null) => {
    if (!expiryDateStr) return false;
    try {
      const exp = new Date(expiryDateStr);
      return !isNaN(exp.getTime()) && exp < new Date();
    } catch {
      return false;
    }
  };

  const filteredKycs = kycs.filter((k) => {
    if (filter !== "ALL" && k.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const email = k.user?.email?.toLowerCase() || "";
      const uid = String(k.user?.uid || "");
      const name = k.fullName?.toLowerCase() || k.user?.name?.toLowerCase() || "";
      const idNum = k.idNumber?.toLowerCase() || "";
      const addr = k.address?.toLowerCase() || "";
      const docType = k.documentType?.toLowerCase() || "";
      return (
        email.includes(q) ||
        uid.includes(q) ||
        name.includes(q) ||
        idNum.includes(q) ||
        addr.includes(q) ||
        docType.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans p-2 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
            <ShieldCheck className="w-6 h-6 text-[#00A070] shrink-0" />
            <span>KYC Verification & Document Inspection</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Review user identity documents (Images & PDFs) in high-resolution, verify extracted fields against records, and record compliance decisions with full audit trailing.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#161822] p-1 rounded-xl border border-white/5 overflow-x-auto max-w-full">
          {(
            [
              { id: "ALL", label: "All" },
              { id: "PENDING", label: "Pending Review" },
              { id: "ADDITIONAL_INFO_REQUIRED", label: "Action Req" },
              { id: "APPROVED", label: "Approved" },
              { id: "REJECTED", label: "Rejected" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                filter === tab.id
                  ? "bg-[#00A070] text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 px-1.5 py-0.2 bg-black/40 rounded-full text-[10px] font-mono">
                {kycs.filter((k) => (tab.id === "ALL" ? true : k.status === tab.id)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by email, UID, full name, ID number, or document type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#161822] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-gray-500 outline-none focus:border-[#00A070] transition-colors"
        />
      </div>

      {/* KYC Table */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl min-w-0">
        {isLoading ? (
          <div className="py-20 flex justify-center text-[#00A070]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredKycs.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-500">
            No KYC applications found matching current criteria.
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-[#1E202B] text-gray-400 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-5 py-3.5">User Details</th>
                  <th className="px-4 py-3.5">Doc Type & ID</th>
                  <th className="px-4 py-3.5">Document Previews</th>
                  <th className="px-4 py-3.5">Residence</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredKycs.map((item) => {
                  const expired = isDocumentExpired(item.expiryDate);
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* User Column */}
                      <td className="px-5 py-4">
                        <div className="min-w-0 max-w-[200px]">
                          <span className="font-bold text-white block break-words break-all">
                            {item.fullName || item.user?.name || item.user?.email}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono block break-words break-all">
                            {item.user?.email}
                          </span>
                          <span className="text-[10px] font-mono text-[#00A070]">
                            UID: #{item.user?.uid}
                          </span>
                        </div>
                      </td>

                      {/* Doc Type & ID */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-white/5 text-gray-300 border border-white/10">
                            {item.documentType?.replace("_", " ") || "GOVERNMENT ID"}
                          </span>
                          <span className="block font-mono font-bold text-white tracking-wide">
                            {item.idNumber}
                          </span>
                          {expired && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30">
                              <AlertTriangle className="w-2.5 h-2.5" /> EXPIRED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Document Preview Thumbnails */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {item.idFrontUrl ? (
                            <KycDocumentViewer
                              url={item.idFrontUrl}
                              title="Front Document"
                              compact
                              className="w-14 h-10"
                              onOpenFullscreen={() => handleOpenReview(item)}
                            />
                          ) : (
                            <span className="text-[10px] text-gray-500 italic">No Front</span>
                          )}

                          {item.idBackUrl ? (
                            <KycDocumentViewer
                              url={item.idBackUrl}
                              title="Back Document"
                              compact
                              className="w-14 h-10"
                              onOpenFullscreen={() => handleOpenReview(item)}
                            />
                          ) : item.documentType === "PASSPORT" ? (
                            <span className="text-[10px] text-gray-500 font-mono">Passport</span>
                          ) : (
                            <span className="text-[10px] text-gray-500 italic">No Back</span>
                          )}
                        </div>
                      </td>

                      {/* Address */}
                      <td className="px-4 py-4 max-w-[160px]">
                        <span className="text-gray-300 block truncate" title={item.address}>
                          {item.address}
                        </span>
                        {(item.city || item.country) && (
                          <span className="text-[10px] text-gray-500 block truncate">
                            {[item.city, item.country].filter(Boolean).join(", ")}
                          </span>
                        )}
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
                                : item.status === "ADDITIONAL_INFO_REQUIRED"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                            }`}
                          >
                            {item.status === "ADDITIONAL_INFO_REQUIRED"
                              ? "ACTION REQ"
                              : item.status}
                          </span>

                          {item.attemptCount > 1 && (
                            <span className="block text-[9px] text-gray-500 font-mono mt-0.5">
                              Attempt #{item.attemptCount}
                            </span>
                          )}

                          {item.rejectionReason && item.status === "REJECTED" && (
                            <span
                              className="block text-[10px] text-rose-400 mt-1 max-w-[140px] truncate"
                              title={item.rejectionReason}
                            >
                              {item.rejectionReason}
                            </span>
                          )}

                          {item.additionalInfoRequired && item.status === "ADDITIONAL_INFO_REQUIRED" && (
                            <span
                              className="block text-[10px] text-amber-400 mt-1 max-w-[140px] truncate"
                              title={item.additionalInfoRequired}
                            >
                              {item.additionalInfoRequired}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Submitted At */}
                      <td className="px-4 py-4 text-gray-400 text-[11px] font-mono whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>

                      {/* Action Button */}
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold text-xs transition-all shadow-md shadow-[#00A070]/20 cursor-pointer flex items-center gap-1.5 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review & Verify</span>
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

      {/* COMPREHENSIVE FULLY-RESPONSIVE KYC INSPECTION & VERIFICATION MODAL */}
      {selectedKyc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0 sm:p-3 md:p-6 backdrop-blur-md animate-in fade-in">
          <div className="w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-6xl bg-[#141620] border-0 sm:border sm:border-white/10 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans">
            {/* Modal Top Header (Compact & Sticky) */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-[#1B1E2C] border-b border-white/5 select-none shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 rounded-xl bg-[#00A070]/20 text-[#00A070] border border-[#00A070]/30 shrink-0">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md">
                      {selectedKyc.fullName || selectedKyc.user?.email}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold shrink-0 ${
                        selectedKyc.status === "APPROVED"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : selectedKyc.status === "REJECTED"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : selectedKyc.status === "ADDITIONAL_INFO_REQUIRED"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                      }`}
                    >
                      {selectedKyc.status}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400 font-mono block truncate">
                    {selectedKyc.user?.email} • UID: #{selectedKyc.user?.uid} • Attempt #{selectedKyc.attemptCount || 1}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedKyc(null)}
                  className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Close Review (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile View Switcher Tabs (Visible on screens < lg) */}
            <div className="lg:hidden flex items-center bg-[#161824] border-b border-white/10 p-1.5 gap-1.5 shrink-0 select-none">
              <button
                type="button"
                onClick={() => setMobileTab("document")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mobileTab === "document"
                    ? "bg-[#00A070] text-white shadow-md"
                    : "bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Document View ({activeSide === "front" ? "Front" : "Back"})</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("details")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mobileTab === "details"
                    ? "bg-[#00A070] text-white shadow-md"
                    : "bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Details & Verify</span>
                {!allChecksSatisfied && selectedKyc.status === "PENDING" ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                )}
              </button>
            </div>

            {/* Modal Body - Responsive Layout (Desktop: Side-by-Side Dual Pane | Mobile: Tab-Driven Full View) */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
              {/* LEFT COLUMN: Document Viewer & Side Switcher */}
              <div
                className={`lg:col-span-7 flex flex-col p-3 sm:p-5 gap-3.5 bg-[#0F1118] overflow-y-auto ${
                  mobileTab === "document" ? "flex" : "hidden lg:flex"
                }`}
              >
                {/* Side Switcher & Document Info */}
                <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Document Inspection
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">
                      {selectedKyc.documentType?.replace("_", " ") || "IDENTITY DOCUMENT"}
                    </span>
                  </div>

                  {/* Switch Front / Back */}
                  <div className="flex items-center bg-[#181B26] p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setActiveSide("front")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeSide === "front"
                          ? "bg-[#00A070] text-white shadow"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      Front Side / Bio Page
                    </button>
                    {selectedKyc.idBackUrl && (
                      <button
                        type="button"
                        onClick={() => setActiveSide("back")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          activeSide === "back"
                            ? "bg-[#00A070] text-white shadow"
                            : "text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        Back Side / Cover
                      </button>
                    )}
                  </div>
                </div>

                {/* Primary Viewer Component */}
                <div className="w-full flex-1 min-h-[300px] sm:min-h-[400px]">
                  <KycDocumentViewer
                    url={
                      activeSide === "front"
                        ? selectedKyc.idFrontUrl
                        : selectedKyc.idBackUrl || selectedKyc.idFrontUrl
                    }
                    title={`${selectedKyc.documentType?.replace("_", " ") || "Document"} (${
                      activeSide === "front" ? "Front Side" : "Back Side"
                    })`}
                    documentType={selectedKyc.documentType}
                    className="w-full h-full"
                  />
                </div>

                {/* Document Risk Warning Badges */}
                <div className="flex flex-wrap gap-2 shrink-0">
                  {isDocumentExpired(selectedKyc.expiryDate) && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Warning: Stated document expiry ({selectedKyc.expiryDate}) has passed.</span>
                    </div>
                  )}

                  {!selectedKyc.idBackUrl && selectedKyc.documentType !== "PASSPORT" && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Notice: Back side image is missing for this document type.</span>
                    </div>
                  )}
                </div>

                {/* Mobile Direct Jump to Details Button */}
                <div className="lg:hidden shrink-0 pt-1 pb-4">
                  <button
                    type="button"
                    onClick={() => setMobileTab("details")}
                    className="w-full py-3 bg-[#00A070] hover:bg-[#00b880] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#00A070]/20 cursor-pointer transition-all"
                  >
                    <span>Proceed to Verification Details & Decision</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Submitted Details, Comparison, Checklist & Decision Actions */}
              <div
                className={`lg:col-span-5 flex flex-col p-3 sm:p-5 gap-4 bg-[#141620] overflow-y-auto ${
                  mobileTab === "details" ? "flex" : "hidden lg:flex"
                }`}
              >
                {/* Mobile Back Button */}
                <div className="lg:hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => setMobileTab("document")}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Switch to Document Inspection View</span>
                  </button>
                </div>

                {/* 1. Submitted Data Overview */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block font-sans">
                    Submitted Identity Data
                  </span>

                  <div className="bg-[#191C28] rounded-xl border border-white/5 divide-y divide-white/5 text-xs font-mono">
                    <div className="p-2.5 sm:p-3 flex justify-between items-center">
                      <span className="text-gray-400">Document Type:</span>
                      <span className="text-white font-bold">
                        {selectedKyc.documentType?.replace("_", " ") || "GOVERNMENT ID"}
                      </span>
                    </div>

                    <div className="p-2.5 sm:p-3 flex justify-between items-center">
                      <span className="text-gray-400">Document ID:</span>
                      <span className="text-[#00A070] font-bold text-sm tracking-wide">
                        {selectedKyc.idNumber}
                      </span>
                    </div>

                    {selectedKyc.fullName && (
                      <div className="p-2.5 sm:p-3 flex justify-between items-center">
                        <span className="text-gray-400">Full Name:</span>
                        <span className="text-white font-semibold">{selectedKyc.fullName}</span>
                      </div>
                    )}

                    {selectedKyc.dateOfBirth && (
                      <div className="p-2.5 sm:p-3 flex justify-between items-center">
                        <span className="text-gray-400">Date of Birth:</span>
                        <span className="text-gray-200">{selectedKyc.dateOfBirth}</span>
                      </div>
                    )}

                    {selectedKyc.gender && (
                      <div className="p-2.5 sm:p-3 flex justify-between items-center">
                        <span className="text-gray-400">Gender:</span>
                        <span className="text-gray-200">{selectedKyc.gender}</span>
                      </div>
                    )}

                    {selectedKyc.nationality && (
                      <div className="p-2.5 sm:p-3 flex justify-between items-center">
                        <span className="text-gray-400">Nationality:</span>
                        <span className="text-gray-200">{selectedKyc.nationality}</span>
                      </div>
                    )}

                    {selectedKyc.issuingCountry && (
                      <div className="p-2.5 sm:p-3 flex justify-between items-center">
                        <span className="text-gray-400">Issuing Country:</span>
                        <span className="text-gray-200">{selectedKyc.issuingCountry}</span>
                      </div>
                    )}

                    {selectedKyc.issuingAuthority && (
                      <div className="p-2.5 sm:p-3 flex justify-between items-center">
                        <span className="text-gray-400">Issuing Authority:</span>
                        <span className="text-gray-200">{selectedKyc.issuingAuthority}</span>
                      </div>
                    )}

                    {selectedKyc.expiryDate && (
                      <div className="p-2.5 sm:p-3 flex justify-between items-center">
                        <span className="text-gray-400">Expiry Date:</span>
                        <span
                          className={`font-semibold ${
                            isDocumentExpired(selectedKyc.expiryDate) ? "text-rose-400 font-bold" : "text-gray-200"
                          }`}
                        >
                          {selectedKyc.expiryDate}
                          {isDocumentExpired(selectedKyc.expiryDate) && " (EXPIRED)"}
                        </span>
                      </div>
                    )}

                    <div className="p-2.5 sm:p-3">
                      <span className="text-gray-400 block mb-1">Residential Address:</span>
                      <span className="text-gray-200 block font-sans break-words">
                        {[
                          selectedKyc.address,
                          selectedKyc.city,
                          selectedKyc.state,
                          selectedKyc.postalCode,
                          selectedKyc.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Mandatory Verification Checklist */}
                <div className="space-y-2.5 bg-[#191C28] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-[#00A070]" />
                      Compliance Verification Checklist
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      Required for Approval
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      {
                        key: "isLegible" as const,
                        label: "Document text and edges are crisp, uncropped, and readable",
                      },
                      {
                        key: "nameMatches" as const,
                        label: "Full legal name matches submitted identity profile",
                      },
                      {
                        key: "idMatches" as const,
                        label: "Document number on image matches submitted ID number",
                      },
                      {
                        key: "isValidNonExpired" as const,
                        label: "Document is currently valid (not expired or tampered)",
                      },
                      {
                        key: "photoClear" as const,
                        label: "Photograph and facial features are clear and unaltered",
                      },
                    ].map((item) => (
                      <label
                        key={item.key}
                        onClick={() => handleToggleCheck(item.key)}
                        className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors cursor-pointer text-xs select-none ${
                          checklist[item.key]
                            ? "bg-[#00A070]/10 text-white"
                            : "bg-white/[0.02] text-gray-400 hover:text-gray-300"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {checklist[item.key] ? (
                            <CheckSquare className="w-4 h-4 text-[#00A070]" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        <span className="leading-snug">{item.label}</span>
                      </label>
                    ))}
                  </div>

                  {!allChecksSatisfied && selectedKyc.status === "PENDING" && (
                    <div className="text-[11px] text-amber-400/90 font-mono flex items-center gap-1 pt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Complete all 5 checks to unlock approval</span>
                    </div>
                  )}
                </div>

                {/* 3. Action Buttons */}
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                    Take Compliance Action
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Approve */}
                    <button
                      type="button"
                      onClick={() => {
                        setActionType("APPROVE");
                        setActionReason("");
                      }}
                      disabled={!allChecksSatisfied && selectedKyc.status !== "APPROVED"}
                      className={`p-2.5 sm:p-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        allChecksSatisfied || selectedKyc.status === "APPROVED"
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                          : "bg-emerald-950/40 text-emerald-600/50 border border-emerald-900/30 cursor-not-allowed"
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve</span>
                    </button>

                    {/* Request Additional Info */}
                    <button
                      type="button"
                      onClick={() => {
                        setActionType("REQUEST_INFO");
                        setActionReason(
                          selectedKyc.additionalInfoRequired ||
                            "Please upload a clearer high-resolution photo with all four corners visible."
                        );
                      }}
                      className="p-2.5 sm:p-3 rounded-xl font-bold text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span>Request Info</span>
                    </button>

                    {/* Reject */}
                    <button
                      type="button"
                      onClick={() => {
                        setActionType("REJECT");
                        setActionReason(
                          selectedKyc.rejectionReason || "Identity photo is blurry or unreadable."
                        );
                      }}
                      className="p-2.5 sm:p-3 rounded-xl font-bold text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>

                {/* 4. Audit History Trail */}
                {auditLogs.length > 0 && (
                  <div className="space-y-2 bg-[#191C28] p-3 sm:p-4 rounded-xl border border-white/5 pb-4">
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-gray-400" />
                      Verification Audit Trail ({auditLogs.length})
                    </span>
                    <div className="space-y-2 max-h-36 overflow-y-auto font-mono text-[11px]">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="p-2 bg-[#141620] rounded-lg border border-white/5">
                          <div className="flex justify-between text-gray-400">
                            <span className="font-bold text-gray-300">{log.action}</span>
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                          <span className="text-gray-400 block mt-0.5">{log.details}</span>
                          <span className="text-[10px] text-gray-500 block">by {log.adminEmail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION / REMARKS MODAL FOR ACTIONS (APPROVE, REJECT, REQUEST INFO) */}
      {actionType && selectedKyc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl text-white font-sans space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {actionType === "APPROVE" ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-emerald-400" /> Confirm KYC Approval
                  </>
                ) : actionType === "REJECT" ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-rose-400" /> Confirm KYC Rejection
                  </>
                ) : (
                  <>
                    <HelpCircle className="w-5 h-5 text-amber-400" /> Request Additional Info / Re-upload
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400 font-mono">
              Target: {selectedKyc.user?.email} (UID: #{selectedKyc.user?.uid})
            </p>

            {actionType === "APPROVE" ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl text-xs text-emerald-300 space-y-2">
                <p>
                  You are about to verify <strong>{selectedKyc.fullName || selectedKyc.user?.email}</strong>.
                  This will unlock institutional deposit/withdrawal and full trading permissions.
                </p>
                <div className="text-[11px] text-emerald-400/80 font-mono">
                  ✓ All 5 compliance verification checks confirmed.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs text-gray-300 font-semibold block">
                  {actionType === "REJECT"
                    ? "Mandatory Rejection Reason (Visible to user):"
                    : "Instructions / Requested Documents (Visible to user):"}
                </label>
                <textarea
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={
                    actionType === "REJECT"
                      ? "e.g. Identity document photo is blurry or cropped."
                      : "e.g. Please re-upload passport page with readable MRZ code."
                  }
                  className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00A070] resize-none"
                  required
                />

                {/* Quick Presets */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 font-mono">Quick Preset Remarks:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(actionType === "REJECT"
                      ? [
                          "Photo is blurry or unreadable",
                          "Document has expired",
                          "Name does not match identity document",
                          "Back side photo missing or cropped",
                          "Suspected forged or invalid document",
                        ]
                      : [
                          "Please re-upload clearer, glare-free photos",
                          "Please upload back side of identity card",
                          "Document corners are cut off, capture full page",
                          "Please provide valid, non-expired passport photo",
                          "Proof of residential address required",
                        ]
                    ).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setActionReason(preset)}
                        className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 px-2 py-1 rounded-md border border-white/5 cursor-pointer transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                disabled={isSubmitting}
                className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1E202B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDecision}
                disabled={isSubmitting}
                className={`py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  actionType === "APPROVE"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : actionType === "REJECT"
                    ? "bg-rose-600 hover:bg-rose-500"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : actionType === "APPROVE" ? (
                  "Confirm Approval"
                ) : actionType === "REJECT" ? (
                  "Confirm Rejection"
                ) : (
                  "Send Request"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
