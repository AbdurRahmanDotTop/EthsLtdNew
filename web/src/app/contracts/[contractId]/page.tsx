"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  ShieldCheck,
  CheckCircle,
  Clock,
  Printer,
  ArrowLeft,
  MessageSquare,
  AlertCircle,
  Building2,
  Calendar,
  Lock,
  Download,
  Share2,
} from "lucide-react";
import { getContractById, signInvestmentContract } from "@/actions/rm";
import { DigitalSignaturePad } from "@/components/rm/DigitalSignaturePad";
import { toast } from "sonner";

export default function ContractPage({ params }: { params: Promise<{ contractId: string }> }) {
  const resolvedParams = use(params);
  const contractId = resolvedParams.contractId;
  const router = useRouter();

  const [contract, setContract] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);

  const loadContract = async () => {
    try {
      const res = await getContractById(contractId);
      if (res.success && res.contract) {
        setContract(res.contract);
        setPermissions(res.permissions);
        setCurrentUserId(res.currentUserId || null);
      } else {
        toast.error(res.error || "Contract could not be loaded.");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load contract.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContract();
  }, [contractId]);

  const handleSign = async (party: "PARTY_A" | "PARTY_B", signatureBase64: string) => {
    setIsSigning(true);
    try {
      const res = await signInvestmentContract({
        contractId,
        party,
        signatureBase64,
      });

      if (res.success) {
        toast.success(res.message);
        loadContract();
      } else {
        toast.error(res.error || "Failed to record signature.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSigning(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen py-12 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#00A070]/20 border-t-[#00A070] rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Loading Contract Document...</span>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen py-16 px-4 max-w-lg mx-auto text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Contract Unavailable</h2>
        <p className="text-xs text-gray-400">
          This contract document could not be retrieved or you do not have authorized signatory access.
        </p>
        <Link
          href="/relationship-managers"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E202B] text-gray-300 text-xs font-semibold hover:bg-[#252836]"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Relationship Managers
        </Link>
      </div>
    );
  }

  const isPartyA = currentUserId === contract.rmId || permissions?.isAdmin;
  const isPartyB = currentUserId === contract.userId || permissions?.isAdmin;
  const isFullySigned = contract.status === "FULLY_SIGNED";

  return (
    <div className="min-h-screen py-6 px-3 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-6">
      {/* Top Action & Navigation Bar (hidden during print) */}
      <div className="print:hidden flex items-center justify-between gap-4 pb-2 border-b border-white/5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          {isFullySigned ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#00A070]/15 border border-[#00A070]/30 text-[#00A070] text-xs font-bold">
              <CheckCircle className="w-3.5 h-3.5" /> Fully Signed & Active
            </span>
          ) : contract.status === "PARTIALLY_SIGNED" ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
              <Clock className="w-3.5 h-3.5" /> Partially Signed (1/2)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs font-bold">
              <Clock className="w-3.5 h-3.5" /> Awaiting Signatures
            </span>
          )}

          {/* Print/Download Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161822] hover:bg-[#1E202B] border border-white/10 text-gray-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>

          {/* Quick Chat Shortcut if Fully Signed */}
          {isFullySigned && (
            <Link
              href={`/rm/chat/${contract.connectionId}`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-bold shadow-md shadow-[#00A070]/20 transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Open Chat</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Contract Document Card */}
      <div className="rounded-2xl bg-white text-gray-900 shadow-2xl border border-gray-200 overflow-hidden font-sans">
        {/* Top Architectural Banner Image (matching reference screenshot 3) */}
        <div className="relative h-44 sm:h-56 w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80"
            alt="Financial Tower Architecture"
            className="w-full h-full object-cover opacity-80 mix-blend-luminosity filter contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-[#00A070] uppercase font-bold">
                ETHSLTD OFFICIAL ADVISORY ACCORD
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {contract.title}
              </h1>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-gray-300 font-mono">№ {contract.contractNumber}</div>
              <div className="text-[10px] text-emerald-400 font-semibold">VER: {contract.version}</div>
            </div>
          </div>
        </div>

        {/* Contract Content Body */}
        <div className="p-5 sm:p-8 space-y-6">
          {/* Signatory Party A Section */}
          <div className="space-y-1.5 border-b border-gray-100 pb-5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-900">
                Signatory: Party A (hereinafter referred to as Party A) <span className="text-rose-500">*</span>
              </label>
              {contract.partyASignedAt && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Signed
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="font-semibold text-gray-700">{contract.partyAName}</span>
              <span>•</span>
              <span>{contract.partyARole}</span>
            </div>

            {/* Interactive Signature Pad for Party A */}
            <DigitalSignaturePad
              value={contract.partyASignature}
              onChange={(sig) => handleSign("PARTY_A", sig)}
              disabled={isSigning || !permissions?.canSignPartyA}
              isReadOnly={Boolean(contract.partyASignature) || !permissions?.canSignPartyA}
              partyLabel="Party A (RM)"
              signedAt={contract.partyASignedAt}
              signerUid={contract.partyASignerUid}
            />

            {!contract.partyASignature && !permissions?.canSignPartyA && (
              <p className="text-[11px] text-gray-400 italic">
                Awaiting signature from Relationship Manager Party A.
              </p>
            )}
          </div>

          {/* Signatory Party B Section */}
          <div className="space-y-1.5 border-b border-gray-100 pb-5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-900">
                Signatory: Party B (hereinafter referred to as Party B) <span className="text-rose-500">*</span>
              </label>
              {contract.partyBSignedAt && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Signed
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="font-semibold text-gray-700">{contract.partyBName}</span>
              <span>•</span>
              <span>{contract.partyBRole}</span>
            </div>

            {/* Interactive Signature Pad for Party B */}
            <DigitalSignaturePad
              value={contract.partyBSignature}
              onChange={(sig) => handleSign("PARTY_B", sig)}
              disabled={isSigning || !permissions?.canSignPartyB}
              isReadOnly={Boolean(contract.partyBSignature) || !permissions?.canSignPartyB}
              partyLabel="Party B (Client)"
              signedAt={contract.partyBSignedAt}
              signerUid={contract.partyBSignerUid}
            />

            {!contract.partyBSignature && !permissions?.canSignPartyB && (
              <p className="text-[11px] text-gray-400 italic">
                Awaiting signature from Investor / Trader Party B.
              </p>
            )}
          </div>

          {/* Notice Banner */}
          <div className="text-[11px] font-bold text-gray-600 tracking-wide">
            * CLICK HERE TO SIGN
          </div>

          {/* Registered Platform Legal Identity (matching reference screenshot 3) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-gray-700 space-y-1">
            <div className="font-bold text-gray-900 text-xs">
              {contract.companyLegalName}
            </div>
            <div>Institutional Digital Asset Research & Advisory Group</div>
            <div className="text-gray-500 font-mono text-[11px]">
              website: <a href={contract.websiteUrl} target="_blank" rel="noreferrer" className="text-sky-600 underline">{contract.websiteUrl}</a>
            </div>
          </div>

          {/* Legal Text & Preamble */}
          <div className="text-xs text-gray-700 leading-relaxed space-y-3 font-serif">
            <p className="font-medium text-gray-800">
              According to the legal and regulatory agreements of the <strong>&ldquo;Virtual Currency International Investment Contract Law&rdquo;</strong>, Party A and Party B freely consent to enter into this mutual electronic advisory accord.
            </p>

            <div className="prose prose-xs max-w-none text-gray-700 font-sans space-y-4 whitespace-pre-line border-t border-gray-100 pt-3">
              {contract.termsText}
            </div>
          </div>

          {/* Execution Footer & Audit Box */}
          <div className="mt-8 pt-4 border-t-2 border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] text-gray-500 font-mono">
            <div>
              <div className="font-bold text-gray-800">DOCUMENT METADATA:</div>
              <div>Contract ID: {contract.contractNumber}</div>
              <div>Platform Engine: ETHSLTD v16.4</div>
              <div>Jurisdiction: {contract.jurisdiction}</div>
            </div>
            <div className="sm:text-right">
              <div className="font-bold text-gray-800">EXECUTION STATUS:</div>
              <div>Status: {contract.status}</div>
              <div>Effective: {contract.effectiveDate ? new Date(contract.effectiveDate).toLocaleDateString() : "Pending Completion"}</div>
              <div>Expiry: {contract.expiresAt ? new Date(contract.expiresAt).toLocaleDateString() : "N/A"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Post-Signing Next Step Callout */}
      {isFullySigned ? (
        <div className="print:hidden p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Relationship & Contract Activated!</h4>
              <p className="text-xs text-emerald-200/80">
                Both digital signatures have been recorded and sealed. Private 1-on-1 messaging is unlocked.
              </p>
            </div>
          </div>
          <Link
            href={`/rm/chat/${contract.connectionId}`}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-bold shadow-lg shadow-[#00A070]/20 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Launch Private Chat</span>
          </Link>
        </div>
      ) : (
        <div className="print:hidden p-4 rounded-xl bg-[#161822] border border-white/5 text-xs text-gray-400 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            {contract.status === "PARTIALLY_SIGNED"
              ? "One party has signed. Waiting for the counterparty signature to unlock active status and chat."
              : "Both parties must digitally sign above before private communication is permitted."}
          </span>
        </div>
      )}
    </div>
  );
}
