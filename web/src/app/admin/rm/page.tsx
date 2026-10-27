"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  PlusCircle,
  Edit,
  ArrowRightLeft,
  FileSignature,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  ExternalLink,
  Star,
  Trash2,
  KeyRound,
  Lock,
  Eye,
} from "lucide-react";
import {
  getAllRmsAdmin,
  createRmAdmin,
  updateRmProfileAdmin,
  reassignRmClientsAdmin,
  getAllContractsAdmin,
  getAllConnectionsAdmin,
  getRmDetailsAdmin,
  adminResetRmPassword,
  deleteRmAdmin,
  getAllRmReviewsAdmin,
  updateRmReviewAdmin,
  deleteRmReviewAdmin,
} from "@/actions/admin";
import { toast } from "sonner";

export default function AdminRelationshipManagementPage() {
  const [activeTab, setActiveTab] = useState<"RMS" | "CONNECTIONS" | "CONTRACTS" | "REASSIGN" | "REVIEWS">("RMS");
  const [loading, setLoading] = useState(true);

  // Data states
  const [rms, setRms] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewRatingFilter, setReviewRatingFilter] = useState<number>(0);
  const [reviewRmFilter, setReviewRmFilter] = useState<string>("ALL");

  // Create RM Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRmForm, setNewRmForm] = useState({
    name: "",
    email: "",
    password: "",
    designation: "Senior Crypto Wealth Relationship Manager",
    department: "Private Wealth & Institutional Trading",
    rmCode: "",
    specialties: "Perpetual Futures, Spot Hedging, Options, Portfolio Allocation",
    bio: "Experienced digital asset advisor.",
    phone: "",
    maxClients: 50,
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit RM Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRm, setEditingRm] = useState<any | null>(null);

  // Reassignment State
  const [fromRmId, setFromRmId] = useState("");
  const [toRmId, setToRmId] = useState("");
  const [reassignNotes, setReassignNotes] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);

  // RM Details Modal State
  const [viewingRmDetails, setViewingRmDetails] = useState<any | null>(null);
  const [isLoadingRmDetails, setIsLoadingRmDetails] = useState(false);

  // Reset RM Password Modal State
  const [resetPasswordRm, setResetPasswordRm] = useState<any | null>(null);
  const [newRmPassword, setNewRmPassword] = useState("");
  const [isSubmittingPasswordReset, setIsSubmittingPasswordReset] = useState(false);

  // Edit Review Modal State
  const [editingReview, setEditingReview] = useState<any | null>(null);
  const [editReviewRating, setEditReviewRating] = useState<number>(5);
  const [editReviewComment, setEditReviewComment] = useState("");
  const [editReviewStatus, setEditReviewStatus] = useState<"APPROVED" | "HIDDEN">("APPROVED");
  const [isSubmittingReviewEdit, setIsSubmittingReviewEdit] = useState(false);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [rmsData, connsData, contractsData, reviewsRes] = await Promise.all([
        getAllRmsAdmin(),
        getAllConnectionsAdmin(),
        getAllContractsAdmin(),
        getAllRmReviewsAdmin(),
      ]);
      setRms(rmsData);
      setConnections(connsData);
      setContracts(contractsData);
      if (reviewsRes.success && reviewsRes.reviews) {
        setReviews(reviewsRes.reviews);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load relationship management records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleCreateRmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRmForm.name || !newRmForm.email) {
      toast.error("Name and email are required.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await createRmAdmin({
        ...newRmForm,
        maxClients: Number(newRmForm.maxClients) || 50,
      });

      if (res.success) {
        toast.success(`Relationship Manager ${newRmForm.name} created successfully!`);
        setIsCreateModalOpen(false);
        setNewRmForm({
          name: "",
          email: "",
          password: "",
          designation: "Senior Crypto Wealth Relationship Manager",
          department: "Private Wealth & Institutional Trading",
          rmCode: "",
          specialties: "Perpetual Futures, Spot Hedging, Options, Portfolio Allocation",
          bio: "Experienced digital asset advisor.",
          phone: "",
          maxClients: 50,
        });
        loadAllData();
      } else {
        toast.error(res.error || "Failed to create RM.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenEdit = (rm: any) => {
    setEditingRm({
      userId: rm.id,
      name: rm.name || "",
      rmCode: rm.rmCode || "",
      designation: rm.designation || "",
      department: rm.department || "",
      status: rm.status === "BANNED" ? "SUSPENDED" : "ACTIVE",
      bio: rm.bio || "",
      specialties: rm.specialties || "",
      phone: rm.phone || "",
      maxClients: rm.maxClients || 50,
      rating: rm.rating !== undefined && rm.rating !== null ? Number(rm.rating) : 0,
      experienceYears: rm.experienceYears !== undefined && rm.experienceYears !== null ? Number(rm.experienceYears) : 0,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateRmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRm) return;

    try {
      const res = await updateRmProfileAdmin(editingRm);
      if (res.success) {
        toast.success("RM Profile updated successfully!");
        setIsEditModalOpen(false);
        setEditingRm(null);
        loadAllData();
      } else {
        toast.error(res.error || "Failed to update RM profile.");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleOpenRmDetails = async (rmId: string) => {
    setIsLoadingRmDetails(true);
    setViewingRmDetails({ id: rmId, loading: true });
    try {
      const res: any = await getRmDetailsAdmin(rmId);
      if (res.success && res.rm) {
        setViewingRmDetails(res.rm);
      } else {
        toast.error(res.error || "Failed to load RM details.");
        setViewingRmDetails(null);
      }
    } catch (e: any) {
      toast.error(e.message);
      setViewingRmDetails(null);
    } finally {
      setIsLoadingRmDetails(false);
    }
  };

  const handleDeleteRm = async (rm: any) => {
    if (
      !confirm(
        `Are you sure you want to deactivate and archive Relationship Manager ${
          rm.name || rm.email
        }? This will set their account to inactive while keeping past transaction records safe.`
      )
    ) {
      return;
    }

    try {
      const res = await deleteRmAdmin(rm.id);
      if (res.success) {
        toast.success(res.message);
        loadAllData();
      } else {
        toast.error(res.error || "Failed to deactivate RM.");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleOpenResetPassword = (rm: any) => {
    setResetPasswordRm(rm);
    setNewRmPassword("");
  };

  const handleSubmitPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordRm || !newRmPassword.trim()) return;

    if (newRmPassword.trim().length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsSubmittingPasswordReset(true);
    try {
      const res = await adminResetRmPassword(resetPasswordRm.id, newRmPassword.trim());
      if (res.success) {
        toast.success(res.message);
        setResetPasswordRm(null);
        setNewRmPassword("");
      } else {
        toast.error(res.error || "Failed to reset password.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmittingPasswordReset(false);
    }
  };

  const handleOpenEditReview = (rev: any) => {
    setEditingReview(rev);
    setEditReviewRating(rev.rating);
    setEditReviewComment(rev.comment || "");
    setEditReviewStatus(rev.status || "APPROVED");
  };

  const handleUpdateReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;

    setIsSubmittingReviewEdit(true);
    try {
      const res = await updateRmReviewAdmin(editingReview.id, {
        rating: editReviewRating,
        comment: editReviewComment,
        status: editReviewStatus,
      });

      if (res.success) {
        toast.success("Review updated successfully!");
        setEditingReview(null);
        loadAllData();
      } else {
        toast.error(res.error || "Failed to update review.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmittingReviewEdit(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this client review? RM statistics will be recalculated immediately."
      )
    ) {
      return;
    }

    try {
      const res = await deleteRmReviewAdmin(reviewId);
      if (res.success) {
        toast.success(res.message);
        loadAllData();
      } else {
        toast.error(res.error || "Failed to delete review.");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromRmId || !toRmId) {
      toast.error("Please select both source and target Relationship Managers.");
      return;
    }

    if (fromRmId === toRmId) {
      toast.error("Source and target RM cannot be identical.");
      return;
    }

    setIsReassigning(true);
    try {
      const res = await reassignRmClientsAdmin({
        fromRmId,
        toRmId,
        notes: reassignNotes,
      });

      if (res.success) {
        toast.success(res.message);
        setReassignNotes("");
        setFromRmId("");
        setToRmId("");
        loadAllData();
      } else {
        toast.error(res.error || "Reassignment failed.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-[#00A070]" />
            <span>Relationship Management Console</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage certified RM profiles, supervise connection requests, track digital contracts, and administer client reassignments.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-bold shadow-lg shadow-[#00A070]/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New RM</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: "RMS", label: `Relationship Managers (${rms.length})` },
          { id: "REVIEWS", label: `Ratings & Reviews (${reviews.length})` },
          { id: "CONNECTIONS", label: `Connection Requests (${connections.length})` },
          { id: "CONTRACTS", label: `Investment Contracts (${contracts.length})` },
          { id: "REASSIGN", label: "RM Client Reassignment" },
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

      {/* TAB 1: RM DIRECTORY */}
      {activeTab === "RMS" && (
        <div className="rounded-2xl bg-[#161822] border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#14151E] text-gray-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-4 font-semibold">RM Name / Code</th>
                  <th className="py-3 px-4 font-semibold">Designation & Department</th>
                  <th className="py-3 px-4 font-semibold">Active Clients</th>
                  <th className="py-3 px-4 font-semibold">Rating</th>
                  <th className="py-3 px-4 font-semibold">Account Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {rms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      No Relationship Managers configured yet.
                    </td>
                  </tr>
                ) : (
                  rms.map((rm) => (
                    <tr key={rm.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white text-xs shrink-0 overflow-hidden">
                            {rm.avatarUrl ? (
                              <img src={rm.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              rm.name?.charAt(0) || "R"
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{rm.name}</span>
                              <span className="text-[10px] text-gray-500 font-mono">UID: #{rm.uid}</span>
                            </div>
                            <div className="text-[11px] text-[#00A070] font-mono font-semibold">{rm.rmCode} • {rm.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-200 font-medium">{rm.designation}</div>
                        <div className="text-[10px] text-gray-500">{rm.department}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-white">{rm.activeClientsCount}</span>
                        <span className="text-gray-500 text-[10px]"> / {rm.maxClients} max</span>
                      </td>
                      <td className="py-3 px-4">
                        {rm.totalRatings > 0 ? (
                          <div className="flex items-center gap-1 font-bold text-amber-400">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{rm.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-gray-500 font-normal">({rm.totalRatings})</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-[11px]">New (0 reviews)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rm.status === "ACTIVE"
                              ? "bg-[#00A070]/15 text-[#00A070] border border-[#00A070]/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {rm.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenRmDetails(rm.id)}
                            title="View Full RM Profile & Clients"
                            className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-gray-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(rm)}
                            title="Edit RM Profile"
                            className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-gray-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenResetPassword(rm)}
                            title="Reset RM Password"
                            className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-amber-400 hover:text-amber-300 border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRm(rm)}
                            title="Deactivate & Archive RM"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ALL CONNECTION REQUESTS */}
      {activeTab === "CONNECTIONS" && (
        <div className="rounded-2xl bg-[#161822] border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#14151E] text-gray-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-4 font-semibold">User (Client)</th>
                  <th className="py-3 px-4 font-semibold">Assigned RM</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Contract</th>
                  <th className="py-3 px-4 font-semibold">Requested At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {connections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      No connection requests recorded.
                    </td>
                  </tr>
                ) : (
                  connections.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{c.user?.name || c.user?.email}</div>
                        <div className="text-[10px] text-gray-500 font-mono">UID: #{c.user?.uid}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{c.rm?.name}</div>
                        <div className="text-[10px] text-[#00A070] font-mono">{c.rm?.rmProfile?.rmCode}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === "ACTIVE"
                              ? "bg-[#00A070]/15 text-[#00A070] border border-[#00A070]/30"
                              : c.status === "REQUESTED"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : c.status === "CONTRACT_PENDING"
                              ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {c.contracts?.[0] ? (
                          <Link
                            href={`/contracts/${c.contracts[0].id}`}
                            className="text-sky-400 hover:underline font-mono"
                          >
                            {c.contracts[0].contractNumber}
                          </Link>
                        ) : (
                          <span className="text-gray-500 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                        {new Date(c.requestedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL CONTRACTS */}
      {activeTab === "CONTRACTS" && (
        <div className="rounded-2xl bg-[#161822] border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#14151E] text-gray-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-4 font-semibold">Contract Number</th>
                  <th className="py-3 px-4 font-semibold">Client Party B</th>
                  <th className="py-3 px-4 font-semibold">RM Party A</th>
                  <th className="py-3 px-4 font-semibold">Signatures</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      No investment contracts recorded.
                    </td>
                  </tr>
                ) : (
                  contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white">{c.contractNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{c.user?.name || c.user?.email}</div>
                        <div className="text-[10px] text-gray-500 font-mono">UID: #{c.user?.uid}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{c.rm?.name}</div>
                        <div className="text-[10px] text-[#00A070] font-mono">{c.rm?.rmProfile?.rmCode}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              c.partyASignature ? "bg-[#00A070]" : "bg-gray-600"
                            }`}
                            title="Party A Signature"
                          />
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              c.partyBSignature ? "bg-[#00A070]" : "bg-gray-600"
                            }`}
                            title="Party B Signature"
                          />
                          <span className="text-[11px] text-gray-400 font-mono">
                            {c.partyASignature && c.partyBSignature
                              ? "2/2 Both Signed"
                              : c.partyASignature || c.partyBSignature
                              ? "1/2 Partial"
                              : "0/2 Unsigned"}
                          </span>
                        </div>
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
                          className="px-3 py-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-gray-200 hover:text-white border border-white/10 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#00A070]" />
                          <span>View</span>
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

      {/* TAB 4: RM CLIENT REASSIGNMENT TOOL */}
      {activeTab === "REASSIGN" && (
        <div className="max-w-2xl mx-auto rounded-2xl bg-[#161822] border border-white/10 p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#00A070]" />
              <span>Administrative RM Client Reassignment</span>
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              When an RM departs or changes roles, execute a clean batch reassignment of all their client relationships, active contracts, and conversation pointers to another Relationship Manager. No historical records or client agreements are lost.
            </p>
          </div>

          <form onSubmit={handleReassignSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                From Relationship Manager (Source):
              </label>
              <select
                value={fromRmId}
                onChange={(e) => setFromRmId(e.target.value)}
                className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00A070]"
              >
                <option value="">-- Select Source RM --</option>
                {rms.map((rm) => (
                  <option key={rm.id} value={rm.id}>
                    {rm.name} ({rm.rmCode}) — {rm.activeClientsCount} Clients
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                To Relationship Manager (Destination):
              </label>
              <select
                value={toRmId}
                onChange={(e) => setToRmId(e.target.value)}
                className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00A070]"
              >
                <option value="">-- Select Destination RM --</option>
                {rms
                  .filter((rm) => rm.id !== fromRmId && rm.status === "ACTIVE")
                  .map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.name} ({rm.rmCode}) — {rm.activeClientsCount} Clients (Capacity: {rm.maxClients})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Reassignment Reason & Audit Notes:
              </label>
              <textarea
                rows={3}
                value={reassignNotes}
                onChange={(e) => setReassignNotes(e.target.value)}
                placeholder="e.g. RM staff transition; accounts transferred to Senior Wealth Director."
                className="w-full bg-[#10121A] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070] resize-none"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Reassignment Policy Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200/90">
                All connected clients will receive an automated in-app notification about their newly assigned Relationship Manager.
              </p>
            </div>

            <button
              type="submit"
              disabled={isReassigning || !fromRmId || !toRmId}
              className="w-full py-3 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-[#00A070]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{isReassigning ? "Executing Reassignment..." : "Execute Client Reassignment"}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: RATINGS & REVIEWS MANAGEMENT */}
      {activeTab === "REVIEWS" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-[#161822] border border-white/10 rounded-2xl">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search reviews by user, RM, or keyword..."
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                className="w-full bg-[#10121A] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
              />
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={reviewRmFilter}
                onChange={(e) => setReviewRmFilter(e.target.value)}
                className="bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
              >
                <option value="ALL">All Managers</option>
                {rms.map((rm) => (
                  <option key={rm.id} value={rm.id}>
                    {rm.name} ({rm.rmCode})
                  </option>
                ))}
              </select>

              <select
                value={reviewRatingFilter}
                onChange={(e) => setReviewRatingFilter(Number(e.target.value))}
                className="bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
              >
                <option value={0}>All Stars</option>
                <option value={5}>5 Stars ★★★★★</option>
                <option value={4}>4 Stars ★★★★☆</option>
                <option value={3}>3 Stars ★★★☆☆</option>
                <option value={2}>2 Stars ★★☆☆☆</option>
                <option value={1}>1 Star ★☆☆☆☆</option>
              </select>
            </div>
          </div>

          {/* Reviews Table */}
          <div className="rounded-2xl bg-[#161822] border border-white/10 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14151E] text-gray-400 border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Client (Investor)</th>
                    <th className="py-3 px-4 font-semibold">Relationship Manager</th>
                    <th className="py-3 px-4 font-semibold">Rating Score</th>
                    <th className="py-3 px-4 font-semibold">Client Feedback</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Submission Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {reviews
                    .filter((rev) => {
                      if (reviewRmFilter !== "ALL" && rev.rm?.id !== reviewRmFilter && rev.rmId !== reviewRmFilter) {
                        return false;
                      }
                      if (reviewRatingFilter > 0 && rev.rating !== reviewRatingFilter) {
                        return false;
                      }
                      if (reviewSearch.trim()) {
                        const q = reviewSearch.toLowerCase().trim();
                        const matchUser = rev.user?.name?.toLowerCase().includes(q) || rev.user?.email?.toLowerCase().includes(q) || rev.user?.uid?.toString().includes(q);
                        const matchRm = rev.rm?.name?.toLowerCase().includes(q) || rev.rm?.rmProfile?.rmCode?.toLowerCase().includes(q);
                        const matchComment = rev.comment?.toLowerCase().includes(q);
                        return matchUser || matchRm || matchComment;
                      }
                      return true;
                    })
                    .length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        No client ratings or reviews found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    reviews
                      .filter((rev) => {
                        if (reviewRmFilter !== "ALL" && rev.rm?.id !== reviewRmFilter && rev.rmId !== reviewRmFilter) {
                          return false;
                        }
                        if (reviewRatingFilter > 0 && rev.rating !== reviewRatingFilter) {
                          return false;
                        }
                        if (reviewSearch.trim()) {
                          const q = reviewSearch.toLowerCase().trim();
                          const matchUser = rev.user?.name?.toLowerCase().includes(q) || rev.user?.email?.toLowerCase().includes(q) || rev.user?.uid?.toString().includes(q);
                          const matchRm = rev.rm?.name?.toLowerCase().includes(q) || rev.rm?.rmProfile?.rmCode?.toLowerCase().includes(q);
                          const matchComment = rev.comment?.toLowerCase().includes(q);
                          return matchUser || matchRm || matchComment;
                        }
                        return true;
                      })
                      .map((rev) => (
                        <tr key={rev.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{rev.user?.name || rev.user?.email}</div>
                            <div className="text-[10px] text-gray-500 font-mono">UID: #{rev.user?.uid} • {rev.user?.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{rev.rm?.name}</div>
                            <div className="text-[10px] text-[#00A070] font-mono">{rev.rm?.rmProfile?.rmCode}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 font-bold text-amber-400">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                              <span>{rev.rating}.0 / 5</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            {rev.comment ? (
                              <p className="text-gray-300 italic line-clamp-2">"{rev.comment}"</p>
                            ) : (
                              <span className="text-gray-500 italic">No written comment</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                rev.status === "APPROVED"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
                              }`}
                            >
                              {rev.status || "APPROVED"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                            {new Date(rev.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditReview(rev)}
                                title="Edit Review"
                                className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-gray-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteReview(rev.id)}
                                title="Delete Review"
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#161822] border border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Create New Relationship Manager</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRmSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newRmForm.name}
                    onChange={(e) => setNewRmForm({ ...newRmForm, name: e.target.value })}
                    placeholder="e.g. Jonathan Lee"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newRmForm.email}
                    onChange={(e) => setNewRmForm({ ...newRmForm, email: e.target.value })}
                    placeholder="jonathan.rm@ethsltd.com"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Password (Default: Rm@123456)</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newRmForm.password}
                    onChange={(e) => setNewRmForm({ ...newRmForm, password: e.target.value })}
                    placeholder="Rm@123456"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Unique RM User ID / Code (e.g. 1005, RM-1005)</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={newRmForm.rmCode}
                    onChange={(e) => setNewRmForm({ ...newRmForm, rmCode: e.target.value })}
                    placeholder="Leave blank to auto-generate"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Designation</label>
                <input
                  type="text"
                  value={newRmForm.designation}
                  onChange={(e) => setNewRmForm({ ...newRmForm, designation: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Department</label>
                <input
                  type="text"
                  value={newRmForm.department}
                  onChange={(e) => setNewRmForm({ ...newRmForm, department: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Specialties</label>
                <input
                  type="text"
                  value={newRmForm.specialties}
                  onChange={(e) => setNewRmForm({ ...newRmForm, specialties: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Bio / Profile Description</label>
                <textarea
                  rows={2}
                  value={newRmForm.bio}
                  onChange={(e) => setNewRmForm({ ...newRmForm, bio: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#00A070] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-50 text-white font-bold shadow-lg shadow-[#00A070]/20"
                >
                  {isSubmittingCreate ? "Creating RM..." : "Create RM Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RM MODAL */}
      {isEditModalOpen && editingRm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#161822] border border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Edit RM: {editingRm.name}</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRmSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingRm.name}
                    onChange={(e) => setEditingRm({ ...editingRm, name: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">RM User ID / Code</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={editingRm.rmCode || ""}
                    onChange={(e) => setEditingRm({ ...editingRm, rmCode: e.target.value })}
                    placeholder="e.g. 1005, RM-1005"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Status</label>
                  <select
                    value={editingRm.status}
                    onChange={(e) => setEditingRm({ ...editingRm, status: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="BUSY">BUSY</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Max Clients</label>
                  <input
                    type="number"
                    value={editingRm.maxClients}
                    onChange={(e) => setEditingRm({ ...editingRm, maxClients: Number(e.target.value) })}
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Designation</label>
                <input
                  type="text"
                  value={editingRm.designation}
                  onChange={(e) => setEditingRm({ ...editingRm, designation: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Department</label>
                <input
                  type="text"
                  value={editingRm.department}
                  onChange={(e) => setEditingRm({ ...editingRm, department: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Bio</label>
                <textarea
                  rows={2}
                  value={editingRm.bio}
                  onChange={(e) => setEditingRm({ ...editingRm, bio: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#00A070] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white font-bold shadow-lg shadow-[#00A070]/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* RM Details Modal */}
      {viewingRmDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00A070]/20 text-[#00A070] flex items-center justify-center font-bold text-sm">
                  {viewingRmDetails.name ? viewingRmDetails.name.charAt(0) : "R"}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{viewingRmDetails.name}</span>
                    <span className="text-xs text-[#00A070] font-mono font-bold">
                      {viewingRmDetails.rmProfile?.rmCode}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">{viewingRmDetails.email} • UID: #{viewingRmDetails.uid}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingRmDetails(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-xs">
              {/* Highlight Stats */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-3 bg-[#10121A] rounded-xl border border-white/5">
                  <div className="text-amber-400 font-bold text-sm flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{viewingRmDetails.rmProfile?.rating?.toFixed(1) || "0.0"}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Rating ({viewingRmDetails.rmProfile?.totalRatings || 0})
                  </div>
                </div>
                <div className="p-3 bg-[#10121A] rounded-xl border border-white/5">
                  <div className="text-cyan-400 font-bold text-sm">{viewingRmDetails.clients?.length || 0}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Assigned Clients</div>
                </div>
                <div className="p-3 bg-[#10121A] rounded-xl border border-white/5">
                  <div className="text-sky-400 font-bold text-sm">{viewingRmDetails.contracts?.length || 0}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Contracts</div>
                </div>
                <div className="p-3 bg-[#10121A] rounded-xl border border-white/5">
                  <div className="text-emerald-400 font-bold text-sm">{viewingRmDetails.status}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Account Status</div>
                </div>
              </div>

              {/* Assigned Clients */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center justify-between">
                  <span>Assigned Clients ({viewingRmDetails.clients?.length || 0})</span>
                </h4>
                {viewingRmDetails.clients?.length === 0 ? (
                  <div className="p-4 bg-[#10121A] rounded-xl text-center text-gray-500">
                    No clients currently assigned to this manager.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {viewingRmDetails.clients?.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2.5 bg-[#10121A] border border-white/5 rounded-xl"
                      >
                        <div>
                          <div className="font-semibold text-white">{c.user?.name || c.user?.email}</div>
                          <div className="text-[10px] text-gray-500 font-mono">UID: #{c.user?.uid} • {c.user?.email}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === "ACTIVE"
                              ? "bg-[#00A070]/15 text-[#00A070]"
                              : "bg-gray-500/15 text-gray-400"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Reviews */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Verified Client Reviews ({viewingRmDetails.reviews?.length || 0})
                </h4>
                {viewingRmDetails.reviews?.length === 0 ? (
                  <div className="p-4 bg-[#10121A] rounded-xl text-center text-gray-500">
                    No client reviews submitted yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {viewingRmDetails.reviews?.map((r: any) => (
                      <div key={r.id} className="p-3 bg-[#10121A] border border-white/5 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{r.user?.name || r.user?.email}</span>
                          <div className="flex items-center gap-1 text-amber-400 font-bold">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{r.rating}.0</span>
                          </div>
                        </div>
                        {r.comment && <p className="text-gray-300 italic">"{r.comment}"</p>}
                        <div className="text-[10px] text-gray-500 text-right">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-end shrink-0">
              <button
                onClick={() => setViewingRmDetails(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset RM Password Modal */}
      {resetPasswordRm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Reset RM Password</h3>
              </div>
              <button
                onClick={() => setResetPasswordRm(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPasswordReset} className="space-y-4">
              <p className="text-xs text-gray-400">
                Set a new login password for <strong>{resetPasswordRm.name || resetPasswordRm.email}</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  New Password (Minimum 6 characters):
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newRmPassword}
                  onChange={(e) => setNewRmPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordRm(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPasswordReset || !newRmPassword.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
                >
                  {isSubmittingPasswordReset ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Review Modal */}
      {editingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Moderate Review</h3>
              <button
                onClick={() => setEditingReview(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateReviewSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Rating Score (1-5)</label>
                <select
                  value={editReviewRating}
                  onChange={(e) => setEditReviewRating(Number(e.target.value))}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                >
                  <option value={5}>5 Stars ★★★★★</option>
                  <option value={4}>4 Stars ★★★★☆</option>
                  <option value={3}>3 Stars ★★★☆☆</option>
                  <option value={2}>2 Stars ★★☆☆☆</option>
                  <option value={1}>1 Star ★☆☆☆☆</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Status</label>
                <select
                  value={editReviewStatus}
                  onChange={(e) => setEditReviewStatus(e.target.value as any)}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                >
                  <option value="APPROVED">APPROVED (Visible to Public)</option>
                  <option value="HIDDEN">HIDDEN (Moderated/Suppressed)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Feedback Comment</label>
                <textarea
                  rows={3}
                  value={editReviewComment}
                  onChange={(e) => setEditReviewComment(e.target.value)}
                  className="w-full bg-[#10121A] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#00A070] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingReview(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReviewEdit}
                  className="px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-50 text-white font-bold shadow-lg shadow-[#00A070]/20"
                >
                  {isSubmittingReviewEdit ? "Saving..." : "Save Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
