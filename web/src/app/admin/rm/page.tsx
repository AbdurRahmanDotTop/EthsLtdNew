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
  Eye,
  AlertTriangle,
  X,
  ExternalLink,
} from "lucide-react";
import {
  getAllRmsAdmin,
  createRmAdmin,
  updateRmProfileAdmin,
  reassignRmClientsAdmin,
  getAllContractsAdmin,
  getAllConnectionsAdmin,
} from "@/actions/admin";
import { toast } from "sonner";

export default function AdminRelationshipManagementPage() {
  const [activeTab, setActiveTab] = useState<"RMS" | "CONNECTIONS" | "CONTRACTS" | "REASSIGN">("RMS");
  const [loading, setLoading] = useState(true);

  // Data states
  const [rms, setRms] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

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

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [rmsData, connsData, contractsData] = await Promise.all([
        getAllRmsAdmin(),
        getAllConnectionsAdmin(),
        getAllContractsAdmin(),
      ]);
      setRms(rmsData);
      setConnections(connsData);
      setContracts(contractsData);
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
      rating: rm.rating || 4.9,
      experienceYears: rm.experienceYears || 5,
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
                  <th className="py-3 px-4 font-semibold">Contracts</th>
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
                            <div className="font-bold text-white">{rm.name}</div>
                            <div className="text-[11px] text-[#00A070] font-mono">{rm.rmCode} • {rm.email}</div>
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
                        <span className="font-bold text-cyan-400">{rm.contractsCount}</span>
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
                        <button
                          onClick={() => handleOpenEdit(rm)}
                          className="px-3 py-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-gray-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
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
    </div>
  );
}
