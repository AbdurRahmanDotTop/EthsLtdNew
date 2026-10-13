"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getAdminChannelTypes,
  createAdminChannelType,
  updateAdminChannelType,
  toggleAdminChannelType,
  deleteAdminChannelType,
  createAdminChannelField,
  updateAdminChannelField,
  deleteAdminChannelField,
  reorderAdminChannelFields,
  ChannelFieldInput,
  ChannelTypeInput,
} from "@/actions/admin";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  Layers,
  Landmark,
  QrCode,
  Wallet,
  Banknote,
  Globe,
  Shield,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  X,
  ListPlus,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

const ICON_MAP: Record<string, any> = {
  Landmark,
  QrCode,
  Wallet,
  Banknote,
  CreditCard,
  Globe,
  Shield,
};

export default function AdminChannelTypesPage() {
  const [channelTypes, setChannelTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Expanded channel IDs for viewing fields
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Channel Modal State
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<any | null>(null);
  const [channelForm, setChannelForm] = useState<ChannelTypeInput>({
    name: "",
    identifier: "",
    description: "",
    icon: "Landmark",
    displayOrder: 0,
    isActive: true,
  });

  // Field Modal State
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [targetChannelId, setTargetChannelId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<any | null>(null);
  const [fieldForm, setFieldForm] = useState<ChannelFieldInput>({
    fieldName: "",
    fieldLabel: "",
    fieldType: "TEXT",
    required: true,
    placeholder: "",
    helpText: "",
    defaultValue: "",
    options: [],
    validationRule: "",
    minLength: undefined,
    maxLength: undefined,
    displayOrder: 0,
    isActive: true,
  });
  const [optionsInput, setOptionsInput] = useState("");

  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const res = await getAdminChannelTypes({
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      if (res.success && res.data) {
        setChannelTypes(res.data);
        // Automatically expand all channel types initially so custom fields are immediately visible
        const initialExpanded: Record<string, boolean> = {};
        res.data.forEach((c: any) => {
          initialExpanded[c.id] = true;
        });
        setExpandedIds((prev) => (Object.keys(prev).length === 0 ? initialExpanded : prev));
      } else {
        toast.error(res.error || "Failed to load channel types");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load channel types");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    loadData();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // -------------------------------------------------------------
  // Channel Type Handlers
  // -------------------------------------------------------------
  const openAddChannelModal = () => {
    setEditingChannel(null);
    setChannelForm({
      name: "",
      identifier: "",
      description: "",
      icon: "Landmark",
      displayOrder: channelTypes.length + 1,
      isActive: true,
    });
    setIsChannelModalOpen(true);
  };

  const openEditChannelModal = (c: any) => {
    setEditingChannel(c);
    setChannelForm({
      name: c.name,
      identifier: c.identifier,
      description: c.description || "",
      icon: c.icon || "Landmark",
      displayOrder: c.displayOrder || 0,
      isActive: c.isActive,
    });
    setIsChannelModalOpen(true);
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelForm.name.trim() || !channelForm.identifier.trim()) {
      toast.error("Please enter a name and unique identifier.");
      return;
    }

    setSaving(true);
    try {
      if (editingChannel) {
        const res = await updateAdminChannelType(editingChannel.id, channelForm);
        if (res.success) {
          toast.success("Channel Type updated!");
          setIsChannelModalOpen(false);
          loadData();
        } else {
          toast.error(res.error || "Failed to update channel type");
        }
      } else {
        const res = await createAdminChannelType(channelForm);
        if (res.success) {
          toast.success("Channel Type created!");
          setIsChannelModalOpen(false);
          loadData();
        } else {
          toast.error(res.error || "Failed to create channel type");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChannelStatus = async (id: string, current: boolean) => {
    try {
      const res = await toggleAdminChannelType(id, !current);
      if (res.success) {
        toast.success(!current ? "Channel activated." : "Channel deactivated.");
        loadData();
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDeleteChannel = async (c: any) => {
    if (!confirm(`Are you sure you want to delete Channel Type '${c.name}'?`)) return;
    try {
      const res = await deleteAdminChannelType(c.id);
      if (res.success) {
        toast.success("Channel Type deleted successfully.");
        loadData();
      } else {
        toast.error(res.error || "Failed to delete channel type");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete channel type");
    }
  };

  // -------------------------------------------------------------
  // Custom Field Handlers
  // -------------------------------------------------------------
  const openAddFieldModal = (channelId: string) => {
    setTargetChannelId(channelId);
    setEditingField(null);
    const targetChannel = channelTypes.find((c) => c.id === channelId);
    setFieldForm({
      fieldName: "",
      fieldLabel: "",
      fieldType: "TEXT",
      required: true,
      placeholder: "",
      helpText: "",
      defaultValue: "",
      options: [],
      validationRule: "",
      minLength: undefined,
      maxLength: undefined,
      displayOrder: (targetChannel?.fields?.length || 0) + 1,
      isActive: true,
    });
    setOptionsInput("");
    setIsFieldModalOpen(true);
  };

  const openEditFieldModal = (channelId: string, field: any) => {
    setTargetChannelId(channelId);
    setEditingField(field);
    setFieldForm({
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType || "TEXT",
      required: field.required,
      placeholder: field.placeholder || "",
      helpText: field.helpText || "",
      defaultValue: field.defaultValue || "",
      options: field.options || [],
      validationRule: field.validationRule || "",
      minLength: field.minLength || undefined,
      maxLength: field.maxLength || undefined,
      displayOrder: field.displayOrder || 0,
      isActive: field.isActive,
    });
    setOptionsInput(Array.isArray(field.options) ? field.options.join(", ") : "");
    setIsFieldModalOpen(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldForm.fieldLabel.trim() || !fieldForm.fieldName.trim()) {
      toast.error("Please provide both Field Label and Field Name.");
      return;
    }
    if (!targetChannelId) return;

    setSaving(true);
    try {
      const parsedOptions =
        fieldForm.fieldType === "DROPDOWN" || fieldForm.fieldType === "RADIO"
          ? optionsInput
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;

      const payload: ChannelFieldInput = {
        ...fieldForm,
        options: parsedOptions,
      };

      if (editingField) {
        const res = await updateAdminChannelField(editingField.id, payload);
        if (res.success) {
          toast.success("Custom field updated!");
          setIsFieldModalOpen(false);
          loadData();
        } else {
          toast.error(res.error || "Failed to update field");
        }
      } else {
        const res = await createAdminChannelField(targetChannelId, payload);
        if (res.success) {
          toast.success("Custom field added to channel!");
          setIsFieldModalOpen(false);
          loadData();
        } else {
          toast.error(res.error || "Failed to create field");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save field");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (field: any) => {
    if (!confirm(`Are you sure you want to delete field '${field.fieldLabel}'?`)) return;
    try {
      const res = await deleteAdminChannelField(field.id);
      if (res.success) {
        toast.success("Custom field deleted.");
        loadData();
      } else {
        toast.error(res.error || "Failed to delete field");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete field");
    }
  };

  const handleMoveField = async (channel: any, fieldIndex: number, direction: "up" | "down") => {
    const fields = [...channel.fields];
    const targetIndex = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    const [moved] = fields.splice(fieldIndex, 1);
    fields.splice(targetIndex, 0, moved);

    const orderedIds = fields.map((f) => f.id);
    try {
      await reorderAdminChannelFields(channel.id, orderedIds);
      toast.success("Field order updated.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder fields");
    }
  };

  const totalFieldsCount = channelTypes.reduce((acc, c) => acc + (c.fields?.length || 0), 0);
  const totalActiveChannels = channelTypes.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161822] p-5 rounded-2xl border border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/admin/p2p"
              className="p-1.5 rounded-lg bg-[#1E202B] text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-2 bg-[#00A070]/10 rounded-xl text-[#00A070]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                P2P Channel Types &amp; Dynamic Custom Fields
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Configure payment channels (Bank, UPI, E-Wallet, etc.) and define dynamic custom fields loaded automatically on trader forms.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/p2p/payment-methods"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-200 border border-white/5 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#00A070]" />
            <span>Manage Payment Methods</span>
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-gray-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#00A070]" : ""}`} />
          </button>
          <button
            onClick={openAddChannelModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Channel Type</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#161822] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Configured Channels</span>
            <div className="text-xl font-black text-white mt-0.5">{channelTypes.length}</div>
          </div>
          <Layers className="w-6 h-6 text-emerald-400/30" />
        </div>
        <div className="bg-[#161822] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Active Channels</span>
            <div className="text-xl font-black text-[#00A070] mt-0.5">{totalActiveChannels}</div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-[#00A070]/30" />
        </div>
        <div className="bg-[#161822] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Dynamic Custom Fields</span>
            <div className="text-xl font-black text-cyan-400 mt-0.5">{totalFieldsCount}</div>
          </div>
          <Sparkles className="w-6 h-6 text-cyan-400/30" />
        </div>
        <div className="bg-[#161822] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-medium">Linked Payment Methods</span>
            <div className="text-xl font-black text-amber-400 mt-0.5">
              {channelTypes.reduce((acc, c) => acc + (c._count?.systemPaymentMethods || 0), 0)}
            </div>
          </div>
          <CreditCard className="w-6 h-6 text-amber-400/30" />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#161822] p-3 rounded-xl border border-white/5">
        <form onSubmit={handleSearch} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search channels by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#11121A] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">Status:</span>
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                statusFilter === s
                  ? "bg-[#00A070] text-white"
                  : "bg-[#1E202B] text-gray-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Types List */}
      {loading ? (
        <div className="py-20 text-center bg-[#161822] rounded-2xl border border-white/5">
          <RefreshCw className="w-8 h-8 animate-spin text-[#00A070] mx-auto mb-3" />
          <p className="text-xs text-gray-400">Loading channel configurations...</p>
        </div>
      ) : channelTypes.length === 0 ? (
        <div className="py-16 text-center bg-[#161822] rounded-2xl border border-white/5 p-6">
          <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Channel Types Found</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto mt-1 mb-4">
            Create channel types to categorize payment methods and define custom fields for Bank accounts, UPI, E-wallets, or Cash transfers.
          </p>
          <button
            onClick={openAddChannelModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00A070] text-white text-xs font-bold rounded-xl"
          >
            <Plus className="w-4 h-4" /> Add First Channel Type
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {channelTypes.map((channel) => {
            const IconComp = ICON_MAP[channel.icon] || Landmark;
            const isExpanded = Boolean(expandedIds[channel.id]);

            return (
              <div
                key={channel.id}
                className="bg-[#161822] rounded-2xl border border-white/5 overflow-hidden transition-all"
              >
                {/* Channel Header Row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 bg-[#141620]">
                  <div className="flex items-center gap-3.5">
                    <button
                      onClick={() => toggleExpand(channel.id)}
                      className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                      title={isExpanded ? "Collapse fields" : "Expand fields"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-[#00A070]" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    <div className="w-10 h-10 rounded-xl bg-[#1E202B] border border-white/10 flex items-center justify-center text-[#00A070]">
                      <IconComp className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{channel.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                          {channel.identifier}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            channel.isActive
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          }`}
                        >
                          {channel.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                        {channel.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-xs text-gray-400 font-mono hidden md:inline-block">
                      {channel.fields?.length || 0} fields &bull; {channel._count?.systemPaymentMethods || 0} methods
                    </span>

                    <button
                      onClick={() => handleToggleChannelStatus(channel.id, channel.isActive)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                        channel.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20"
                      }`}
                    >
                      {channel.isActive ? "Enabled" : "Disabled"}
                    </button>

                    <button
                      onClick={() => openAddFieldModal(channel.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00A070]/15 hover:bg-[#00A070]/25 text-xs text-[#00A070] font-semibold border border-[#00A070]/30 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Field</span>
                    </button>

                    <button
                      onClick={() => openEditChannelModal(channel)}
                      className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-gray-300 hover:text-white transition-colors cursor-pointer"
                      title="Edit Channel Type"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteChannel(channel)}
                      className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete Channel Type"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Nested Custom Fields Section */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 bg-[#11121A]/80">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#00A070]" />
                        <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                          Configured Custom Fields ({channel.fields?.length || 0})
                        </h4>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        These fields automatically render when this channel is selected by merchants or buyers.
                      </span>
                    </div>

                    {channel.fields?.length === 0 ? (
                      <div className="text-center py-8 bg-[#161822] rounded-xl border border-dashed border-white/10 p-4">
                        <p className="text-xs text-gray-400">
                          No custom fields defined for this channel yet.
                        </p>
                        <button
                          onClick={() => openAddFieldModal(channel.id)}
                          className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-[#00A070] hover:underline cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add custom field now
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {channel.fields.map((field: any, fIdx: number) => (
                          <div
                            key={field.id}
                            className="bg-[#161822] border border-white/5 hover:border-white/10 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-md bg-[#1E202B] text-gray-400 text-xs font-mono flex items-center justify-center font-bold">
                                {fIdx + 1}
                              </span>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">
                                    {field.fieldLabel}
                                  </span>
                                  {field.required && (
                                    <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                                      Required
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                                    {field.fieldType}
                                  </span>
                                  {!field.isActive && (
                                    <span className="text-[10px] text-gray-400 bg-gray-500/10 px-1.5 py-0.2 rounded">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono mt-0.5">
                                  <span>key: {field.fieldName}</span>
                                  {field.placeholder && (
                                    <span>&bull; placeholder: &quot;{field.placeholder}&quot;</span>
                                  )}
                                  {field.options && field.options.length > 0 && (
                                    <span>&bull; options: [{field.options.join(", ")}]</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-center">
                              {/* Reorder Buttons */}
                              <button
                                disabled={fIdx === 0}
                                onClick={() => handleMoveField(channel, fIdx, "up")}
                                className="p-1.5 rounded-lg bg-[#1E202B] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                title="Move Up"
                              >
                                <MoveUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                disabled={fIdx === channel.fields.length - 1}
                                onClick={() => handleMoveField(channel, fIdx, "down")}
                                className="p-1.5 rounded-lg bg-[#1E202B] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                title="Move Down"
                              >
                                <MoveDown className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => openEditFieldModal(channel.id, field)}
                                className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-gray-300 hover:text-white transition-colors cursor-pointer"
                                title="Edit Field"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteField(field)}
                                className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Delete Field"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal: Add / Edit Channel Type */}
      {/* ------------------------------------------------------------- */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#161822] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#141620]">
              <h2 className="text-base font-bold text-white">
                {editingChannel ? `Edit Channel Type: ${editingChannel.name}` : "Create New Channel Type"}
              </h2>
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Channel Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bank Account / IMPS, UPI / QR Code"
                  value={channelForm.name}
                  onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                  className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Identifier Slug / Code</label>
                  <input
                    type="text"
                    disabled={Boolean(editingChannel)}
                    placeholder="e.g. BANK, UPI, WALLET"
                    value={channelForm.identifier}
                    onChange={(e) => setChannelForm({ ...channelForm, identifier: e.target.value })}
                    className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070] font-mono uppercase disabled:opacity-60"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Icon</label>
                  <select
                    value={channelForm.icon}
                    onChange={(e) => setChannelForm({ ...channelForm, icon: e.target.value })}
                    className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  >
                    <option value="Landmark">Landmark (Bank)</option>
                    <option value="QrCode">QrCode (UPI)</option>
                    <option value="Wallet">Wallet (E-Wallet)</option>
                    <option value="Banknote">Banknote (Cash)</option>
                    <option value="CreditCard">CreditCard (Card)</option>
                    <option value="Globe">Globe (Online)</option>
                    <option value="Shield">Shield (Secure)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Description &amp; Guidelines</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Direct bank wire, IMPS, NEFT, RTGS or online banking transfer"
                  value={channelForm.description || ""}
                  onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                  className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Display Order</label>
                  <input
                    type="number"
                    value={channelForm.displayOrder}
                    onChange={(e) =>
                      setChannelForm({ ...channelForm, displayOrder: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input
                      type="checkbox"
                      checked={channelForm.isActive}
                      onChange={(e) => setChannelForm({ ...channelForm, isActive: e.target.checked })}
                      className="w-4 h-4 accent-[#00A070] rounded cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-white">Active &amp; Available</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsChannelModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#00A070] hover:bg-[#00b880] text-xs font-bold text-white shadow-md shadow-[#00A070]/20 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingChannel ? "Update Channel" : "Create Channel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal: Add / Edit Dynamic Custom Field */}
      {/* ------------------------------------------------------------- */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#161822] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#141620]">
              <h2 className="text-base font-bold text-white">
                {editingField ? `Edit Field: ${editingField.fieldLabel}` : "Add Dynamic Custom Field"}
              </h2>
              <button
                onClick={() => setIsFieldModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveField} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Field Label (Displayed)</label>
                  <input
                    type="text"
                    placeholder="e.g. Account Number, UPI ID"
                    value={fieldForm.fieldLabel}
                    onChange={(e) => {
                      const label = e.target.value;
                      const autoName = editingField
                        ? fieldForm.fieldName
                        : label.replace(/[^a-zA-Z0-9]/g, "").replace(/^([A-Z])/, (m) => m.toLowerCase());
                      setFieldForm({ ...fieldForm, fieldLabel: label, fieldName: autoName });
                    }}
                    className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Field Key / Name (API)</label>
                  <input
                    type="text"
                    disabled={Boolean(editingField)}
                    placeholder="e.g. accountNumber, upiId"
                    value={fieldForm.fieldName}
                    onChange={(e) => setFieldForm({ ...fieldForm, fieldName: e.target.value })}
                    className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070] font-mono disabled:opacity-60"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Field Type</label>
                  <select
                    value={fieldForm.fieldType}
                    onChange={(e) => setFieldForm({ ...fieldForm, fieldType: e.target.value })}
                    className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  >
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="EMAIL">Email</option>
                    <option value="PHONE">Phone Number</option>
                    <option value="TEXTAREA">Textarea (Multiline)</option>
                    <option value="DROPDOWN">Dropdown Menu</option>
                    <option value="CHECKBOX">Checkbox (Yes/No)</option>
                    <option value="DATE">Date</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Placeholder Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Enter your account number"
                    value={fieldForm.placeholder || ""}
                    onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                    className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              {(fieldForm.fieldType === "DROPDOWN" || fieldForm.fieldType === "RADIO") && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    Dropdown Options (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="Savings, Current, Salary"
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                    className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Help / Tooltip Text</label>
                <input
                  type="text"
                  placeholder="e.g. Ensure name matches your KYC verified name"
                  value={fieldForm.helpText || ""}
                  onChange={(e) => setFieldForm({ ...fieldForm, helpText: e.target.value })}
                  className="w-full bg-[#11121A] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#00A070]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldForm.required}
                    onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })}
                    className="w-4 h-4 accent-[#00A070] rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-white">Required Field</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldForm.isActive}
                    onChange={(e) => setFieldForm({ ...fieldForm, isActive: e.target.checked })}
                    className="w-4 h-4 accent-[#00A070] rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-white">Field Active</span>
                </label>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFieldModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#00A070] hover:bg-[#00b880] text-xs font-bold text-white shadow-md shadow-[#00A070]/20 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingField ? "Update Field" : "Add Field"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
