"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import {
  getAdminP2pDisputes,
  getAdminP2pDisputeDetails,
  updateAdminP2pDisputeStatus,
  assignAdminP2pDispute,
  addAdminDisputeNote,
  resolveAdminP2pDispute,
  reopenAdminP2pDispute,
} from "@/actions/admin";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Scale,
  Search,
  ShieldCheck,
  User,
  UserCheck,
  RefreshCw,
  FolderOpen,
  Send,
  AlertCircle,
  FileCheck,
  Eye,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

function AdminP2PDisputesContent() {
  const searchParams = useSearchParams();
  const initialDisputeId = searchParams.get("id");

  const [disputes, setDisputes] = useState<any[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Selected Dispute & Deep Details
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(initialDisputeId);
  const [detailedDispute, setDetailedDispute] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "chat" | "timeline">("overview");

  // Evidence Request State
  const [showRequestEvidenceModal, setShowRequestEvidenceModal] = useState(false);
  const [evidenceTarget, setEvidenceTarget] = useState<"BUYER" | "SELLER" | "BOTH">("BUYER");
  const [evidenceRequestNote, setEvidenceRequestNote] = useState("");
  const [isRequestingEvidence, setIsRequestingEvidence] = useState(false);

  // Internal Note State
  const [newNoteText, setNewNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Resolution Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [decision, setDecision] = useState<"BUYER_WINS" | "SELLER_WINS" | "DISMISSED">("BUYER_WINS");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  // Reopen Modal State
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);

  const fetchDisputes = async () => {
    setIsLoading(true);
    try {
      const res = await getAdminP2pDisputes({
        status: filter === "ALL" ? undefined : filter,
        search: searchTerm.trim() || undefined,
      });
      setDisputes(res || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load dispute cases");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [filter]);

  // Load deep details when a dispute is selected
  useEffect(() => {
    if (!selectedDisputeId) {
      setDetailedDispute(null);
      return;
    }

    let isMounted = true;
    setIsLoadingDetails(true);

    getAdminP2pDisputeDetails(selectedDisputeId)
      .then((res) => {
        if (isMounted) {
          if (res.success && res.data) {
            setDetailedDispute(res.data);
          } else {
            toast.error(res.error || "Failed to load dispute details");
            setSelectedDisputeId(null);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          toast.error(err.message || "Error fetching dispute details");
          setSelectedDisputeId(null);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDisputeId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDisputes();
  };

  const handleStatusChange = async (newStatus: "OPEN" | "UNDER_REVIEW" | "AWAITING_EVIDENCE" | "ESCALATED") => {
    if (!detailedDispute) return;
    try {
      const res = await updateAdminP2pDisputeStatus(detailedDispute.id, {
        status: newStatus,
        note: `Status manually updated to ${newStatus}`,
      });
      if (res.success) {
        toast.success(`Dispute status updated to ${newStatus.replace(/_/g, " ")}`);
        // Refresh details and list
        const refreshed = await getAdminP2pDisputeDetails(detailedDispute.id);
        if (refreshed.success) setDetailedDispute(refreshed.data);
        fetchDisputes();
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch (err: any) {
      toast.error(err.message || "Status update error");
    }
  };

  const handleAssignSelf = async () => {
    if (!detailedDispute) return;
    try {
      const res = await assignAdminP2pDispute(detailedDispute.id);
      if (res.success) {
        toast.success("Dispute assigned to you.");
        const refreshed = await getAdminP2pDisputeDetails(detailedDispute.id);
        if (refreshed.success) setDetailedDispute(refreshed.data);
        fetchDisputes();
      } else {
        toast.error(res.error || "Failed to assign dispute");
      }
    } catch (err: any) {
      toast.error(err.message || "Assignment error");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedDispute || !newNoteText.trim()) return;

    setIsAddingNote(true);
    try {
      const res = await addAdminDisputeNote(detailedDispute.id, newNoteText.trim());
      if (res.success) {
        toast.success("Internal note added to case timeline.");
        setNewNoteText("");
        const refreshed = await getAdminP2pDisputeDetails(detailedDispute.id);
        if (refreshed.success) setDetailedDispute(refreshed.data);
      } else {
        toast.error(res.error || "Failed to add note");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleRequestEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedDispute) return;

    setIsRequestingEvidence(true);
    try {
      const res = await updateAdminP2pDisputeStatus(detailedDispute.id, {
        status: "AWAITING_EVIDENCE",
        requestEvidenceFrom: evidenceTarget,
        messageToParties: evidenceRequestNote.trim(),
        note: `Evidence requested from ${evidenceTarget}: ${evidenceRequestNote.trim()}`,
      });

      if (res.success) {
        toast.success(`Evidence request sent to ${evidenceTarget}. Email notification dispatched.`);
        setShowRequestEvidenceModal(false);
        setEvidenceRequestNote("");
        const refreshed = await getAdminP2pDisputeDetails(detailedDispute.id);
        if (refreshed.success) setDetailedDispute(refreshed.data);
        fetchDisputes();
      } else {
        toast.error(res.error || "Failed to request evidence");
      }
    } catch (err: any) {
      toast.error(err.message || "Evidence request error");
    } finally {
      setIsRequestingEvidence(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedDispute) return;
    if (!resolutionNotes.trim()) {
      toast.error("Please enter mandatory resolution notes.");
      return;
    }

    setIsResolving(true);
    try {
      const releaseEscrowTo =
        decision === "BUYER_WINS" ? "BUYER" : decision === "SELLER_WINS" ? "SELLER" : "NONE";

      const res = await resolveAdminP2pDispute(detailedDispute.id, {
        decision,
        resolutionNotes: resolutionNotes.trim(),
        releaseEscrowTo,
      });

      if (res.success) {
        toast.success(`Dispute #${detailedDispute.disputeNumber} adjudicated: ${decision.replace(/_/g, " ")}`);
        setShowResolveModal(false);
        setResolutionNotes("");
        const refreshed = await getAdminP2pDisputeDetails(detailedDispute.id);
        if (refreshed.success) setDetailedDispute(refreshed.data);
        fetchDisputes();
      } else {
        toast.error(res.error || "Failed to resolve dispute");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve dispute");
    } finally {
      setIsResolving(false);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedDispute || !reopenReason.trim()) return;

    setIsReopening(true);
    try {
      const res = await reopenAdminP2pDispute(detailedDispute.id, reopenReason.trim());
      if (res.success) {
        toast.success("Dispute successfully reopened and order returned to DISPUTED status.");
        setShowReopenModal(false);
        setReopenReason("");
        const refreshed = await getAdminP2pDisputeDetails(detailedDispute.id);
        if (refreshed.success) setDetailedDispute(refreshed.data);
        fetchDisputes();
      } else {
        toast.error(res.error || "Failed to reopen dispute");
      }
    } catch (err: any) {
      toast.error(err.message || "Reopen error");
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/p2p"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to P2P Oversight
          </Link>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5 sm:gap-3">
            <Scale className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 shrink-0" />
            <span>P2P Dispute Resolution Console</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            Investigate counterparty claims, audit chat logs, review payment proofs, and authorize final escrow disposition.
          </p>
        </div>

        <Button
          onClick={fetchDisputes}
          variant="outline"
          size="sm"
          className="border-white/10 text-gray-300 hover:text-white self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh List
        </Button>
      </div>

      {/* Controls Bar: Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#161822] p-3 sm:p-4 rounded-2xl border border-white/5 shadow-md">
        {/* Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
          {[
            { id: "ALL", label: "All Cases" },
            { id: "OPEN", label: "Open" },
            { id: "UNDER_REVIEW", label: "Under Review" },
            { id: "AWAITING_EVIDENCE", label: "Awaiting Evidence" },
            { id: "ESCALATED", label: "Escalated" },
            { id: "RESOLVED", label: "Resolved" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                filter === tab.id
                  ? "bg-amber-500 text-black shadow-md"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-xs w-full">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              type="text"
              placeholder="Search ID, email, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-[#121212] border-white/10 text-xs h-9 rounded-xl focus:border-amber-400"
            />
          </div>
          <Button type="submit" size="sm" className="bg-white/10 hover:bg-white/20 text-white text-xs h-9 px-3">
            Search
          </Button>
        </form>
      </div>

      {/* Disputes List Container */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-white/5">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400 mx-auto mb-2" />
              <p className="text-xs">Loading dispute cases...</p>
            </div>
          ) : disputes.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">
              No disputes found matching this criteria.
            </div>
          ) : (
            disputes.map((dsp: any) => {
              const ord = dsp.order || {};
              const isFinalized =
                dsp.status === "RESOLVED_BUYER" ||
                dsp.status === "RESOLVED_SELLER" ||
                dsp.status === "CANCELLED";

              return (
                <div key={dsp.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-white text-xs block">#{dsp.disputeNumber}</span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(dsp.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isFinalized
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : dsp.status === "ESCALATED"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                          : dsp.status === "AWAITING_EVIDENCE"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {dsp.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="bg-[#121212] p-2.5 rounded-xl border border-white/5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">Associated Order:</span>
                      <span className="font-bold text-white text-[11px]">#{ord.orderNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">Locked Escrow:</span>
                      <span className="font-mono text-emerald-400 font-semibold text-xs">
                        {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}{" "}
                        <span className="text-gray-400 text-[10px]">
                          ({Number(ord.fiatAmount).toLocaleString()} {ord.fiatCurrency})
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="text-amber-300 font-semibold text-xs">{dsp.reason}</p>
                  </div>

                  <div className="text-[11px] text-gray-400 space-y-0.5 pt-1 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Claimant:</span>
                      <span className="text-gray-300 truncate max-w-[190px]">
                        {dsp.initiator?.name || dsp.initiator?.email || "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Buyer:</span>
                      <span className="text-gray-300 truncate max-w-[190px]">{ord.buyer?.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Seller:</span>
                      <span className="text-gray-300 truncate max-w-[190px]">{ord.seller?.email}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedDisputeId(dsp.id);
                      setActiveTab("overview");
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs h-9 cursor-pointer"
                  >
                    Open Investigation Workspace
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[860px] text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-[#121212]/70 text-gray-400 uppercase tracking-wider font-semibold">
                <th className="px-5 py-4">Dispute & Date</th>
                <th className="px-5 py-4">Order & Escrow Amount</th>
                <th className="px-5 py-4">Counterparties</th>
                <th className="px-5 py-4">Dispute Reason</th>
                <th className="px-5 py-4">Status & Admin</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-3" />
                    <p className="text-xs">Loading dispute cases...</p>
                  </td>
                </tr>
              ) : disputes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                    No disputes found matching this criteria.
                  </td>
                </tr>
              ) : (
                disputes.map((dsp: any) => {
                  const ord = dsp.order || {};
                  const isFinalized =
                    dsp.status === "RESOLVED_BUYER" ||
                    dsp.status === "RESOLVED_SELLER" ||
                    dsp.status === "CANCELLED";

                  return (
                    <tr key={dsp.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-bold text-white block">#{dsp.disputeNumber}</span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(dsp.createdAt).toLocaleString()}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-bold text-white block">Order #{ord.orderNumber}</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}
                        </span>
                        <span className="text-gray-400 block text-[11px]">
                          ({Number(ord.fiatAmount).toLocaleString()} {ord.fiatCurrency})
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-white block font-semibold truncate max-w-[180px]">
                          By: {dsp.initiator?.name || dsp.initiator?.email || "Unknown"}
                        </span>
                        <span className="text-gray-400 text-[11px] block truncate max-w-[180px]">
                          B: {ord.buyer?.email}
                        </span>
                        <span className="text-gray-400 text-[11px] block truncate max-w-[180px]">
                          S: {ord.seller?.email}
                        </span>
                      </td>

                      <td className="px-5 py-4 max-w-xs">
                        <span className="font-semibold text-amber-300 block line-clamp-2">
                          {dsp.reason}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isFinalized
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : dsp.status === "ESCALATED"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                              : dsp.status === "AWAITING_EVIDENCE"
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {dsp.status.replace(/_/g, " ")}
                        </span>
                        {dsp.assignedAdmin && (
                          <span className="block text-[10px] text-gray-500 mt-1 truncate max-w-[120px]">
                            {dsp.assignedAdmin.name || dsp.assignedAdmin.email}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedDisputeId(dsp.id);
                            setActiveTab("overview");
                          }}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs h-8 px-3 cursor-pointer"
                        >
                          Investigate
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Dispute Investigation Modal */}
      {selectedDisputeId && (
        <Dialog open={Boolean(selectedDisputeId)} onOpenChange={(open) => !open && setSelectedDisputeId(null)}>
          <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] bg-[#161822] border-white/10 text-white flex flex-col p-4 sm:p-6 overflow-hidden">
            {isLoadingDetails || !detailedDispute ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Loading comprehensive case dossier...</p>
              </div>
            ) : (
              <>
                {/* Modal Header */}
                <DialogHeader className="shrink-0 border-b border-white/10 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                        <Scale className="w-5 h-5 text-amber-400 shrink-0" />
                        <span>Case #{detailedDispute.disputeNumber}</span>
                        <span
                          className={`ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            detailedDispute.status.startsWith("RESOLVED")
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : detailedDispute.status === "ESCALATED"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {detailedDispute.status.replace(/_/g, " ")}
                        </span>
                      </DialogTitle>
                      <DialogDescription className="text-gray-400 text-xs mt-0.5">
                        Order #{detailedDispute.order?.orderNumber} • Opened by{" "}
                        <strong className="text-white">
                          {detailedDispute.initiator?.name || detailedDispute.initiator?.email}
                        </strong>{" "}
                        on {new Date(detailedDispute.createdAt).toLocaleString()}
                      </DialogDescription>
                    </div>

                    {/* Quick Case Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {!detailedDispute.assignedAdminId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAssignSelf}
                          className="h-8 text-xs border-white/10 text-gray-300 hover:text-white"
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1 text-[#00A070]" /> Assign to Me
                        </Button>
                      )}

                      {detailedDispute.status !== "RESOLVED_BUYER" &&
                        detailedDispute.status !== "RESOLVED_SELLER" &&
                        detailedDispute.status !== "CANCELLED" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowRequestEvidenceModal(true)}
                              className="h-8 text-xs border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                            >
                              <FileCheck className="w-3.5 h-3.5 mr-1" /> Request Evidence
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setDecision("BUYER_WINS");
                                setResolutionNotes("");
                                setShowResolveModal(true);
                              }}
                              className="h-8 text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-md cursor-pointer"
                            >
                              Adjudicate Ruling
                            </Button>
                          </>
                        )}

                      {(detailedDispute.status === "RESOLVED_BUYER" ||
                        detailedDispute.status === "RESOLVED_SELLER" ||
                        detailedDispute.status === "CANCELLED") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReopenReason("");
                            setShowReopenModal(true);
                          }}
                          className="h-8 text-xs border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen Dispute
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex gap-2 pt-3 border-t border-white/5 mt-3 overflow-x-auto scrollbar-none">
                    {[
                      { id: "overview", label: "Case & Order Details", icon: FileText },
                      {
                        id: "evidence",
                        label: `Evidence Vault (${detailedDispute.evidenceList?.length || 0})`,
                        icon: FolderOpen,
                      },
                      {
                        id: "chat",
                        label: `Trade Chat Transcript (${detailedDispute.chatMessages?.length || 0})`,
                        icon: MessageSquare,
                      },
                      {
                        id: "timeline",
                        label: `Audit Timeline (${detailedDispute.timeline?.length || 0})`,
                        icon: Clock,
                      },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            activeTab === tab.id
                              ? "bg-white/10 text-white border border-white/15"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </DialogHeader>

                {/* Modal Content Window (Scrollable) */}
                <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 text-xs overscroll-contain">
                  {/* TAB 1: OVERVIEW */}
                  {activeTab === "overview" && (
                    <div className="space-y-4">
                      {/* Financials & Escrow Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-2">
                          <span className="text-gray-400 block text-[11px] font-semibold uppercase">
                            Locked Escrow
                          </span>
                          <span className="text-xl font-bold font-mono text-emerald-400 block">
                            {detailedDispute.order?.cryptoAmount} {detailedDispute.order?.asset}
                          </span>
                          <span className="text-gray-400 text-[11px] block">
                            Total Fiat:{" "}
                            <strong className="text-white">
                              {Number(detailedDispute.order?.fiatAmount).toLocaleString()}{" "}
                              {detailedDispute.order?.fiatCurrency}
                            </strong>
                          </span>
                        </div>

                        <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-1 text-[11px]">
                          <span className="text-gray-400 block font-semibold uppercase">Buyer Counterparty</span>
                          <p className="font-bold text-white text-xs truncate">
                            {detailedDispute.order?.buyer?.name || "N/A"}
                          </p>
                          <p className="text-gray-300 truncate">{detailedDispute.order?.buyer?.email}</p>
                          <p className="text-gray-500">UID: #{detailedDispute.order?.buyer?.uid || "N/A"}</p>
                        </div>

                        <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-1 text-[11px]">
                          <span className="text-gray-400 block font-semibold uppercase">Seller Counterparty</span>
                          <p className="font-bold text-white text-xs truncate">
                            {detailedDispute.order?.seller?.name || "N/A"}
                          </p>
                          <p className="text-gray-300 truncate">{detailedDispute.order?.seller?.email}</p>
                          <p className="text-gray-500">UID: #{detailedDispute.order?.seller?.uid || "N/A"}</p>
                        </div>
                      </div>

                      {/* Dispute Claims Card */}
                      <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wider">
                            Formal Dispute Claim
                          </h4>
                          <span className="text-gray-500 text-[11px]">
                            Filed by {detailedDispute.initiator?.name || detailedDispute.initiator?.email}
                          </span>
                        </div>
                        <p className="text-white font-semibold text-sm">{detailedDispute.reason}</p>
                      </div>

                      {/* Payment Snapshot */}
                      <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-2">
                        <h4 className="font-bold text-gray-300 text-xs uppercase tracking-wider">
                          Agreed Payment Method & Credentials
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/[0.02] p-3 rounded-lg border border-white/5">
                          <div>
                            <span className="text-gray-500 block text-[10px]">Method</span>
                            <span className="font-bold text-white">{detailedDispute.order?.paymentMethod}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[10px]">Unit Price</span>
                            <span className="font-mono text-gray-300">
                              {detailedDispute.order?.price} {detailedDispute.order?.fiatCurrency} / {detailedDispute.order?.asset}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Workflow Action Bar */}
                      {detailedDispute.status !== "RESOLVED_BUYER" &&
                        detailedDispute.status !== "RESOLVED_SELLER" &&
                        detailedDispute.status !== "CANCELLED" && (
                          <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-2">
                            <h4 className="font-bold text-gray-300 text-xs uppercase tracking-wider">
                              Dispute Lifecycle Progression
                            </h4>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {detailedDispute.status !== "UNDER_REVIEW" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStatusChange("UNDER_REVIEW")}
                                  className="h-8 text-xs border-amber-500/20 text-amber-300 hover:bg-amber-500/10"
                                >
                                  Mark Under Review
                                </Button>
                              )}
                              {detailedDispute.status !== "ESCALATED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStatusChange("ESCALATED")}
                                  className="h-8 text-xs border-red-500/20 text-red-300 hover:bg-red-500/10"
                                >
                                  Escalate Case (High Priority)
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* TAB 2: EVIDENCE VAULT */}
                  {activeTab === "evidence" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                            Submitted Documents & Proof of Payment
                          </h4>
                          <p className="text-[11px] text-gray-400">
                            Bank transfer receipts, UPI screenshots, and account statements submitted by counterparties.
                          </p>
                        </div>
                        {detailedDispute.status !== "RESOLVED_BUYER" &&
                          detailedDispute.status !== "RESOLVED_SELLER" &&
                          detailedDispute.status !== "CANCELLED" && (
                            <Button
                              size="sm"
                              onClick={() => setShowRequestEvidenceModal(true)}
                              className="h-8 text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold"
                            >
                              Request More Proof
                            </Button>
                          )}
                      </div>

                      {detailedDispute.evidenceList.length === 0 ? (
                        <div className="bg-[#121212] p-8 rounded-xl border border-white/5 text-center text-gray-400 space-y-2">
                          <FolderOpen className="w-8 h-8 mx-auto text-gray-600" />
                          <p className="text-xs">No evidence documents uploaded yet.</p>
                          <p className="text-[11px] text-gray-500">
                            You can request additional receipts or screenshots from the buyer or seller.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {detailedDispute.evidenceList.map((item: any, idx: number) => {
                            const isImage =
                              item.url?.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                              item.name?.match(/\.(jpeg|jpg|png|webp)($|\?)/i);

                            return (
                              <div
                                key={item.id || idx}
                                className="bg-[#121212] p-3.5 rounded-xl border border-white/5 space-y-2 flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-white truncate text-xs block">
                                      {item.name || `Evidence File #${idx + 1}`}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-gray-300 font-semibold shrink-0">
                                      {item.uploaderRole || "PARTY"}
                                    </span>
                                  </div>
                                  {item.description && (
                                    <p className="text-gray-400 text-[11px] mt-1 italic">"{item.description}"</p>
                                  )}
                                  <span className="text-[10px] text-gray-500 block mt-1">
                                    Uploaded: {new Date(item.uploadedAt).toLocaleString()}
                                  </span>
                                </div>

                                <div className="pt-2 border-t border-white/5 flex items-center justify-end gap-2">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View / Download Document
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: CHAT TRANSCRIPT */}
                  {activeTab === "chat" && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                          Live Counterparty Trade Messages
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          Complete tamper-evident conversation between buyer and seller recorded in escrow.
                        </p>
                      </div>

                      <div className="bg-[#121212] p-4 rounded-xl border border-white/5 max-h-[380px] overflow-y-auto space-y-2.5">
                        {detailedDispute.chatMessages.length === 0 ? (
                          <p className="text-gray-500 text-center py-8 text-xs">No chat messages exchanged.</p>
                        ) : (
                          detailedDispute.chatMessages.map((msg: any) => {
                            const isSystem = msg.type === "SYSTEM" || msg.senderRole === "SYSTEM";
                            const isBuyer = msg.senderRole === "BUYER";

                            if (isSystem) {
                              return (
                                <div key={msg.id} className="text-center my-2">
                                  <span className="inline-block bg-white/5 text-gray-400 text-[10px] px-3 py-1 rounded-full border border-white/5 max-w-[85%] leading-relaxed">
                                    {msg.content}
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={msg.id}
                                className={`flex ${isBuyer ? "justify-start" : "justify-end"}`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-xl p-2.5 text-xs ${
                                    isBuyer
                                      ? "bg-[#1E202B] text-gray-200 border border-white/10"
                                      : "bg-[#00A070]/20 text-emerald-200 border border-[#00A070]/30"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3 text-[10px] mb-1 font-bold">
                                    <span className={isBuyer ? "text-amber-400" : "text-[#00A070]"}>
                                      {msg.senderName} ({msg.senderRole})
                                    </span>
                                    <span className="text-gray-500 font-normal">
                                      {new Date(msg.createdAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  <p className="break-words leading-relaxed">{msg.content}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: CASE TIMELINE & INTERNAL NOTES */}
                  {activeTab === "timeline" && (
                    <div className="space-y-4">
                      {/* Add Note Form */}
                      <form onSubmit={handleAddNote} className="bg-[#121212] p-3.5 rounded-xl border border-white/5 space-y-2">
                        <label className="text-xs font-bold text-gray-300 block">
                          Add Internal Administrator Note (Confidential)
                        </label>
                        <textarea
                          rows={2}
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder="Record findings, banking inquiry logs, or internal staff remarks..."
                          className="w-full rounded-xl border border-white/10 bg-[#161822] p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isAddingNote || !newNoteText.trim()}
                            className="bg-white/10 hover:bg-white/20 text-white text-xs h-8"
                          >
                            {isAddingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                            Save Note to Case
                          </Button>
                        </div>
                      </form>

                      {/* Timeline Events */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-gray-300 text-xs uppercase tracking-wider">
                          Chronological Activity Log
                        </h4>
                        <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-3">
                          {detailedDispute.timeline.length === 0 ? (
                            <p className="text-gray-500 text-center py-4 text-xs">No activity records logged.</p>
                          ) : (
                            detailedDispute.timeline.map((ev: any, idx: number) => (
                              <div key={ev.id || idx} className="border-l-2 border-amber-500/40 pl-3 py-0.5 space-y-1">
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="font-bold text-white">
                                    {ev.type?.replace(/_/g, " ") || "EVENT"}
                                  </span>
                                  <span className="text-gray-500 text-[10px]">
                                    {new Date(ev.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-gray-400 text-xs">
                                  By:{" "}
                                  <strong className="text-gray-300">
                                    {ev.adminName || ev.name || ev.actor}
                                  </strong>
                                  {ev.decision ? ` • Ruling: ${ev.decision}` : ""}
                                  {ev.reason ? ` • ${ev.reason}` : ""}
                                  {ev.note ? ` • Note: ${ev.note}` : ""}
                                  {ev.details ? ` • ${ev.details}` : ""}
                                  {ev.message ? ` • ${ev.message}` : ""}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Request Evidence Modal */}
      {showRequestEvidenceModal && (
        <Dialog open={showRequestEvidenceModal} onOpenChange={setShowRequestEvidenceModal}>
          <DialogContent className="sm:max-w-md bg-[#161822] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-amber-400" /> Request Additional Evidence
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-xs">
                Dispatches an official notification to the selected counterparty to upload receipts or statements.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleRequestEvidenceSubmit} className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Target Counterparty</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "BUYER", label: "Buyer Only" },
                    { id: "SELLER", label: "Seller Only" },
                    { id: "BOTH", label: "Both Parties" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEvidenceTarget(t.id as any)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        evidenceTarget === t.id
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-[#121212] text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Specific Evidence Requested</label>
                <textarea
                  rows={3}
                  value={evidenceRequestNote}
                  onChange={(e) => setEvidenceRequestNote(e.target.value)}
                  placeholder="e.g. Please upload an official PDF bank account statement or video proof showing the transaction reference..."
                  className="w-full rounded-xl border border-white/10 bg-[#121212] p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRequestEvidenceModal(false)}
                  className="border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isRequestingEvidence || !evidenceRequestNote.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  {isRequestingEvidence ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Send Evidence Request
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Adjudicate Ruling Modal */}
      {showResolveModal && detailedDispute && (
        <Dialog open={showResolveModal} onOpenChange={setShowResolveModal}>
          <DialogContent className="sm:max-w-lg bg-[#161822] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" /> Adjudicate Dispute #{detailedDispute.disputeNumber}
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-xs">
                Authorizing an escrow ruling executes an irreversible ledger adjustment in accordance with P2P platform rules.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleResolveSubmit} className="space-y-4 py-2 text-xs">
              <div className="bg-[#121212] p-3 rounded-xl border border-white/5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Order:</span>
                  <span className="font-bold text-white">#{detailedDispute.order?.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Locked Escrow Volume:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {detailedDispute.order?.cryptoAmount} {detailedDispute.order?.asset}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Select Official Ruling
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                    decision === "BUYER_WINS"
                      ? "border-[#00A070] bg-[#00A070]/10 text-white"
                      : "border-white/10 bg-[#121212] text-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value="BUYER_WINS"
                    checked={decision === "BUYER_WINS"}
                    onChange={() => setDecision("BUYER_WINS")}
                    className="mt-0.5 accent-[#00A070]"
                  />
                  <div>
                    <span className="font-bold text-white block">Buyer Wins (Release Escrow to Buyer)</span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      Evidence confirms fiat payment was deposited into seller account. Crypto released to buyer wallet.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                    decision === "SELLER_WINS"
                      ? "border-amber-500 bg-amber-500/10 text-white"
                      : "border-white/10 bg-[#121212] text-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value="SELLER_WINS"
                    checked={decision === "SELLER_WINS"}
                    onChange={() => setDecision("SELLER_WINS")}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div>
                    <span className="font-bold text-white block">Seller Wins (Return Escrow to Seller)</span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      Payment was not received or claim is illegitimate. Crypto returned to seller balance.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                    decision === "DISMISSED"
                      ? "border-red-500 bg-red-500/10 text-white"
                      : "border-white/10 bg-[#121212] text-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value="DISMISSED"
                    checked={decision === "DISMISSED"}
                    onChange={() => setDecision("DISMISSED")}
                    className="mt-0.5 accent-red-500"
                  />
                  <div>
                    <span className="font-bold text-white block">Dismiss Claim (Cancel Order)</span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      Case dismissed without awarding claim to buyer. Order cancelled.
                    </span>
                  </div>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  Administrative Ruling Rationale (Mandatory)
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="State the justification, banking reference checks, or policy rationale for this ruling..."
                  className="w-full rounded-xl border border-white/10 bg-[#121212] p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResolveModal(false)}
                  className="border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isResolving || !resolutionNotes.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  {isResolving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Authorize Escrow Disposition
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Reopen Dispute Modal */}
      {showReopenModal && detailedDispute && (
        <Dialog open={showReopenModal} onOpenChange={setShowReopenModal}>
          <DialogContent className="sm:max-w-md bg-[#161822] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" /> Reopen Dispute #{detailedDispute.disputeNumber}
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-xs">
                Reopening a closed dispute returns the order to DISPUTED status and logs the administrative reason in the audit trail.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleReopenSubmit} className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Justification for Reopening</label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Counterparty produced verified banking confirmation letter showing transfer was completed..."
                  className="w-full rounded-xl border border-white/10 bg-[#121212] p-3 text-xs text-white focus:outline-none focus:border-rose-400"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReopenModal(false)}
                  className="border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isReopening || !reopenReason.trim()}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  {isReopening ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirm Reopen
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function AdminP2PDisputesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mr-3" />
          <span>Loading dispute management console...</span>
        </div>
      }
    >
      <AdminP2PDisputesContent />
    </Suspense>
  );
}
