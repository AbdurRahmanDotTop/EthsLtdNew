"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ChevronLeft, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Loader2, 
  Upload, 
  FileCheck,
  RefreshCw,
  ExternalLink,
  Eye,
  FileText
} from "lucide-react";
import Link from "next/link";
import { getKycStatus, submitKycApplication } from "@/actions/user";
import { getUserTradingInfo } from "@/actions/trade";
import { toast } from "sonner";

export default function KYCPage() {
  const [kycData, setKycData] = useState<any | null>(null);
  const [isKycVerified, setIsKycVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [idNumber, setIdNumber] = useState("");
  const [address, setAddress] = useState("");
  const [idFrontUrl, setIdFrontUrl] = useState<string>("");
  const [idBackUrl, setIdBackUrl] = useState<string>("");
  const [frontFileName, setFrontFileName] = useState<string>("");
  const [backFileName, setBackFileName] = useState<string>("");
  
  // Uploading states
  const [frontUploading, setFrontUploading] = useState(false);
  const [backUploading, setBackUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File input refs
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const loadKyc = async () => {
    try {
      const [status, info] = await Promise.all([
        getKycStatus(),
        getUserTradingInfo(),
      ]);
      setKycData(status);
      if (status?.status === "APPROVED") {
        setIsKycVerified(true);
      }
      if (status?.status === "REJECTED") {
        // Pre-fill previously entered values for ease of re-submission
        if (status.idNumber) setIdNumber(status.idNumber);
        if (status.address) setAddress(status.address);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  // Handle actual document upload to secure private storage
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    side: "front" | "back"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Client-side size check (Max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error(`File size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller file.`);
      e.target.value = "";
      return;
    }

    // 2. Client-side format check
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Unsupported file format. Please upload JPG, PNG, WEBP, or PDF.");
      e.target.value = "";
      return;
    }

    if (side === "front") {
      setFrontUploading(true);
    } else {
      setBackUploading(true);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("side", side);

      const res = await fetch("/api/kyc/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upload failed. Please try again.");
      }

      if (side === "front") {
        setIdFrontUrl(data.url);
        setFrontFileName(file.name);
        toast.success("Front side ID photo attached successfully!");
      } else {
        setIdBackUrl(data.url);
        setBackFileName(file.name);
        toast.success("Back side ID photo attached successfully!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file.");
      e.target.value = "";
    } finally {
      if (side === "front") {
        setFrontUploading(false);
      } else {
        setBackUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idNumber.trim() || !address.trim()) {
      toast.error("Please enter both Personal ID Number and Contact Address.");
      return;
    }

    if (!idFrontUrl) {
      toast.error("Please upload the front side photo of your ID document.");
      return;
    }

    if (!idBackUrl) {
      toast.error("Please upload the back side photo of your ID document.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitKycApplication({
        idNumber: idNumber.trim(),
        address: address.trim(),
        idFrontUrl: idFrontUrl,
        idBackUrl: idBackUrl,
      });

      if (res.success) {
        toast.success("KYC Application submitted successfully! Our compliance team will review it.");
        await loadKyc();
      } else {
        toast.error(res.error || "Failed to submit KYC application.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#121212] text-white items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
      </div>
    );
  }

  // State 1: Verified (Matching Screenshot 7)
  if (isKycVerified || kycData?.status === "APPROVED") {
    return (
      <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-20 font-sans select-none">
        <header className="flex items-center p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
          <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <span className="font-bold text-lg ml-4">KYC Verification</span>
        </header>

        <div className="p-4 max-w-lg mx-auto w-full">
          <div className="flex justify-between items-center bg-[#1A1C24] p-5 rounded-2xl border border-white/5 shadow-xl">
            <div className="flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-[#00A070]" />
              <div>
                <span className="text-white font-bold text-sm block">Real-name Verification</span>
                <span className="text-gray-400 text-xs">Level 2 Institutional Verification Complete</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[#00A070] bg-[#00A070]/10 px-3 py-1 rounded-full border border-[#00A070]/30">
              <CheckCircle className="w-4 h-4 fill-current" />
              <span className="font-bold text-xs">Verified</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-[#1A1C24] rounded-xl border border-white/5 text-xs text-gray-400 space-y-2 font-mono">
            <div className="flex justify-between">
              <span>Verified ID:</span>
              <span className="text-gray-200">
                {kycData?.idNumber 
                  ? (kycData.idNumber.length > 6 
                      ? `${kycData.idNumber.slice(0, 3)}****${kycData.idNumber.slice(-3)}`
                      : kycData.idNumber)
                  : "4201********1920"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Jurisdiction:</span>
              <span className="text-gray-200">{kycData?.address || "Registered Address"}</span>
            </div>
            {kycData?.reviewedAt && (
              <div className="flex justify-between">
                <span>Verified On:</span>
                <span className="text-gray-200">{new Date(kycData.reviewedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State 2: Pending Under Review
  if (kycData?.status === "PENDING") {
    return (
      <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-20 font-sans select-none">
        <header className="flex items-center p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
          <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <span className="font-bold text-lg ml-4">KYC Application</span>
        </header>

        <div className="p-4 max-w-lg mx-auto w-full flex flex-col gap-4">
          <div className="flex items-center justify-between bg-[#1A1C24] p-5 rounded-2xl border border-white/5 shadow-xl">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-amber-400" />
              <div>
                <span className="text-white font-bold text-sm block">Verification Pending</span>
                <span className="text-gray-400 text-xs">Our compliance team is currently reviewing your documents</span>
              </div>
            </div>
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              Under Review
            </span>
          </div>

          <div className="bg-[#1A1C24] p-4 rounded-xl border border-white/5 text-xs text-gray-400 space-y-2.5 font-mono">
            <div className="flex justify-between">
              <span>Submitted ID:</span>
              <span className="text-gray-200">{kycData.idNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Address:</span>
              <span className="text-gray-200">{kycData.address}</span>
            </div>
            <div className="flex justify-between">
              <span>Submitted At:</span>
              <span className="text-gray-200">{new Date(kycData.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Submitted Document Previews */}
          <div className="bg-[#1A1C24] p-4 rounded-xl border border-white/5">
            <span className="text-xs font-bold text-gray-300 block mb-3">Submitted Identification Documents</span>
            <div className="grid grid-cols-2 gap-3">
              {kycData.idFrontUrl && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-gray-400 font-mono">Front Side</span>
                  <a
                    href={kycData.idFrontUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative aspect-[4/3] rounded-lg bg-[#121212] border border-white/10 overflow-hidden flex items-center justify-center group hover:border-[#00A070]/50 transition-colors"
                  >
                    <img
                      src={kycData.idFrontUrl}
                      alt="Front ID"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                  </a>
                </div>
              )}

              {kycData.idBackUrl && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-gray-400 font-mono">Back Side</span>
                  <a
                    href={kycData.idBackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative aspect-[4/3] rounded-lg bg-[#121212] border border-white/10 overflow-hidden flex items-center justify-center group hover:border-[#00A070]/50 transition-colors"
                  >
                    <img
                      src={kycData.idBackUrl}
                      alt="Back ID"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 3: Unsubmitted or Rejected Form (Matching Screenshot 8)
  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      {/* Hidden file input elements */}
      <input
        ref={frontInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
        className="hidden"
        onChange={(e) => handleFileUpload(e, "front")}
      />
      <input
        ref={backInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
        className="hidden"
        onChange={(e) => handleFileUpload(e, "back")}
      />

      <header className="flex items-center p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
        <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <span className="font-bold text-lg ml-4">Real-name Verification</span>
      </header>

      <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto w-full">
        {kycData?.status === "REJECTED" && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-3 text-red-400 text-xs animate-in fade-in">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Application Rejected by Compliance Team</span>
              <span>Reason: {kycData.rejectionReason || "Please verify document clarity and re-upload valid photos."}</span>
              <span className="block mt-1 text-[11px] text-gray-400">You may update your details and re-upload new documents below.</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-300">Personal ID Number</label>
            <input
              type="text"
              placeholder="Please enter your Personal ID Number"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 rounded-xl outline-none text-sm text-white font-mono placeholder:text-gray-500 transition-colors"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-300">Contact address</label>
            <input
              type="text"
              placeholder="Please enter contact address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-[#1A1C24] border border-white/10 focus:border-[#00A070] p-4 rounded-xl outline-none text-sm text-white placeholder:text-gray-500 transition-colors"
              required
            />
          </div>

          {/* Document Upload Area matching Screenshot 8 */}
          <div className="grid grid-cols-2 gap-3.5 mt-1">
            {/* Front side upload */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-gray-400 h-8 flex items-center">
                Front side of ID Photo
              </span>
              <button
                type="button"
                onClick={() => frontInputRef.current?.click()}
                disabled={frontUploading}
                className={`relative w-full aspect-[4/3] rounded-xl flex flex-col items-center justify-center border-2 border-dashed transition-all overflow-hidden cursor-pointer ${
                  idFrontUrl
                    ? "bg-[#00A070]/10 border-[#00A070] text-[#00A070]"
                    : "bg-[#1A1C24] border-white/10 hover:border-[#00A070]/60 text-gray-500"
                }`}
              >
                {frontUploading ? (
                  <div className="flex flex-col items-center gap-1.5 text-gray-300">
                    <Loader2 className="w-6 h-6 animate-spin text-[#00A070]" />
                    <span className="text-[10px] font-mono">Uploading...</span>
                  </div>
                ) : idFrontUrl ? (
                  <>
                    <img
                      src={idFrontUrl}
                      alt="Front ID Preview"
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="relative z-10 flex flex-col items-center bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-xs">
                      <CheckCircle className="w-5 h-5 mb-0.5 text-[#00A070]" />
                      <span className="text-[10px] font-bold text-white">Attached</span>
                      <span className="text-[9px] text-gray-300 underline mt-0.5">Click to replace</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mb-1 text-gray-400" />
                    <span className="text-xs font-medium text-gray-300">+ Upload</span>
                    <span className="text-[9px] text-gray-500 mt-0.5 font-mono">Max 5MB</span>
                  </>
                )}
              </button>
              {frontFileName && (
                <span className="text-[10px] text-gray-400 font-mono truncate px-1" title={frontFileName}>
                  {frontFileName}
                </span>
              )}
            </div>

            {/* Back side upload */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-gray-400 h-8 flex items-center">
                Back side of ID Photo
              </span>
              <button
                type="button"
                onClick={() => backInputRef.current?.click()}
                disabled={backUploading}
                className={`relative w-full aspect-[4/3] rounded-xl flex flex-col items-center justify-center border-2 border-dashed transition-all overflow-hidden cursor-pointer ${
                  idBackUrl
                    ? "bg-[#00A070]/10 border-[#00A070] text-[#00A070]"
                    : "bg-[#1A1C24] border-white/10 hover:border-[#00A070]/60 text-gray-500"
                }`}
              >
                {backUploading ? (
                  <div className="flex flex-col items-center gap-1.5 text-gray-300">
                    <Loader2 className="w-6 h-6 animate-spin text-[#00A070]" />
                    <span className="text-[10px] font-mono">Uploading...</span>
                  </div>
                ) : idBackUrl ? (
                  <>
                    <img
                      src={idBackUrl}
                      alt="Back ID Preview"
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="relative z-10 flex flex-col items-center bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-xs">
                      <CheckCircle className="w-5 h-5 mb-0.5 text-[#00A070]" />
                      <span className="text-[10px] font-bold text-white">Attached</span>
                      <span className="text-[9px] text-gray-300 underline mt-0.5">Click to replace</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mb-1 text-gray-400" />
                    <span className="text-xs font-medium text-gray-300">+ Upload</span>
                    <span className="text-[9px] text-gray-500 mt-0.5 font-mono">Max 5MB</span>
                  </>
                )}
              </button>
              {backFileName && (
                <span className="text-[10px] text-gray-400 font-mono truncate px-1" title={backFileName}>
                  {backFileName}
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || frontUploading || backUploading}
            className="w-full py-4 mt-3 bg-gradient-to-r from-[#00A070] to-emerald-400 hover:from-[#00b880] hover:to-emerald-300 text-white font-bold rounded-xl text-base shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Submitting Verification...</span>
              </>
            ) : (
              "Submit Verification"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
