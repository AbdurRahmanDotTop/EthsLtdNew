"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Star,
  Award,
  Clock,
  ShieldCheck,
  MessageSquare,
  FileSignature,
  Send,
  CheckCircle,
  X,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { getAvailableRms, sendRmConnectionRequest, cancelRmConnectionRequest } from "@/actions/rm";
import { getAuthSession } from "@/actions/auth";
import { toast } from "sonner";

export default function RelationshipManagersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [rms, setRms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");

  // Connect Modal State
  const [selectedRm, setSelectedRm] = useState<any | null>(null);
  const [connectMessage, setConnectMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [session, res] = await Promise.all([
        getAuthSession(),
        getAvailableRms({ search: search.trim() }),
      ]);
      setCurrentUser(session);
      if (res.success && res.rms) {
        setRms(res.rms);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load Relationship Managers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    getAvailableRms({ search: search.trim() })
      .then((res) => {
        if (res.success && res.rms) setRms(res.rms);
      })
      .finally(() => setLoading(false));
  };

  const handleOpenConnectModal = (rm: any) => {
    if (!currentUser) {
      toast.error("Please log in to connect with a Relationship Manager.");
      router.push(`/login?redirect=/relationship-managers`);
      return;
    }
    setSelectedRm(rm);
    setConnectMessage("");
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRm) return;

    setIsSubmitting(true);
    try {
      const res = await sendRmConnectionRequest(selectedRm.id, connectMessage);
      if (res.success) {
        toast.success(res.message || "Connection request sent successfully!");
        setSelectedRm(null);
        setConnectMessage("");
        loadData();
      } else {
        toast.error(res.error || "Failed to send request.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (connectionId: string) => {
    try {
      const res = await cancelRmConnectionRequest(connectionId);
      if (res.success) {
        toast.info("Connection request cancelled.");
        loadData();
      } else {
        toast.error(res.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filteredRms = rms.filter((rm) => {
    if (activeCategory === "ALL") return true;
    if (activeCategory === "FUTURES") {
      return rm.specialties?.toLowerCase().includes("perpetual") || rm.specialties?.toLowerCase().includes("futures");
    }
    if (activeCategory === "OPTIONS") {
      return rm.specialties?.toLowerCase().includes("option") || rm.specialties?.toLowerCase().includes("derivatives");
    }
    if (activeCategory === "WEALTH") {
      return rm.department?.toLowerCase().includes("wealth") || rm.specialties?.toLowerCase().includes("hedging");
    }
    return true;
  });

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#161822] via-[#1A1C28] to-[#12131A] border border-white/10 p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00A070]/15 border border-[#00A070]/30 text-[#00A070] text-xs font-bold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" />
            <span>Institutional Private Advisory</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Certified Relationship Managers
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
            Connect directly with licensed crypto trading specialists for customized risk management, institutional perpetual execution, structured derivatives advisory, and confidential 1-on-1 private messaging.
          </p>

          {/* Workflow Steps Indicator */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/5">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0">
                1
              </div>
              <div className="text-xs">
                <div className="font-semibold text-white">Select RM</div>
                <div className="text-[11px] text-gray-400">Send connection request</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <div className="text-xs">
                <div className="font-semibold text-white">Sign Digital Contract</div>
                <div className="text-[11px] text-gray-400">Both parties sign terms</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-[#00A070]/20 text-[#00A070] font-bold text-xs flex items-center justify-center shrink-0">
                3
              </div>
              <div className="text-xs">
                <div className="font-semibold text-white">Private Chat Unlocked</div>
                <div className="text-[11px] text-gray-400">Direct encrypted advisory</div>
              </div>
            </div>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00A070]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "ALL", label: "All Specialists" },
            { id: "FUTURES", label: "Futures & Leverage" },
            { id: "OPTIONS", label: "Options & Arbitrage" },
            { id: "WEALTH", label: "Wealth & Hedging" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? "bg-[#00A070] text-white shadow-lg shadow-[#00A070]/20"
                  : "bg-[#161822] text-gray-400 hover:text-white hover:bg-[#1E202B] border border-white/5"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by name, RM code, specialty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161822] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070] transition-colors"
          />
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </form>
      </div>

      {/* RM Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-80 rounded-2xl bg-[#161822] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredRms.length === 0 ? (
        <div className="text-center py-16 bg-[#161822] rounded-2xl border border-white/5 p-8 space-y-3">
          <Users className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Relationship Managers Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            No RM accounts matched your search filters. Try adjusting your search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRms.map((rm) => {
            const rel = rm.userRelationship;
            const status = rel?.status || "NOT_CONNECTED";
            const contract = rel?.contract;
            const isContractFullySigned = contract?.status === "FULLY_SIGNED";

            return (
              <div
                key={rm.id}
                className="group relative flex flex-col justify-between rounded-2xl bg-[#161822] border border-white/10 hover:border-[#00A070]/40 transition-all duration-200 overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-[#00A070]/5"
              >
                {/* Card Top Accent */}
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

                <div className="p-6 space-y-4">
                  {/* Header: Photo, Name, RM ID */}
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-[#1E202B] border-2 border-white/10 overflow-hidden flex items-center justify-center font-bold text-lg text-white">
                        {rm.avatarUrl ? (
                          <img src={rm.avatarUrl} alt={rm.name} className="w-full h-full object-cover" />
                        ) : (
                          rm.name.charAt(0)
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00A070] border-2 border-[#161822]" title="Online Specialist" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-white truncate">{rm.name}</h3>
                        <ShieldCheck className="w-4 h-4 text-[#00A070] shrink-0" />
                      </div>
                      <div className="text-[11px] text-[#00A070] font-mono font-bold tracking-wide">
                        {rm.rmCode}
                      </div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">{rm.designation}</div>
                    </div>
                  </div>

                  {/* Highlights Bar */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/5 text-center text-xs">
                    <div>
                      <div className="text-amber-400 font-bold flex items-center justify-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{rm.rating.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-gray-500">Rating</div>
                    </div>
                    <div>
                      <div className="text-white font-bold">{rm.experienceYears}+ Yrs</div>
                      <div className="text-[10px] text-gray-500">Experience</div>
                    </div>
                    <div>
                      <div className="text-cyan-400 font-bold">{rm.activeClientsCount}</div>
                      <div className="text-[10px] text-gray-500">Clients</div>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                    {rm.bio}
                  </p>

                  {/* Specialties Pills */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      Advisory Expertise
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {rm.specialties.split(",").slice(0, 3).map((spec: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-[#1E202B] border border-white/5 text-[11px] text-gray-300"
                        >
                          {spec.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Relationship Status & Action Buttons */}
                <div className="p-4 bg-[#14151E] border-t border-white/5 space-y-2">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-gray-500 font-medium">Relationship Status:</span>
                    {status === "NOT_CONNECTED" && (
                      <span className="text-gray-400 font-semibold text-[11px]">Not Connected</span>
                    )}
                    {status === "REQUESTED" && (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-semibold text-[11px]">
                        <Clock className="w-3 h-3" /> Request Pending
                      </span>
                    )}
                    {(status === "CONTRACT_PENDING" || status === "ACCEPTED") && !isContractFullySigned && (
                      <span className="inline-flex items-center gap-1 text-sky-400 font-semibold text-[11px]">
                        <FileSignature className="w-3 h-3" /> Contract Pending
                      </span>
                    )}
                    {status === "ACTIVE" && isContractFullySigned && (
                      <span className="inline-flex items-center gap-1 text-[#00A070] font-bold text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5" /> Contract Signed & Active
                      </span>
                    )}
                    {status === "REJECTED" && (
                      <span className="text-rose-400 font-semibold text-[11px]">Request Declined</span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {status === "NOT_CONNECTED" && (
                    <button
                      onClick={() => handleOpenConnectModal(rm)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-bold shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Connect with RM</span>
                    </button>
                  )}

                  {status === "REQUESTED" && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold text-center">
                        Waiting for RM approval...
                      </div>
                      <button
                        onClick={() => handleCancelRequest(rel.connectionId)}
                        className="py-2 px-3 rounded-xl bg-white/5 hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 border border-white/5 text-xs font-medium transition-colors"
                        title="Cancel Request"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {(status === "CONTRACT_PENDING" || status === "ACCEPTED") && !isContractFullySigned && (
                    <Link
                      href={contract ? `/contracts/${contract.id}` : "#"}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/20 transition-all"
                    >
                      <FileSignature className="w-4 h-4" />
                      <span>Review & Sign Contract</span>
                    </Link>
                  )}

                  {status === "ACTIVE" && isContractFullySigned && (
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/rm/chat/${rel.connectionId}`}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-bold shadow-lg shadow-[#00A070]/20 transition-all"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Private Chat</span>
                      </Link>
                      <Link
                        href={contract ? `/contracts/${contract.id}` : "#"}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-gray-200 border border-white/10 text-xs font-semibold transition-all"
                      >
                        <FileSignature className="w-3.5 h-3.5 text-[#00A070]" />
                        <span>View Contract</span>
                      </Link>
                    </div>
                  )}

                  {status === "REJECTED" && (
                    <button
                      onClick={() => handleOpenConnectModal(rm)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-gray-300 text-xs font-semibold border border-white/10 transition-colors"
                    >
                      <RotateCcwIcon className="w-3.5 h-3.5" />
                      <span>Request Again</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection Request Modal */}
      {selectedRm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#161822] border border-white/10 p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00A070]/20 border border-[#00A070]/30 text-[#00A070] flex items-center justify-center font-bold">
                  {selectedRm.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Connect with {selectedRm.name}</h3>
                  <div className="text-xs text-[#00A070] font-mono">{selectedRm.rmCode} • {selectedRm.designation}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedRm(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explanatory notice */}
            <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-sky-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Two-Party Investment Agreement Protocol</span>
              </div>
              <p className="text-[11px] leading-relaxed text-sky-300/90">
                Upon acceptance, both you and {selectedRm.name} will be issued a digital <strong>ETH Investment Contract</strong>. Once both signatures are verified, 1-on-1 private messaging will automatically activate.
              </p>
            </div>

            {/* Request Form */}
            <form onSubmit={handleSendRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Introductory Note / Trading Goals (Optional):
                </label>
                <textarea
                  rows={3}
                  value={connectMessage}
                  onChange={(e) => setConnectMessage(e.target.value)}
                  placeholder="e.g. Seeking advisory for perpetual futures leverage management and risk hedging strategies..."
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070] transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRm(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-[#00A070]/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Sending Request..." : "Send Connection Request"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RotateCcwIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
