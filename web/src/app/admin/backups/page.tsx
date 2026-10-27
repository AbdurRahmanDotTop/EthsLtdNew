"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Download,
  Upload,
  FileArchive,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Layers,
  FileText,
  ShieldAlert,
  Loader2,
  HardDrive,
  Code,
  Image as ImageIcon,
} from "lucide-react";
import {
  adminGetBackupStats,
  adminValidateBackupPackage,
  adminRestoreDatabase,
  adminRestoreWebsiteConfig,
  adminRestoreMedia,
} from "@/actions/admin";
import { toast } from "sonner";

interface BackupStats {
  userCount: number;
  walletCount: number;
  orderCount: number;
  txCount: number;
  kycCount: number;
  marketCount: number;
  slideCount: number;
  mediaCount: number;
  auditLogCount: number;
  recentLogs: Array<{
    id: string;
    adminEmail: string;
    action: string;
    targetType: string;
    targetId: string;
    details: string;
    createdAt: string | Date;
  }>;
}

export default function AdminBackupsPage() {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"EXPORT" | "IMPORT" | "MEDIA" | "LOGS">("EXPORT");

  // Export states
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  // Import states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedPackage, setUploadedPackage] = useState<any | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const data = await adminGetBackupStats();
      setStats(data as unknown as BackupStats);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load backup stats.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleDownload = async (type: "full_db" | "website_config" | "media" | "project_source") => {
    setDownloadingType(type);
    toast.info("Preparing backup package, please wait...");

    try {
      const res = await fetch(`/api/admin/backup/export?type=${type}`);
      if (!res.ok) {
        const errPayload: any = await res.json().catch(() => ({ error: "Download failed" }));
        throw new Error(errPayload?.error || `Failed with status ${res.status}`);
      }

      const contentDisposition = res.headers.get("content-disposition");
      let filename = `ethsltd_backup_${type}.json`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Successfully downloaded ${filename}`);
      loadStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to download backup package.");
    } finally {
      setDownloadingType(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setValidationResult(null);
    setUploadedPackage(null);
    setIsValidating(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setUploadedPackage(parsed);

      const validation = await adminValidateBackupPackage(parsed);
      setValidationResult(validation);

      if (validation.valid) {
        toast.success("Backup package verified! Cryptographic checksum is valid.");
      } else {
        toast.error("Package validation warning: Inspect details below.");
      }
    } catch (err: any) {
      toast.error("Failed to parse file: Ensure it is a valid JSON backup package.");
      setValidationResult({
        valid: false,
        checksumValid: false,
        totalRecords: 0,
        tableCounts: {},
        errors: ["Invalid JSON format or corrupted file structure."],
        warnings: [],
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!uploadedPackage || !validationResult?.valid) return;
    if (confirmPhrase !== "RESTORE PRODUCTION") {
      toast.error("Please type 'RESTORE PRODUCTION' to confirm.");
      return;
    }

    setIsRestoring(true);
    const type = uploadedPackage.manifest?.type;

    try {
      let res: any;
      if (type === "FULL_DATABASE") {
        res = await adminRestoreDatabase(uploadedPackage);
      } else if (type === "WEBSITE_CONFIG") {
        res = await adminRestoreWebsiteConfig(uploadedPackage);
      } else if (type === "MEDIA_ARCHIVE") {
        res = await adminRestoreMedia(uploadedPackage);
      } else {
        throw new Error(`Unsupported package type: ${type}`);
      }

      if (res.success) {
        toast.success("Production data restored successfully!");
        setShowRestoreModal(false);
        setSelectedFile(null);
        setUploadedPackage(null);
        setValidationResult(null);
        setConfirmPhrase("");
        loadStats();
      } else {
        toast.error(res.error || "Restoration failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Restoration encountered an unexpected error.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-[#00A070]" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Backup, Restore & System Management
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Export full database snapshots, website configuration, media documents, or project source code.
            Perform secure, cryptographically validated imports.
          </p>
        </div>

        <button
          onClick={loadStats}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl bg-[#161822] hover:bg-[#1E202B] border border-white/10 text-xs text-gray-300 font-semibold flex items-center gap-2 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#00A070]" : ""}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
            <span>USERS & WALLETS</span>
            <Database className="w-4 h-4 text-[#00A070]" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-white font-mono">
              {stats ? stats.userCount : "--"}
            </span>
            <span className="text-xs text-gray-400 ml-2">
              ({stats ? stats.walletCount : "--"} wallets)
            </span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Primary production database</div>
        </div>

        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
            <span>STORED DOCUMENTS</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-white font-mono">
              {stats ? stats.mediaCount : "--"}
            </span>
            <span className="text-xs text-gray-400 ml-2">files in D1</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">KYC docs & deposit receipts</div>
        </div>

        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
            <span>PLATFORM CONFIGS</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-white font-mono">
              {stats ? stats.marketCount + stats.slideCount : "--"}
            </span>
            <span className="text-xs text-gray-400 ml-2">items</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Markets, sliders, P2P channels</div>
        </div>

        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
            <span>SECURITY AUDITS</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-white font-mono">
              {stats ? stats.auditLogCount : "--"}
            </span>
            <span className="text-xs text-gray-400 ml-2">events</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Recorded administrative actions</div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-white/10 space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("EXPORT")}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "EXPORT"
              ? "border-b-2 border-[#00A070] text-[#00A070]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Export & Download Packages</span>
        </button>

        <button
          onClick={() => setActiveTab("IMPORT")}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "IMPORT"
              ? "border-b-2 border-[#00A070] text-[#00A070]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Restore & Import Archive</span>
        </button>

        <button
          onClick={() => setActiveTab("MEDIA")}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "MEDIA"
              ? "border-b-2 border-[#00A070] text-[#00A070]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Media & Document Storage</span>
        </button>

        <button
          onClick={() => setActiveTab("LOGS")}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "LOGS"
              ? "border-b-2 border-[#00A070] text-[#00A070]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Backup History & Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: EXPORT & DOWNLOAD PACKAGES */}
      {activeTab === "EXPORT" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Full Database Backup */}
          <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#00A070]/15 text-[#00A070] flex items-center justify-center mb-4">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Full Database Backup</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Exports all 30+ tables across the platform: Users, Wallets, Orders, Transactions, KYC applications,
                P2P marketplace records, RM contracts, and audit trails. Includes SHA-256 cryptographic checksum.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono text-gray-400">
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">JSON Package</span>
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">SHA-256 Checksum</span>
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Schema Verified</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-mono">Scope: Complete Application</span>
              <button
                onClick={() => handleDownload("full_db")}
                disabled={downloadingType === "full_db"}
                className="px-4 py-2 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {downloadingType === "full_db" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Full Backup</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 2: Website Config & Content */}
          <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Website Configuration & Content</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Exports platform settings without personal user data: Hero banner slides, trading markets,
                P2P payment channels, system deposit gateways, crypto assets, fiat currencies, and pixel tracking configs.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono text-gray-400">
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Zero User Data</span>
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Portable Config</span>
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Safe for Staging</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-mono">Scope: Platform Settings</span>
              <button
                onClick={() => handleDownload("website_config")}
                disabled={downloadingType === "website_config"}
                className="px-4 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] border border-white/10 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {downloadingType === "website_config" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Config</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 3: Media & Document Storage */}
          <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-4">
                <FileArchive className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Media & Documents Archive</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Exports all persistent uploaded files stored in Cloudflare D1: KYC identity documents (front & back),
                manual deposit payment receipts, P2P dispute attachments, and user media.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono text-gray-400">
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">D1 Storage Dump</span>
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Chunked Base64</span>
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Full Metadata</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-mono">Scope: Media & Docs</span>
              <button
                onClick={() => handleDownload("media")}
                disabled={downloadingType === "media"}
                className="px-4 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] border border-white/10 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {downloadingType === "media" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Media Archive</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 4: Clean Source Code Bundle */}
          <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center mb-4">
                <Code className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Project Source Code Export</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Downloads a clean, deployable ZIP archive of the Next.js and Cloudflare Workers application source code.
                Strictly strips out environment secrets, API keys, private keys, passwords, and build artifacts.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono text-gray-400">
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Clean ZIP</span>
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Secrets Stripped</span>
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Deploy Ready</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-mono">Scope: Application Source</span>
              <button
                onClick={() => handleDownload("project_source")}
                disabled={downloadingType === "project_source"}
                className="px-4 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] border border-white/10 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {downloadingType === "project_source" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating ZIP...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Source Bundle</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESTORE & IMPORT ARCHIVE */}
      {activeTab === "IMPORT" && (
        <div className="space-y-6">
          {/* File Upload Box */}
          <div className="bg-[#161822] border-2 border-dashed border-white/10 hover:border-[#00A070]/50 rounded-2xl p-8 text-center transition-colors">
            <Upload className="w-10 h-10 text-[#00A070] mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white">Select Backup Package to Restore</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              Upload a verified JSON backup package (Full Database, Website Configuration, or Media Archive).
            </p>

            <label className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-semibold cursor-pointer transition-colors shadow-lg shadow-[#00A070]/20">
              <FileArchive className="w-4 h-4" />
              <span>Browse Backup File (.json)</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {selectedFile && (
              <div className="mt-4 text-xs font-mono text-gray-300">
                Selected: <span className="text-[#00A070] font-bold">{selectedFile.name}</span> (
                {(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          {/* Validation Feedback */}
          {isValidating && (
            <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 text-center text-xs text-gray-400 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-[#00A070]" />
              <span>Validating package structure and verifying SHA-256 integrity checksum...</span>
            </div>
          )}

          {validationResult && !isValidating && (
            <div className="bg-[#161822] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  {validationResult.valid ? (
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                      <XCircle className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Package Verification:{" "}
                      <span className={validationResult.valid ? "text-emerald-400" : "text-rose-400"}>
                        {validationResult.valid ? "PASSED VALIDATION" : "VALIDATION ISSUES DETECTED"}
                      </span>
                    </h4>
                    <p className="text-xs text-gray-400 font-mono">
                      Type: {validationResult.type || "UNKNOWN"} | Created:{" "}
                      {validationResult.createdAt
                        ? new Date(validationResult.createdAt).toLocaleString()
                        : "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border ${
                      validationResult.checksumValid
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {validationResult.checksumValid ? "CHECKSUM VERIFIED" : "CHECKSUM UNVERIFIED"}
                  </span>
                </div>
              </div>

              {/* Table breakdown */}
              <div>
                <h5 className="text-xs font-bold text-gray-300 mb-2">Payload Contents Summary:</h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {Object.entries(validationResult.tableCounts).map(([table, count]) => (
                    <div
                      key={table}
                      className="bg-[#1E202B] border border-white/5 p-2 rounded-xl text-center"
                    >
                      <div className="text-[10px] text-gray-400 truncate">{table}</div>
                      <div className="text-sm font-mono font-bold text-white mt-0.5">{count as number}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Errors or Warnings */}
              {validationResult.errors.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-400 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Blocking Errors:</span>
                  </div>
                  {validationResult.errors.map((err: string, i: number) => (
                    <div key={i} className="pl-5 text-[11px]">• {err}</div>
                  ))}
                </div>
              )}

              {/* Execute Button */}
              {validationResult.valid && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowRestoreModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <AlertTriangle className="w-4 h-4 text-black" />
                    <span>Proceed to Restore ({validationResult.type})</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MEDIA STORAGE EXPLORER */}
      {activeTab === "MEDIA" && (
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Cloudflare D1 Document & Media Storage</h3>
              <p className="text-xs text-gray-400 mt-1">
                All client verification documents and payment proofs are chunked and stored directly in the
                primary production D1 database, ensuring persistence across worker isolate deployments.
              </p>
            </div>

            <button
              onClick={() => handleDownload("media")}
              disabled={downloadingType === "media"}
              className="px-4 py-2 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shrink-0"
            >
              {downloadingType === "media" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Exporting Media...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Media Archive</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="bg-[#1E202B] border border-white/5 p-4 rounded-xl">
              <div className="text-gray-400 text-[11px]">STORAGE ENGINE</div>
              <div className="text-sm font-bold text-white mt-1">Cloudflare D1 (SQLite)</div>
              <div className="text-[10px] text-emerald-400 mt-1">Chunked Base64 (60KB Blocks)</div>
            </div>

            <div className="bg-[#1E202B] border border-white/5 p-4 rounded-xl">
              <div className="text-gray-400 text-[11px]">MANAGED FILES</div>
              <div className="text-sm font-bold text-white mt-1">
                {stats ? stats.mediaCount : 0} Unique Documents
              </div>
              <div className="text-[10px] text-gray-400 mt-1">KYC front/back & deposit proofs</div>
            </div>

            <div className="bg-[#1E202B] border border-white/5 p-4 rounded-xl">
              <div className="text-gray-400 text-[11px]">INTEGRITY STATUS</div>
              <div className="text-sm font-bold text-emerald-400 mt-1">Healthy & Synced</div>
              <div className="text-[10px] text-gray-400 mt-1">Protected against worker eviction</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === "LOGS" && (
        <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-bold text-white">Administrative Backup, Restore & Deletion History</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Immutable audit log of all system exports, restorations, and permanent user deletions.
            </p>
          </div>

          {stats && stats.recentLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E202B] text-gray-400 uppercase font-mono text-[10px] border-b border-white/5">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-4 py-3">Administrator</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-5 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {stats.recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 font-mono text-gray-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-white font-medium whitespace-nowrap">
                        {log.adminEmail}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            log.action === "USER_PERMANENT_DELETION"
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                              : log.action.includes("RESTORE")
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                              : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-gray-300 whitespace-nowrap">
                        {log.targetType}: {log.targetId}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-[11px] max-w-md truncate">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-gray-500">
              No recent backup or deletion events recorded in the audit log.
            </div>
          )}
        </div>
      )}

      {/* HIGH-DANGER RESTORATION CONFIRMATION MODAL */}
      {showRestoreModal && validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#161822] border border-amber-500/30 rounded-2xl p-6 shadow-2xl text-white font-sans space-y-4">
            <div className="flex items-center gap-3 text-amber-400 pb-3 border-b border-white/10">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Production Restoration</h3>
                <p className="text-xs text-amber-400/90 font-mono">HIGH-IMPACT SYSTEM OPERATION</p>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 space-y-2">
              <p className="font-semibold">
                You are about to restore package:{" "}
                <span className="text-white font-mono font-bold">{validationResult.type}</span>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-200">
                <li>Production database tables will be updated or overwritten with the backup records.</li>
                <li>Existing live settings matching the backup IDs will be updated.</li>
                <li>An immutable administrative audit event will be logged with your identity.</li>
              </ul>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">
                To confirm, type <span className="font-mono text-white font-bold">RESTORE PRODUCTION</span> below:
              </label>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="RESTORE PRODUCTION"
                className="w-full bg-[#1E202B] border border-white/10 focus:border-amber-400 px-3.5 py-2.5 rounded-xl text-xs text-white outline-none font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setConfirmPhrase("");
                }}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={confirmPhrase !== "RESTORE PRODUCTION" || isRestoring}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Restoring Production Data...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 text-black" />
                    <span>Confirm & Execute Restore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
