"use client";

import { useEffect, useState } from "react";
import {
  getAllEmailConfigs,
  saveEmailConfig,
  deleteEmailConfig,
  setDefaultEmailConfig,
  toggleEmailConfig,
  testEmailProviderConnection,
  getAllEmailLogs,
  retryEmailLog,
  EmailConfigInput,
} from "@/actions/admin";
import {
  Mail,
  Send,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Star,
  Check,
  X,
  Eye,
  EyeOff,
  Server,
  Key,
  Clock,
  RotateCcw,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";

interface EmailConfigItem {
  id: string;
  provider: "BREVO" | "SMTP" | "HOSTINGER" | "CUSTOM";
  name: string;
  host?: string | null;
  port?: number | null;
  encryption?: string | null;
  username?: string | null;
  password?: string | null;
  hasPassword?: boolean;
  apiKey?: string | null;
  hasApiKey?: boolean;
  fromEmail: string;
  fromName: string;
  replyTo?: string | null;
  adminEmails?: string | null;
  notifyOnRegistration: boolean;
  notifyOnDeposit: boolean;
  notifyOnWithdrawal: boolean;
  notifyOnKyc: boolean;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailLogItem {
  id: string;
  recipient: string;
  subject: string;
  eventType: string;
  provider: string;
  status: string;
  errorMessage?: string | null;
  messageId?: string | null;
  createdAt: string;
}

export default function AdminEmailSettingsPage() {
  const [activeTab, setActiveTab] = useState<"providers" | "logs">("providers");
  const [configs, setConfigs] = useState<EmailConfigItem[]>([]);
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EmailConfigItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Test Email State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTargetConfigId, setTestTargetConfigId] = useState<string | undefined>(undefined);
  const [testRecipient, setTestRecipient] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Retrying log ID
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Form State
  const [formProvider, setFormProvider] = useState<"BREVO" | "SMTP" | "HOSTINGER" | "CUSTOM">("BREVO");
  const [formName, setFormName] = useState("");
  const [formHost, setFormHost] = useState("");
  const [formPort, setFormPort] = useState(587);
  const [formEncryption, setFormEncryption] = useState("TLS");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formFromEmail, setFormFromEmail] = useState("support@ethsltd.com");
  const [formFromName, setFormFromName] = useState("ETHSLTD Security");
  const [formReplyTo, setFormReplyTo] = useState("");
  const [formAdminEmails, setFormAdminEmails] = useState("");
  const [formNotifyReg, setFormNotifyReg] = useState(true);
  const [formNotifyDeposit, setFormNotifyDeposit] = useState(true);
  const [formNotifyWithdraw, setFormNotifyWithdraw] = useState(true);
  const [formNotifyKyc, setFormNotifyKyc] = useState(true);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const loadData = async () => {
    try {
      const [fetchedConfigs, fetchedLogs] = await Promise.all([
        getAllEmailConfigs(),
        getAllEmailLogs(100),
      ]);
      setConfigs(fetchedConfigs as unknown as EmailConfigItem[]);
      setLogs(fetchedLogs as unknown as EmailLogItem[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to load email configurations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    Promise.all([getAllEmailConfigs(), getAllEmailLogs(100)])
      .then(([fetchedConfigs, fetchedLogs]) => {
        if (!ignore) {
          setConfigs(fetchedConfigs as unknown as EmailConfigItem[]);
          setLogs(fetchedLogs as unknown as EmailLogItem[]);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(msg || "Failed to load email configurations.");
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenAdd = () => {
    setEditingConfig(null);
    setFormProvider("BREVO");
    setFormName("Brevo Transactional API");
    setFormHost("smtp-relay.brevo.com");
    setFormPort(587);
    setFormEncryption("TLS");
    setFormUsername("");
    setFormPassword("");
    setFormApiKey("");
    setFormFromEmail("support@ethsltd.com");
    setFormFromName("ETHSLTD Security");
    setFormReplyTo("");
    setFormAdminEmails("");
    setFormNotifyReg(true);
    setFormNotifyDeposit(true);
    setFormNotifyWithdraw(true);
    setFormNotifyKyc(true);
    setFormEnabled(true);
    setFormIsDefault(configs.length === 0);
    setShowPassword(false);
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (config: EmailConfigItem) => {
    setEditingConfig(config);
    setFormProvider(config.provider);
    setFormName(config.name);
    setFormHost(config.host || "");
    setFormPort(config.port || 587);
    setFormEncryption(config.encryption || "TLS");
    setFormUsername(config.username || "");
    setFormPassword(config.hasPassword ? "••••••••" : "");
    setFormApiKey(config.hasApiKey ? "••••••••" : "");
    setFormFromEmail(config.fromEmail);
    setFormFromName(config.fromName);
    setFormReplyTo(config.replyTo || "");
    setFormAdminEmails(config.adminEmails || "");
    setFormNotifyReg(config.notifyOnRegistration);
    setFormNotifyDeposit(config.notifyOnDeposit);
    setFormNotifyWithdraw(config.notifyOnWithdrawal);
    setFormNotifyKyc(config.notifyOnKyc);
    setFormEnabled(config.enabled);
    setFormIsDefault(config.isDefault);
    setShowPassword(false);
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  // Provider presets helper
  const handleProviderChange = (newProvider: "BREVO" | "SMTP" | "HOSTINGER" | "CUSTOM") => {
    setFormProvider(newProvider);
    if (!editingConfig) {
      if (newProvider === "BREVO") {
        setFormName("Brevo Transactional");
        setFormHost("smtp-relay.brevo.com");
        setFormPort(587);
        setFormEncryption("TLS");
      } else if (newProvider === "HOSTINGER") {
        setFormName("Hostinger Business Mail");
        setFormHost("smtp.hostinger.com");
        setFormPort(465);
        setFormEncryption("SSL");
      } else if (newProvider === "SMTP") {
        setFormName("Custom SMTP Relay");
        setFormHost("");
        setFormPort(587);
        setFormEncryption("TLS");
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Please enter a name for this configuration.");
      return;
    }

    setSaving(true);
    try {
      const payload: EmailConfigInput = {
        id: editingConfig?.id,
        provider: formProvider,
        name: formName.trim(),
        host: formHost.trim() || undefined,
        port: Number(formPort),
        encryption: formEncryption,
        username: formUsername.trim() || undefined,
        password: formPassword.trim() || undefined,
        apiKey: formApiKey.trim() || undefined,
        fromEmail: formFromEmail.trim(),
        fromName: formFromName.trim(),
        replyTo: formReplyTo.trim() || undefined,
        adminEmails: formAdminEmails.trim() || undefined,
        notifyOnRegistration: formNotifyReg,
        notifyOnDeposit: formNotifyDeposit,
        notifyOnWithdrawal: formNotifyWithdraw,
        notifyOnKyc: formNotifyKyc,
        enabled: formEnabled,
        isDefault: formIsDefault,
      };

      const res = await saveEmailConfig(payload);
      if (res.success) {
        toast.success(editingConfig ? "Email configuration updated!" : "Email provider created!");
        setIsModalOpen(false);
        loadData();
      } else {
        toast.error(res.error || "Failed to save configuration.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;
    try {
      const res = await deleteEmailConfig(id);
      if (res.success) {
        toast.success("Provider configuration deleted.");
        loadData();
      } else {
        toast.error(res.error || "Failed to delete.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An error occurred.");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await setDefaultEmailConfig(id);
      if (res.success) {
        toast.success("Default email provider updated.");
        loadData();
      } else {
        toast.error(res.error || "Failed to set default.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An error occurred.");
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const res = await toggleEmailConfig(id, !current);
      if (res.success) {
        toast.success(!current ? "Provider enabled." : "Provider disabled.");
        loadData();
      } else {
        toast.error(res.error || "Failed to update status.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An error occurred.");
    }
  };

  const handleOpenTest = (configId?: string) => {
    setTestTargetConfigId(configId);
    setTestRecipient("");
    setTestResult(null);
    setTestModalOpen(true);
  };

  const handleExecuteTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient || !testRecipient.includes("@")) {
      toast.error("Please enter a valid recipient email.");
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await testEmailProviderConnection({
        configId: testTargetConfigId,
        toEmail: testRecipient,
      });

      if (res.success) {
        const providerName = res.providerUsed || "Default";
        setTestResult({
          success: true,
          message: `Test email dispatched successfully! Provider: ${providerName}`,
        });
        toast.success("Test email delivered!");
        loadData();
      } else {
        setTestResult({
          success: false,
          message: `Delivery failed: ${res.error || "Unknown provider rejection"}`,
        });
        toast.error("Failed to send test email.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: msg || "Network error executing test.",
      });
      toast.error("Test email error.");
    } finally {
      setTesting(false);
    }
  };

  const handleRetryLog = async (logId: string) => {
    setRetryingId(logId);
    try {
      const res = await retryEmailLog(logId);
      if (res.success) {
        toast.success("Email retried successfully!");
        loadData();
      } else {
        toast.error(res.error || "Retry failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An error occurred.");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161822] p-4 sm:p-5 rounded-2xl border border-white/5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00A070]/10 rounded-xl text-[#00A070] shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Email &amp; Notification Settings</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Configure Brevo, Custom SMTP, Hostinger relays, and manage transactional notifications &amp; delivery audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            onClick={() => handleOpenTest()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-200 border border-white/5 transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-[#00A070]" />
            <span>Send Test Email</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-gray-400 hover:text-white border border-white/5 transition-colors cursor-pointer shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#00A070]" : ""}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Provider</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setActiveTab("providers")}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === "providers"
              ? "border-[#00A070] text-[#00A070]"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Configured Providers ({configs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === "logs"
              ? "border-[#00A070] text-[#00A070]"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Delivery Logs &amp; Audit ({logs.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-[#161822] rounded-2xl border border-white/5">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
        </div>
      ) : activeTab === "providers" ? (
        /* Providers Tab Content */
        <div className="space-y-4">
          {configs.length === 0 ? (
            <div className="text-center py-16 bg-[#161822] rounded-2xl border border-white/5 p-6">
              <Mail className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No Email Providers Configured</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto mt-1 mb-5">
                Add Brevo API credentials, Hostinger SMTP, or any custom SMTP server to enable transactional notifications for user registrations, password resets, and PIN recoveries.
              </p>
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A070] text-white font-bold text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Configure First Provider</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className={`bg-[#161822] border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                    config.isDefault
                      ? "border-[#00A070]/40 shadow-lg shadow-[#00A070]/5"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div>
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-xl text-xs font-bold font-mono ${
                            config.provider === "BREVO"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : config.provider === "HOSTINGER"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {config.provider}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{config.name}</h3>
                            {config.isDefault && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-[#00A070] bg-[#00A070]/10 px-2 py-0.5 rounded-full border border-[#00A070]/20">
                                <Star className="w-3 h-3 fill-current" />
                                <span>Default</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            From: {config.fromName} &lt;{config.fromEmail}&gt;
                          </p>
                        </div>
                      </div>

                      {/* Status Toggle */}
                      <button
                        onClick={() => handleToggle(config.id, config.enabled)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                          config.enabled
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20"
                        }`}
                      >
                        {config.enabled ? "Active" : "Disabled"}
                      </button>
                    </div>

                    {/* Details Box */}
                    <div className="mt-4 p-3 bg-[#11121A] rounded-xl border border-white/5 space-y-2 text-xs">
                      {config.provider === "BREVO" ? (
                        <>
                          <div className="flex items-center justify-between text-gray-400">
                            <span>Integration Mode:</span>
                            <span className="text-white font-mono font-medium">
                              {config.apiKey ? "Brevo REST API v3" : "SMTP Relay"}
                            </span>
                          </div>
                          {config.apiKey ? (
                            <div className="flex items-center justify-between text-gray-400">
                              <span>API Key:</span>
                              <span className="text-white font-mono">{config.apiKey}</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-gray-400">
                              <span>SMTP Host:</span>
                              <span className="text-white font-mono">{config.host || "smtp-relay.brevo.com"}:{config.port}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-gray-400">
                            <span>SMTP Server:</span>
                            <span className="text-white font-mono font-medium">
                              {config.host || "smtp.hostinger.com"}:{config.port} ({config.encryption})
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-gray-400">
                            <span>Username:</span>
                            <span className="text-white font-mono">{config.username || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between text-gray-400">
                            <span>Password:</span>
                            <span className="text-white font-mono">{config.password || "—"}</span>
                          </div>
                        </>
                      )}

                      {config.adminEmails && (
                        <div className="flex items-center justify-between text-gray-400 pt-1 border-t border-white/5">
                          <span>Admin Alerts:</span>
                          <span className="text-[#00A070] font-mono text-[11px] truncate max-w-[200px]">
                            {config.adminEmails}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 border-t border-white/5 text-[10px] text-gray-400">
                        <BellRing className="w-3 h-3 text-[#00A070]" />
                        <span>Triggers: </span>
                        {config.notifyOnRegistration && <span className="bg-[#1E202B] px-1.5 py-0.5 rounded">Welcome</span>}
                        {config.notifyOnDeposit && <span className="bg-[#1E202B] px-1.5 py-0.5 rounded">Deposit</span>}
                        {config.notifyOnWithdrawal && <span className="bg-[#1E202B] px-1.5 py-0.5 rounded">Withdrawal</span>}
                        {config.notifyOnKyc && <span className="bg-[#1E202B] px-1.5 py-0.5 rounded">KYC</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!config.isDefault && (
                        <button
                          onClick={() => handleSetDefault(config.id)}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00A070] transition-colors cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Make Default</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenTest(config.id)}
                        className="flex items-center gap-1.5 text-xs text-[#00A070] hover:underline cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Test Outbound</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(config)}
                        className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-gray-300 hover:text-white transition-colors cursor-pointer"
                        title="Edit configuration"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(config.id, config.name)}
                        className="p-1.5 rounded-lg bg-[#1E202B] hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete configuration"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Delivery Logs Tab Content */
        <div className="bg-[#161822] rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Central Email Audit &amp; Dispatch History</h2>
            <span className="text-xs text-gray-400">Latest 100 entries</span>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-xs">
              No outbound emails recorded in audit history yet.
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[750px] text-left text-xs">
                <thead>
                  <tr className="bg-[#12141C] text-gray-400 border-b border-white/5 font-semibold">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1A1D2B] transition-colors">
                      <td className="py-3 px-4">
                        {log.status === "SENT" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Delivered</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20" title={log.errorMessage || "Failed"}>
                            <XCircle className="w-3 h-3" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">{log.recipient}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#1E202B] font-mono text-[11px] text-gray-300">
                          {log.eventType}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate" title={log.subject}>
                        {log.subject}
                        {log.errorMessage && (
                          <div className="text-[10px] text-rose-400 truncate mt-0.5">
                            {log.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-[11px] font-mono">{log.provider}</td>
                      <td className="py-3 px-4 text-gray-500 text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {log.status === "FAILED" && (
                          <button
                            onClick={() => handleRetryLog(log.id)}
                            disabled={retryingId === log.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-[11px] text-[#00A070] font-semibold transition-colors cursor-pointer"
                          >
                            <RotateCcw className={`w-3 h-3 ${retryingId === log.id ? "animate-spin" : ""}`} />
                            <span>Retry</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Provider Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161822] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#161822] z-10">
              <h2 className="text-base font-bold text-white">
                {editingConfig ? `Edit Provider: ${editingConfig.name}` : "Configure Email Provider"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Provider Selector Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Email Service Provider</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["BREVO", "HOSTINGER", "SMTP", "CUSTOM"] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => handleProviderChange(prov)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        formProvider === prov
                          ? "bg-[#00A070] text-white border-[#00A070] shadow-md shadow-[#00A070]/20"
                          : "bg-[#11121A] text-gray-400 border-white/5 hover:bg-[#1E202B]"
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Profile Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Brevo Production"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">From Sender Email</label>
                  <input
                    type="email"
                    placeholder="support@ethsltd.com"
                    value={formFromEmail}
                    onChange={(e) => setFormFromEmail(e.target.value)}
                    className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Sender Display Name</label>
                  <input
                    type="text"
                    placeholder="ETHSLTD Security"
                    value={formFromName}
                    onChange={(e) => setFormFromName(e.target.value)}
                    className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Reply-To Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="helpdesk@ethsltd.com"
                    value={formReplyTo}
                    onChange={(e) => setFormReplyTo(e.target.value)}
                    className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {/* Brevo API Key Field */}
              {formProvider === "BREVO" && (
                <div className="p-4 bg-[#11121A] rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-blue-400" />
                      <span>Brevo REST API v3 Key (Recommended)</span>
                    </label>
                    <span className="text-[10px] text-gray-500">From Brevo Settings → SMTP &amp; API</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      placeholder="xkeysib-..."
                      value={formApiKey}
                      onChange={(e) => setFormApiKey(e.target.value)}
                      className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] rounded-xl py-2.5 px-3.5 text-xs text-white outline-none font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    If API Key is provided, outbound emails will be transmitted through Brevo&apos;s high-throughput HTTP API.
                  </p>
                </div>
              )}

              {/* SMTP Settings */}
              {(formProvider !== "BREVO" || !formApiKey) && (
                <div className="p-4 bg-[#11121A] rounded-xl border border-white/5 space-y-4">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[#00A070]" />
                    <span>SMTP Relay Parameters</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] text-gray-400">SMTP Host</label>
                      <input
                        type="text"
                        placeholder={formProvider === "HOSTINGER" ? "smtp.hostinger.com" : "smtp.example.com"}
                        value={formHost}
                        onChange={(e) => setFormHost(e.target.value)}
                        className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] rounded-xl py-2 px-3 text-xs text-white outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">Port</label>
                      <input
                        type="number"
                        placeholder="587"
                        value={formPort}
                        onChange={(e) => setFormPort(Number(e.target.value))}
                        className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] rounded-xl py-2 px-3 text-xs text-white outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">Encryption Method</label>
                      <select
                        value={formEncryption}
                        onChange={(e) => setFormEncryption(e.target.value)}
                        className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] rounded-xl py-2 px-3 text-xs text-white outline-none"
                      >
                        <option value="TLS">TLS (Port 587)</option>
                        <option value="SSL">SSL (Port 465)</option>
                        <option value="STARTTLS">STARTTLS</option>
                        <option value="NONE">None (Insecure)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">SMTP Username</label>
                      <input
                        type="text"
                        placeholder="user@example.com"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] rounded-xl py-2 px-3 text-xs text-white outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">SMTP Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder={editingConfig?.hasPassword ? "Leave blank to keep current password" : "Enter SMTP password"}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] rounded-xl py-2 px-3 text-xs text-white outline-none font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Alerts & Event Preferences */}
              <div className="p-4 bg-[#11121A] rounded-xl border border-white/5 space-y-3">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin Alert Notifications</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400">Admin Notification Recipients (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="admin@ethsltd.com, security@ethsltd.com"
                    value={formAdminEmails}
                    onChange={(e) => setFormAdminEmails(e.target.value)}
                    className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] rounded-xl py-2 px-3 text-xs text-white outline-none font-mono"
                  />
                </div>

                <div className="pt-2 grid grid-cols-2 gap-2 text-xs text-gray-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formNotifyReg}
                      onChange={(e) => setFormNotifyReg(e.target.checked)}
                      className="accent-[#00A070]"
                    />
                    <span>New User Registrations</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formNotifyDeposit}
                      onChange={(e) => setFormNotifyDeposit(e.target.checked)}
                      className="accent-[#00A070]"
                    />
                    <span>Deposit Requests</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formNotifyWithdraw}
                      onChange={(e) => setFormNotifyWithdraw(e.target.checked)}
                      className="accent-[#00A070]"
                    />
                    <span>Withdrawal Requests</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formNotifyKyc}
                      onChange={(e) => setFormNotifyKyc(e.target.checked)}
                      className="accent-[#00A070]"
                    />
                    <span>KYC Document Submissions</span>
                  </label>
                </div>
              </div>

              {/* Status Toggles */}
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                    className="accent-[#00A070]"
                  />
                  <span>Provider Active &amp; Enabled</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="accent-[#00A070]"
                  />
                  <span>Set as Default Sending Provider</span>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Outbound Email Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161822] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#00A070]" />
                <h2 className="text-sm font-bold text-white">Outbound Email Verification</h2>
              </div>
              <button
                onClick={() => setTestModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTest} className="p-5 space-y-4">
              <p className="text-xs text-gray-400">
                Send a real test email with ETHSLTD branding and cryptographic timestamp to verify DNS, SMTP handshake, or Brevo API connection.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Recipient Email Address</label>
                <input
                  type="email"
                  placeholder="admin@example.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                  required
                />
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs border ${
                    testResult.success
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  }`}
                >
                  <p className="font-semibold">{testResult.success ? "Success" : "Error"}</p>
                  <p className="text-[11px] mt-0.5 break-all">{testResult.message}</p>
                </div>
              )}

              <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-300"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testing}
                  className="px-4 py-2 rounded-xl bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 flex items-center gap-2"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Test Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
