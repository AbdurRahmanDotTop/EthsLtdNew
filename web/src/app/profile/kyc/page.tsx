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
  FileText,
  ShieldAlert,
  Info,
  Calendar,
  MapPin,
  User,
  CreditCard,
  Building,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { getKycStatus, submitKycApplication } from "@/actions/user";
import { getUserTradingInfo } from "@/actions/trade";
import { toast } from "sonner";
import KycDocumentViewer from "@/components/kyc/KycDocumentViewer";

type DocumentType = "PASSPORT" | "GOVERNMENT_ID" | "DRIVERS_LICENSE" | "RESIDENCE_PERMIT";

export default function KYCPage() {
  const [kycData, setKycData] = useState<any | null>(null);
  const [isKycVerified, setIsKycVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Active view tab for previewing front vs back in reviewed/pending state
  const [activePreviewSide, setActivePreviewSide] = useState<"front" | "back">("front");

  // Document Type Selection
  const [documentType, setDocumentType] = useState<DocumentType>("GOVERNMENT_ID");

  // Form Fields - Basic Identity
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");

  // Document Details
  const [idNumber, setIdNumber] = useState("");
  const [issuingCountry, setIssuingCountry] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  // Residential Address Details
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

  // Uploaded Document URLs & Names
  const [idFrontUrl, setIdFrontUrl] = useState<string>("");
  const [idBackUrl, setIdBackUrl] = useState<string>("");
  const [frontFileName, setFrontFileName] = useState<string>("");
  const [backFileName, setBackFileName] = useState<string>("");

  // Uploading & Submitting State
  const [frontUploading, setFrontUploading] = useState(false);
  const [backUploading, setBackUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingResubmission, setIsEditingResubmission] = useState(false);

  // File input refs
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const loadKyc = async () => {
    try {
      const [rawStatus, info] = await Promise.all([
        getKycStatus(),
        getUserTradingInfo(),
      ]);
      const status: any = rawStatus;
      setKycData(status);

      if (status?.status === "APPROVED") {
        setIsKycVerified(true);
      }

      if (status) {
        // Pre-fill fields if they exist
        if (status.documentType) setDocumentType(status.documentType as DocumentType);
        if (status.fullName) setFullName(status.fullName);
        if (status.dateOfBirth) setDateOfBirth(status.dateOfBirth);
        if (status.gender) setGender(status.gender);
        if (status.nationality) setNationality(status.nationality);
        if (status.idNumber) setIdNumber(status.idNumber);
        if (status.issuingCountry) setIssuingCountry(status.issuingCountry);
        if (status.issuingAuthority) setIssuingAuthority(status.issuingAuthority);
        if (status.issueDate) setIssueDate(status.issueDate);
        if (status.expiryDate) setExpiryDate(status.expiryDate);
        if (status.address) setAddress(status.address);
        if (status.city) setCity(status.city);
        if (status.state) setState(status.state);
        if (status.postalCode) setPostalCode(status.postalCode);
        if (status.country) setCountry(status.country);
        if (status.idFrontUrl) setIdFrontUrl(status.idFrontUrl);
        if (status.idBackUrl) setIdBackUrl(status.idBackUrl);
      }
    } catch (e) {
      console.error("Failed to load KYC status:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  // Handle document upload to secure private storage
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    side: "front" | "back"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Client-side size check (Max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error(
        `File size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller file.`
      );
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
      toast.error("Unsupported format. Allowed formats: JPG, PNG, WEBP, or PDF.");
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

      let data: any;
      const resText = await res.text();
      try {
        data = JSON.parse(resText);
      } catch {
        console.error("Non-JSON upload response:", resText);
        throw new Error(`Upload server error (${res.status}). Please try again.`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upload failed. Please try again.");
      }

      if (side === "front") {
        setIdFrontUrl(data.url);
        setFrontFileName(file.name);
        toast.success("Document Front/Main page attached successfully!");
      } else {
        setIdBackUrl(data.url);
        setBackFileName(file.name);
        toast.success("Document Back side attached successfully!");
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

    if (!idNumber.trim()) {
      toast.error("Please enter your Document ID Number.");
      return;
    }

    if (!address.trim()) {
      toast.error("Please enter your residential address.");
      return;
    }

    if (!idFrontUrl) {
      toast.error("Please upload the front/main page of your document.");
      return;
    }

    if (documentType !== "PASSPORT" && !idBackUrl) {
      toast.error("Please upload the back side of your ID document.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitKycApplication({
        documentType,
        fullName: fullName.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        gender: gender.trim() || undefined,
        nationality: nationality.trim() || undefined,
        idNumber: idNumber.trim(),
        issuingCountry: issuingCountry.trim() || undefined,
        issuingAuthority: issuingAuthority.trim() || undefined,
        issueDate: issueDate.trim() || undefined,
        expiryDate: expiryDate.trim() || undefined,
        address: address.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || undefined,
        idFrontUrl,
        idBackUrl: idBackUrl || undefined,
      });

      if (res.success) {
        toast.success(
          "KYC Application submitted successfully! Compliance team will review your documents."
        );
        setIsEditingResubmission(false);
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

  // View 1: APPROVED STATE
  if (isKycVerified || kycData?.status === "APPROVED") {
    return (
      <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-20 font-sans select-none">
        <header className="flex items-center p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
          <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <span className="font-bold text-lg ml-4">KYC Verification</span>
        </header>

        <div className="p-4 max-w-2xl mx-auto w-full space-y-4">
          <div className="flex justify-between items-center bg-[#1A1C24] p-5 rounded-2xl border border-white/5 shadow-xl">
            <div className="flex items-center gap-3">
              <FileCheck className="w-7 h-7 text-[#00A070]" />
              <div>
                <span className="text-white font-bold text-base block">Verified Identity</span>
                <span className="text-gray-400 text-xs">
                  Level 2 Compliance Verification Active & Unlocked
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[#00A070] bg-[#00A070]/10 px-3.5 py-1.5 rounded-full border border-[#00A070]/30">
              <CheckCircle className="w-4 h-4 fill-current" />
              <span className="font-bold text-xs uppercase tracking-wider">Verified</span>
            </div>
          </div>

          <div className="bg-[#1A1C24] p-5 rounded-2xl border border-white/5 text-xs text-gray-300 space-y-3 font-mono">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-gray-400">Document Type:</span>
              <span className="text-white font-bold">{kycData?.documentType?.replace("_", " ") || "GOVERNMENT ID"}</span>
            </div>
            {kycData?.fullName && (
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-400">Full Name:</span>
                <span className="text-white">{kycData.fullName}</span>
              </div>
            )}
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-gray-400">Verified ID Number:</span>
              <span className="text-white">
                {kycData?.idNumber
                  ? kycData.idNumber.length > 6
                    ? `${kycData.idNumber.slice(0, 3)}****${kycData.idNumber.slice(-3)}`
                    : kycData.idNumber
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-gray-400">Residential Address:</span>
              <span className="text-white">{kycData?.address || "Registered Address"}</span>
            </div>
            {kycData?.reviewedAt && (
              <div className="flex justify-between">
                <span className="text-gray-400">Approval Date:</span>
                <span className="text-[#00A070]">{new Date(kycData.reviewedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // View 2: PENDING OR ADDITIONAL INFO REQUIRED (Under Review view with Document Viewer)
  const isPending = kycData?.status === "PENDING";
  const isAdditionalInfo = kycData?.status === "ADDITIONAL_INFO_REQUIRED";

  if ((isPending || isAdditionalInfo) && !isEditingResubmission) {
    const currentDocUrl =
      activePreviewSide === "front" ? kycData?.idFrontUrl : kycData?.idBackUrl || kycData?.idFrontUrl;

    return (
      <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-20 font-sans">
        <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
          <div className="flex items-center">
            <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <span className="font-bold text-lg ml-4">KYC Application</span>
          </div>
          {isAdditionalInfo && (
            <button
              onClick={() => setIsEditingResubmission(true)}
              className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Update Documents
            </button>
          )}
        </header>

        <div className="p-4 max-w-2xl mx-auto w-full flex flex-col gap-5">
          {/* Status Banner */}
          {isPending ? (
            <div className="flex items-center justify-between bg-[#1A1C24] p-5 rounded-2xl border border-white/5 shadow-xl">
              <div className="flex items-center gap-3">
                <Clock className="w-7 h-7 text-amber-400" />
                <div>
                  <span className="text-white font-bold text-base block">Verification Pending</span>
                  <span className="text-gray-400 text-xs">
                    Our compliance team is thoroughly reviewing your submitted documents
                  </span>
                </div>
              </div>
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
                Under Review
              </span>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/40 p-5 rounded-2xl flex flex-col gap-3 text-amber-300">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-amber-300">
                    Action Required: Additional Information or Re-upload Needed
                  </h3>
                  <p className="text-xs text-amber-200/80 mt-1">
                    Compliance Remarks:{" "}
                    <span className="font-semibold text-white">
                      "{kycData?.additionalInfoRequired || "Please update your documents."}"
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingResubmission(true)}
                className="self-start text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Re-upload / Update Information Now
              </button>
            </div>
          )}

          {/* Interactive Document Preview Section */}
          <div className="bg-[#1A1C24] p-5 rounded-2xl border border-white/5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-white block">
                  Uploaded Identification Documents
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {kycData?.documentType?.replace("_", " ") || "IDENTITY DOCUMENT"} • Attempt #{kycData?.attemptCount || 1}
                </span>
              </div>

              {/* Side Switcher Tabs */}
              <div className="flex items-center bg-[#12141D] p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setActivePreviewSide("front")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activePreviewSide === "front"
                      ? "bg-[#00A070] text-white shadow"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Front Side
                </button>
                {kycData?.idBackUrl && (
                  <button
                    type="button"
                    onClick={() => setActivePreviewSide("back")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activePreviewSide === "back"
                        ? "bg-[#00A070] text-white shadow"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Back Side
                  </button>
                )}
              </div>
            </div>

            {/* Document Viewer Component (handles PDF iframe and interactive Image zoom/rotate/fullscreen) */}
            <KycDocumentViewer
              url={currentDocUrl}
              title={`${kycData?.documentType?.replace("_", " ") || "ID"} (${
                activePreviewSide === "front" ? "Front Side / Main Page" : "Back Side"
              })`}
              documentType={kycData?.documentType}
              className="w-full"
            />
          </div>

          {/* Detailed Submitted KYC Fields */}
          <div className="bg-[#1A1C24] p-5 rounded-2xl border border-white/5 space-y-3 font-mono text-xs">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block font-sans mb-1">
              Submitted Verification Data
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-400">
              <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-gray-500 block mb-0.5">DOCUMENT TYPE</span>
                <span className="text-gray-200 font-semibold">{kycData?.documentType?.replace("_", " ") || "GOVERNMENT ID"}</span>
              </div>
              <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-gray-500 block mb-0.5">DOCUMENT ID NUMBER</span>
                <span className="text-gray-200 font-semibold">{kycData?.idNumber}</span>
              </div>

              {kycData?.fullName && (
                <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 block mb-0.5">FULL NAME</span>
                  <span className="text-gray-200 font-semibold">{kycData.fullName}</span>
                </div>
              )}

              {kycData?.dateOfBirth && (
                <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 block mb-0.5">DATE OF BIRTH</span>
                  <span className="text-gray-200 font-semibold">{kycData.dateOfBirth}</span>
                </div>
              )}

              {kycData?.gender && (
                <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 block mb-0.5">GENDER</span>
                  <span className="text-gray-200 font-semibold">{kycData.gender}</span>
                </div>
              )}

              {kycData?.nationality && (
                <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 block mb-0.5">NATIONALITY</span>
                  <span className="text-gray-200 font-semibold">{kycData.nationality}</span>
                </div>
              )}

              {kycData?.issuingCountry && (
                <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 block mb-0.5">ISSUING COUNTRY</span>
                  <span className="text-gray-200 font-semibold">{kycData.issuingCountry}</span>
                </div>
              )}

              {kycData?.issuingAuthority && (
                <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 block mb-0.5">ISSUING AUTHORITY</span>
                  <span className="text-gray-200 font-semibold">{kycData.issuingAuthority}</span>
                </div>
              )}

              {kycData?.issueDate && (
                <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 block mb-0.5">ISSUE DATE</span>
                  <span className="text-gray-200 font-semibold">{kycData.issueDate}</span>
                </div>
              )}

              {kycData?.expiryDate && (
                <div className="bg-[#12141D] p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 block mb-0.5">EXPIRY DATE</span>
                  <span className="text-gray-200 font-semibold">{kycData.expiryDate}</span>
                </div>
              )}

              <div className="bg-[#12141D] p-3 rounded-xl border border-white/5 sm:col-span-2">
                <span className="text-[10px] text-gray-500 block mb-0.5">RESIDENTIAL ADDRESS</span>
                <span className="text-gray-200 font-semibold">
                  {[kycData?.address, kycData?.city, kycData?.state, kycData?.postalCode, kycData?.country]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row justify-between text-gray-500 text-[11px] gap-1">
              <span>Submitted On: {new Date(kycData?.createdAt).toLocaleString()}</span>
              <span>Status: {kycData?.status}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View 3: SUBMISSION / RE-SUBMISSION FORM
  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      {/* Hidden file inputs */}
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
        <span className="font-bold text-lg ml-4">
          {kycData?.status === "REJECTED" || isEditingResubmission
            ? "Update KYC Verification"
            : "Real-Name Identity Verification"}
        </span>
      </header>

      <div className="p-4 flex flex-col gap-5 max-w-2xl mx-auto w-full">
        {/* Rejection Alert */}
        {kycData?.status === "REJECTED" && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start gap-3 text-red-400 text-xs animate-in fade-in">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5 text-sm">Previous Verification Rejected</span>
              <span>Reason: {kycData.rejectionReason || "Please verify document clarity and re-upload valid photos."}</span>
              <span className="block mt-1 text-[11px] text-gray-400">
                You can review your details, attach clearer documents, and resubmit for approval.
              </span>
            </div>
          </div>
        )}

        {/* Additional Info Alert */}
        {kycData?.status === "ADDITIONAL_INFO_REQUIRED" && isEditingResubmission && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-start gap-3 text-amber-300 text-xs animate-in fade-in">
            <Info className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5 text-sm">Compliance Request</span>
              <span>Instructions: {kycData.additionalInfoRequired}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 1. Document Type Selector */}
          <div className="bg-[#1A1C24] p-5 rounded-2xl border border-white/5 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#00A070]" />
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                Select Identity Document Type
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: "GOVERNMENT_ID" as DocumentType, label: "Government ID", sub: "National ID Card" },
                { type: "PASSPORT" as DocumentType, label: "Passport", sub: "International" },
                { type: "DRIVERS_LICENSE" as DocumentType, label: "Driver License", sub: "Driving Permit" },
                { type: "RESIDENCE_PERMIT" as DocumentType, label: "Residence Permit", sub: "Resident Visa" },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setDocumentType(item.type)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    documentType === item.type
                      ? "bg-[#00A070]/15 border-[#00A070] text-white shadow-sm"
                      : "bg-[#141620] border-white/5 text-gray-400 hover:border-white/20"
                  }`}
                >
                  <span className="text-xs font-bold block">{item.label}</span>
                  <span className="text-[10px] text-gray-500 font-mono block mt-0.5">{item.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Basic Identity Details */}
          <div className="bg-[#1A1C24] p-5 rounded-2xl border border-white/5 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#00A070]" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Personal Identification
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">
                  Full Legal Name <span className="text-gray-500">(as shown on document)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Johnathan Alexander Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white placeholder:text-gray-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">
                  Document ID Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    documentType === "PASSPORT"
                      ? "e.g. A12345678"
                      : "Enter document / identity number"
                  }
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white font-mono placeholder:text-gray-500 transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white transition-colors"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other / Non-binary</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">Nationality</label>
                <input
                  type="text"
                  placeholder="e.g. United Kingdom, Singapore, etc."
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white placeholder:text-gray-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">Issuing Country</label>
                <input
                  type="text"
                  placeholder="e.g. United States, Germany"
                  value={issuingCountry}
                  onChange={(e) => setIssuingCountry(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white placeholder:text-gray-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">Issuing Authority</label>
                <input
                  type="text"
                  placeholder="e.g. Ministry of Interior, DVLA, Passport Office"
                  value={issuingAuthority}
                  onChange={(e) => setIssuingAuthority(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white placeholder:text-gray-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">Document Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white transition-colors"
                />
              </div>
            </div>
          </div>

          {/* 3. Address Details */}
          <div className="bg-[#1A1C24] p-5 rounded-2xl border border-white/5 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#00A070]" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Residential Address Verification
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">
                  Street Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="House number, Street name, Apt / Suite"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white placeholder:text-gray-500 transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">City</label>
                <input
                  type="text"
                  placeholder="e.g. London"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white placeholder:text-gray-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">State / Province</label>
                <input
                  type="text"
                  placeholder="e.g. Greater London"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white placeholder:text-gray-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">Postal / Zip Code</label>
                <input
                  type="text"
                  placeholder="e.g. SW1A 1AA"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white font-mono placeholder:text-gray-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">Country of Residence</label>
                <input
                  type="text"
                  placeholder="e.g. United Kingdom"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[#141620] border border-white/10 focus:border-[#00A070] p-3.5 rounded-xl outline-none text-xs text-white placeholder:text-gray-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* 4. Upload Documents Area */}
          <div className="bg-[#1A1C24] p-5 rounded-2xl border border-white/5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#00A070]" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Attach Documents (JPG, PNG, WEBP, or PDF)
                </h2>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Max 5MB each</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Front side upload */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-gray-300">
                  {documentType === "PASSPORT"
                    ? "Passport Bio / Photo Page (Front) *"
                    : "Front Side of ID Document *"}
                </span>

                <button
                  type="button"
                  onClick={() => frontInputRef.current?.click()}
                  disabled={frontUploading}
                  className={`relative w-full aspect-[4/3] rounded-2xl flex flex-col items-center justify-center border-2 border-dashed transition-all overflow-hidden cursor-pointer ${
                    idFrontUrl
                      ? "bg-[#00A070]/10 border-[#00A070] text-[#00A070]"
                      : "bg-[#141620] border-white/10 hover:border-[#00A070]/60 text-gray-400"
                  }`}
                >
                  {frontUploading ? (
                    <div className="flex flex-col items-center gap-1.5 text-gray-300">
                      <Loader2 className="w-7 h-7 animate-spin text-[#00A070]" />
                      <span className="text-xs font-mono">Uploading Front...</span>
                    </div>
                  ) : idFrontUrl ? (
                    <div className="w-full h-full p-2 flex flex-col items-center justify-center relative">
                      <KycDocumentViewer
                        url={idFrontUrl}
                        title="Front Document"
                        compact
                        className="w-full h-full"
                      />
                      <div className="absolute inset-x-2 bottom-2 bg-black/80 px-2 py-1 rounded text-center backdrop-blur-xs">
                        <span className="text-[10px] text-[#00A070] font-bold">Attached • Click to Replace</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center p-4 text-center">
                      <Upload className="w-7 h-7 mb-2 text-gray-400" />
                      <span className="text-xs font-bold text-gray-200">+ Upload Front / Bio Page</span>
                      <span className="text-[10px] text-gray-500 mt-1 font-mono">JPG, PNG, WEBP, or PDF</span>
                    </div>
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
                <span className="text-xs font-medium text-gray-300">
                  {documentType === "PASSPORT"
                    ? "Passport Cover / Second Page (Optional)"
                    : "Back Side of ID Document *"}
                </span>

                <button
                  type="button"
                  onClick={() => backInputRef.current?.click()}
                  disabled={backUploading}
                  className={`relative w-full aspect-[4/3] rounded-2xl flex flex-col items-center justify-center border-2 border-dashed transition-all overflow-hidden cursor-pointer ${
                    idBackUrl
                      ? "bg-[#00A070]/10 border-[#00A070] text-[#00A070]"
                      : "bg-[#141620] border-white/10 hover:border-[#00A070]/60 text-gray-400"
                  }`}
                >
                  {backUploading ? (
                    <div className="flex flex-col items-center gap-1.5 text-gray-300">
                      <Loader2 className="w-7 h-7 animate-spin text-[#00A070]" />
                      <span className="text-xs font-mono">Uploading Back...</span>
                    </div>
                  ) : idBackUrl ? (
                    <div className="w-full h-full p-2 flex flex-col items-center justify-center relative">
                      <KycDocumentViewer
                        url={idBackUrl}
                        title="Back Document"
                        compact
                        className="w-full h-full"
                      />
                      <div className="absolute inset-x-2 bottom-2 bg-black/80 px-2 py-1 rounded text-center backdrop-blur-xs">
                        <span className="text-[10px] text-[#00A070] font-bold">Attached • Click to Replace</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center p-4 text-center">
                      <Upload className="w-7 h-7 mb-2 text-gray-400" />
                      <span className="text-xs font-bold text-gray-200">
                        {documentType === "PASSPORT" ? "+ Upload Second Page" : "+ Upload Back Side"}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-1 font-mono">JPG, PNG, WEBP, or PDF</span>
                    </div>
                  )}
                </button>
                {backFileName && (
                  <span className="text-[10px] text-gray-400 font-mono truncate px-1" title={backFileName}>
                    {backFileName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-3">
            {isEditingResubmission && (
              <button
                type="button"
                onClick={() => setIsEditingResubmission(false)}
                className="w-1/3 py-4 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting || frontUploading || backUploading}
              className="flex-1 py-4 bg-gradient-to-r from-[#00A070] to-emerald-400 hover:from-[#00b880] hover:to-emerald-300 text-white font-bold rounded-xl text-base shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting Verification...</span>
                </>
              ) : (
                "Submit Identity Verification"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
