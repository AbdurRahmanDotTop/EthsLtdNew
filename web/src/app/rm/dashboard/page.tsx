"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  FileSignature,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Settings,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Search,
  Filter,
} from "lucide-react";
import { getRmDashboardData, respondToConnectionRequest } from "@/actions/rm";
import { toast } from "sonner";

export default function RmDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"REQUESTS" | "CLIENTS" | "CONTRACTS" | "CONVERSATIONS">("REQUESTS");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Response modal
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const loadDashboard = async () => {
    try {
      const res = await getRmDashboardData();
      if (res.success) {
        setData(res);
      } else {
        toast.error(res.error || "Failed to load dashboard data");
        if (res.error?.includes("Unauthorized") || res.error?.includes("Authentication")) {
          router.push("/login?redirect=/rm/dashboard");
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Error loading dashboard");
      router.push("/login?redirect=/rm/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleAccept = async (connectionId: string) => {
    setProcessingId(connectionId);
    try {
      const res = await respondToConnectionRequest(connectionId, "ACCEPT");
      if (res.success) {
        toast.success(res.message);
        loadDashboard();
        if (res.contractId) {
          router.push(`/contracts/${res.contractId}`);
        }
      } else {
        toast.error(res.error || "Failed to accept request");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenReject = (req: any) => {
    setSelectedRequest(req);
    setRejectNotes("");
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setProcessingId(selectedRequest.id);
    try {
      const res = await respondToConnectionRequest(selectedRequest.id, "REJECT", rejectNotes);
      if (res.success) {
        toast.info("Connection request declined.");
        setIsRejectModalOpen(false);
        setSelectedRequest(null);
        loadDashboard();
      } else {
        toast.error(res.error || "Failed to decline request");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-16 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#00A070]/20 border-t-[#00A070] rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Loading Relationship Manager Console...</span>
      </div>
    );
  }

  const stats = data?.stats;
  const profile = data?.rmProfile;

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / RM Identity Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#161822] via-[#1B1D2A] to-[#141520] border border-white/10 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00A070]/15 border border-[#00A070]/30 text-[#00A070] text-xs font-bold uppercase tracking-wider font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>RM PORTAL • {profile?.rmCode || "LICENSED"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Relationship Manager Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 max-w-xl">
              {profile?.designation || "Senior Crypto Relationship Manager"} • {profile?.department || "Private Wealth"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/relationship-managers"
              className="px-4 py-2.5 rounded-xl bg-[#1E202B] hover:bg-[#252836] border border-white/10 text-gray-200 text-xs font-semibold transition-all flex items-center gap-2"
            >
              <span>Public Directory</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab("REQUESTS")}
          className={`cursor-pointer p-5 rounded-2xl border transition-all ${
            activeTab === "REQUESTS"
              ? "bg-[#00A070]/10 border-[#00A070] shadow-lg shadow-[#00A070]/10"
              : "bg-[#161822] border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Pending Requests</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            {stats?.pendingRequestsCount || 0}
          </div>
          <div className="text-[11px] text-amber-400 mt-1 font-medium">Require approval</div>
        </div>

        <div
          onClick={() => setActiveTab("CLIENTS")}
          className={`cursor-pointer p-5 rounded-2xl border transition-all ${
            activeTab === "CLIENTS"
              ? "bg-[#00A070]/10 border-[#00A070] shadow-lg shadow-[#00A070]/10"
              : "bg-[#161822] border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Active Clients</span>
            <Users className="w-4 h-4 text-[#00A070]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            {stats?.activeClientsCount || 0}
          </div>
          <div className="text-[11px] text-[#00A070] mt-1 font-medium">Fully connected</div>
        </div>

        <div
          onClick={() => setActiveTab("CONTRACTS")}
          className={`cursor-pointer p-5 rounded-2xl border transition-all ${
            activeTab === "CONTRACTS"
              ? "bg-[#00A070]/10 border-[#00A070] shadow-lg shadow-[#00A070]/10"
              : "bg-[#161822] border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Pending Contracts</span>
            <FileSignature className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            {stats?.pendingContractsCount || 0}
          </div>
          <div className="text-[11px] text-sky-400 mt-1 font-medium">Awaiting signature</div>
        </div>

        <div
          onClick={() => setActiveTab("CONVERSATIONS")}
          className={`cursor-pointer p-5 rounded-2xl border transition-all ${
            activeTab === "CONVERSATIONS"
              ? "bg-[#00A070]/10 border-[#00A070] shadow-lg shadow-[#00A070]/10"
              : "bg-[#161822] border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Unread Messages</span>
            <MessageSquare className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            {stats?.unreadMessagesCount || 0}
          </div>
          <div className="text-[11px] text-purple-400 mt-1 font-medium">Active channels</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: "REQUESTS", label: `Connection Requests (${data?.pendingRequests?.length || 0})` },
          { id: "CLIENTS", label: `Connected Clients (${data?.activeClients?.length || 0})` },
          { id: "CONTRACTS", label: `Contracts Tracker (${data?.contracts?.length || 0})` },
          { id: "CONVERSATIONS", label: `Active Conversations (${data?.conversations?.length || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#00A070] text-white shadow-md shadow-[#00A070]/20"
                : "text-gray-400 hover:text-white hover:bg-[#1E202B]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Connection Requests */}
      {activeTab === "REQUESTS" && (
        <div className="space-y-4">
          {data?.pendingRequests?.length === 0 ? (
            <div className="text-center py-16 bg-[#161822] rounded-2xl border border-white/5 space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Pending Requests</h3>
              <p className="text-xs text-gray-400">You are all caught up! New client requests will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data?.pendingRequests?.map((req: any) => (
                <div
                  key={req.id}
                  className="rounded-2xl bg-[#161822] border border-white/10 p-5 space-y-4 shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center font-bold text-white text-sm">
                          {req.user?.avatarUrl ? (
                            <img src={req.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            req.user?.name?.charAt(0) || "U"
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{req.user?.name || req.user?.email}</div>
                          <div className="text-xs text-gray-400 font-mono">UID: #{req.user?.uid}</div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        REQUESTED
                      </span>
                    </div>

                    {req.requestMessage && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-gray-300">
                        <span className="text-[10px] text-gray-500 block font-semibold mb-0.5">Client Note:</span>
                        &ldquo;{req.requestMessage}&rdquo;
                      </div>
                    )}

                    <div className="text-[11px] text-gray-500">
                      Received: {new Date(req.requestedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={processingId === req.id}
                      className="py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-[#00A070]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{processingId === req.id ? "Processing..." : "Accept & Issue Contract"}</span>
                    </button>
                    <button
                      onClick={() => handleOpenReject(req)}
                      disabled={processingId === req.id}
                      className="py-2.5 rounded-xl bg-[#1E202B] hover:bg-rose-500/15 text-gray-300 hover:text-rose-400 border border-white/10 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Connected Clients */}
      {activeTab === "CLIENTS" && (
        <div className="rounded-2xl bg-[#161822] border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#14151E] text-gray-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-4 font-semibold">Client Name / UID</th>
                  <th className="py-3 px-4 font-semibold">KYC Status</th>
                  <th className="py-3 px-4 font-semibold">Contract Status</th>
                  <th className="py-3 px-4 font-semibold">Connected At</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {data?.activeClients?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      No connected clients yet.
                    </td>
                  </tr>
                ) : (
                  data?.activeClients?.map((conn: any) => {
                    const contract = conn.contracts?.[0];
                    const isFullySigned = contract?.status === "FULLY_SIGNED";

                    return (
                      <tr key={conn.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{conn.user?.name || conn.user?.email}</div>
                          <div className="text-[11px] text-gray-500 font-mono">UID: #{conn.user?.uid}</div>
                        </td>
                        <td className="py-3 px-4">
                          {conn.user?.isKycVerified ? (
                            <span className="text-[#00A070] font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <span className="text-gray-500">Unverified</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isFullySigned ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00A070]/15 text-[#00A070] border border-[#00A070]/30">
                              Active Contract
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              Signing Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                          {new Date(conn.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isFullySigned && (
                              <Link
                                href={`/rm/chat/${conn.id}`}
                                className="px-3 py-1.5 rounded-lg bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-bold transition-all flex items-center gap-1"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Chat</span>
                              </Link>
                            )}
                            {contract && (
                              <Link
                                href={`/contracts/${contract.id}`}
                                className="px-3 py-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-gray-300 text-xs font-semibold border border-white/10 transition-colors"
                              >
                                Contract
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Contracts Tracker */}
      {activeTab === "CONTRACTS" && (
        <div className="rounded-2xl bg-[#161822] border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#14151E] text-gray-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-4 font-semibold">Contract Number</th>
                  <th className="py-3 px-4 font-semibold">Client</th>
                  <th className="py-3 px-4 font-semibold">Party A (RM)</th>
                  <th className="py-3 px-4 font-semibold">Party B (Client)</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {data?.contracts?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      No contracts issued yet.
                    </td>
                  </tr>
                ) : (
                  data?.contracts?.map((c: any) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white">{c.contractNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{c.user?.name || c.user?.email}</div>
                        <div className="text-[10px] text-gray-500 font-mono">UID: #{c.user?.uid}</div>
                      </td>
                      <td className="py-3 px-4">
                        {c.partyASignature ? (
                          <span className="text-[#00A070] font-semibold text-[11px] flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Signed
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold text-[11px]">Pending RM Signature</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {c.partyBSignature ? (
                          <span className="text-[#00A070] font-semibold text-[11px] flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Signed
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Pending Client</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === "FULLY_SIGNED"
                              ? "bg-[#00A070]/15 text-[#00A070] border border-[#00A070]/30"
                              : "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          <FileSignature className="w-3 h-3" />
                          <span>Review & Sign</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Active Conversations */}
      {activeTab === "CONVERSATIONS" && (
        <div className="space-y-3">
          {data?.conversations?.length === 0 ? (
            <div className="text-center py-16 bg-[#161822] rounded-2xl border border-white/5 space-y-2">
              <MessageSquare className="w-10 h-10 text-gray-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Active Conversations</h3>
              <p className="text-xs text-gray-400">Conversations unlock automatically when an ETH Investment Contract is fully signed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data?.conversations?.map((conv: any) => (
                <Link
                  key={conv.id}
                  href={`/rm/chat/${conv.connectionId}`}
                  className="p-4 rounded-2xl bg-[#161822] border border-white/10 hover:border-[#00A070]/50 hover:bg-[#1A1C28] transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white shrink-0">
                      {conv.user?.name?.charAt(0) || "U"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate group-hover:text-[#00A070] transition-colors">
                        {conv.user?.name || conv.user?.email}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-xs mt-0.5">
                        {conv.messages?.[0]?.text || "Private conversation started..."}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decline Modal */}
      {isRejectModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#161822] border border-white/10 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Decline Connection Request</h3>
            <p className="text-xs text-gray-400">
              Provide an optional explanation for declining {selectedRequest.user?.name || selectedRequest.user?.email}:
            </p>
            <form onSubmit={handleConfirmReject} className="space-y-4">
              <textarea
                rows={3}
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="e.g. Current client capacity is full, or profile outside focus area..."
                className="w-full bg-[#10121A] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 resize-none"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId !== null}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20"
                >
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
