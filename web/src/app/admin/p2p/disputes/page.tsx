"use client";

import { useEffect, useState } from "react";
import { getAdminP2pDisputes, resolveAdminP2pDispute } from "@/actions/admin";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Scale,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminP2PDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Selected dispute for resolution
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
  const [decision, setDecision] = useState<"BUYER_WINS" | "SELLER_WINS" | "DISMISSED">("BUYER_WINS");
  const [notes, setNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const fetchDisputes = async () => {
    setIsLoading(true);
    try {
      const res = await getAdminP2pDisputes(filter === "ALL" ? undefined : { status: filter });
      setDisputes(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [filter]);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;

    setIsResolving(true);
    try {
      const releaseEscrowTo =
        decision === "BUYER_WINS" ? "BUYER" : decision === "SELLER_WINS" ? "SELLER" : "NONE";

      const res = await resolveAdminP2pDispute(selectedDispute.id, {
        decision,
        resolutionNotes: notes,
        releaseEscrowTo,
      });

      if (res.success) {
        toast.success(`Dispute ${selectedDispute.disputeNumber} resolved with decision ${decision}`);
        setSelectedDispute(null);
        setNotes("");
        fetchDisputes();
      } else {
        toast.error(res.error || "Failed to resolve dispute");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve dispute");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <Link
          href="/admin/p2p"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to P2P Oversight
        </Link>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5 sm:gap-3">
          <Scale className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 shrink-0" />
          <span>P2P Dispute Resolution Console</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Review evidence, investigate counterparty claims, and authorize final escrow disposition.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 pt-1 -mx-1 px-1">
        {["ALL", "OPEN", "RESOLVED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              filter === s
                ? "bg-amber-500 text-black shadow-lg"
                : "bg-[#161822] text-gray-400 border border-white/5 hover:text-white"
            }`}
          >
            {s === "ALL" ? "All Cases" : s === "OPEN" ? "Pending Open Cases" : "Resolved Cases"}
          </button>
        ))}
      </div>

      {/* Container */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-white/5">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400 mx-auto mb-2" />
              <p className="text-xs">Loading dispute cases...</p>
            </div>
          ) : disputes.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">
              No disputes found in this filter.
            </div>
          ) : (
            disputes.map((dsp: any) => {
              const ord = dsp.order || {};
              const isResolved = dsp.status === "RESOLVED";

              return (
                <div key={dsp.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-white text-xs block">#{dsp.disputeNumber}</span>
                      <span className="text-[10px] text-gray-500">{new Date(dsp.createdAt).toLocaleDateString()}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isResolved
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {dsp.status} {dsp.decision ? `(${dsp.decision})` : ""}
                    </span>
                  </div>

                  <div className="bg-white/[0.02] p-2.5 rounded-xl border border-white/5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">Associated Order:</span>
                      <span className="font-bold text-white text-[11px]">#{ord.orderNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">Escrow Amount:</span>
                      <span className="font-mono text-emerald-400 font-semibold text-xs">
                        {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}{" "}
                        <span className="text-gray-400 text-[10px]">
                          ({Number(ord.fiatAmount).toLocaleString()} {ord.fiatCurrency})
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="text-amber-300 font-semibold text-xs">{dsp.reason}</p>
                    <p className="text-gray-400 text-[11px] line-clamp-2">{dsp.description}</p>
                  </div>

                  <div className="text-[11px] text-gray-400 space-y-0.5 pt-1 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Initiator:</span>
                      <span className="text-gray-300 truncate max-w-[200px]">{dsp.initiator?.name || dsp.initiator?.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Buyer:</span>
                      <span className="text-gray-300 truncate max-w-[200px]">{ord.buyer?.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Seller:</span>
                      <span className="text-gray-300 truncate max-w-[200px]">{ord.seller?.email}</span>
                    </div>
                  </div>

                  {!isResolved && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedDispute(dsp);
                        setNotes("");
                        setDecision("BUYER_WINS");
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs h-9 cursor-pointer"
                    >
                      Resolve Case
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-[#121212]/50 text-gray-400 uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Dispute & Date</th>
                <th className="px-6 py-4">Order & Escrow Amount</th>
                <th className="px-6 py-4">Initiator / Parties</th>
                <th className="px-6 py-4">Reason & Claims</th>
                <th className="px-6 py-4">Status / Decision</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-3" />
                    <p className="text-xs">Loading dispute cases...</p>
                  </td>
                </tr>
              ) : disputes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                    No disputes found in this filter.
                  </td>
                </tr>
              ) : (
                disputes.map((dsp: any) => {
                  const ord = dsp.order || {};
                  const isResolved = dsp.status === "RESOLVED";

                  return (
                    <tr key={dsp.id} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <span className="font-bold text-white block">#{dsp.disputeNumber}</span>
                        <span className="text-[11px] text-gray-500">{new Date(dsp.createdAt).toLocaleDateString()}</span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-bold text-white block">Order #{ord.orderNumber}</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}
                        </span>
                        <span className="text-gray-400 block text-[11px]">
                          ({Number(ord.fiatAmount).toLocaleString()} {ord.fiatCurrency})
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-white block font-semibold">
                          By: {dsp.initiator?.name || dsp.initiator?.email}
                        </span>
                        <span className="text-gray-400 text-[11px] block">Buyer: {ord.buyer?.email}</span>
                        <span className="text-gray-400 text-[11px] block">Seller: {ord.seller?.email}</span>
                      </td>

                      <td className="px-6 py-4 max-w-xs">
                        <span className="font-semibold text-amber-300 block">{dsp.reason}</span>
                        <p className="text-gray-400 text-[11px] line-clamp-2 mt-0.5">{dsp.description}</p>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isResolved
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {dsp.status} {dsp.decision ? `(${dsp.decision})` : ""}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {!isResolved ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedDispute(dsp);
                              setNotes("");
                              setDecision("BUYER_WINS");
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs h-8 cursor-pointer"
                          >
                            Resolve Case
                          </Button>
                        ) : (
                          <span className="text-[11px] text-gray-500">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolution Modal */}
      {selectedDispute && (
        <Dialog open={Boolean(selectedDispute)} onOpenChange={() => setSelectedDispute(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" /> Adjudicate Dispute #{selectedDispute.disputeNumber}
              </DialogTitle>
              <DialogDescription>
                Resolving this dispute will automatically transfer or refund locked escrow funds.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleResolve} className="space-y-4 py-2 text-xs">
              <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Order Number</span>
                  <span className="text-white font-bold">#{selectedDispute.order?.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Locked Escrow</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {selectedDispute.order?.cryptoAmount} {selectedDispute.order?.asset}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Claimant Reason</span>
                  <span className="text-amber-300 font-semibold">{selectedDispute.reason}</span>
                </div>
                <p className="text-gray-300 bg-white/5 p-2 rounded mt-2 leading-relaxed">
                  "{selectedDispute.description}"
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Select Ruling & Escrow Release
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                      decision === "BUYER_WINS"
                        ? "border-[#00A070] bg-[#00A070]/10 text-white"
                        : "border-white/10 bg-[#121212] text-gray-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="BUYER_WINS"
                      checked={decision === "BUYER_WINS"}
                      onChange={() => setDecision("BUYER_WINS")}
                      className="mt-0.5 accent-[#00A070]"
                    />
                    <div>
                      <span className="font-bold text-white block">Buyer Wins (Release Escrow to Buyer)</span>
                      <span className="text-[11px] text-gray-400">
                        Evidence verifies buyer paid the required amount. Crypto released to buyer wallet.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                      decision === "SELLER_WINS"
                        ? "border-amber-500 bg-amber-500/10 text-white"
                        : "border-white/10 bg-[#121212] text-gray-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="SELLER_WINS"
                      checked={decision === "SELLER_WINS"}
                      onChange={() => setDecision("SELLER_WINS")}
                      className="mt-0.5 accent-amber-500"
                    />
                    <div>
                      <span className="font-bold text-white block">Seller Wins (Return Escrow to Seller)</span>
                      <span className="text-[11px] text-gray-400">
                        Payment was not received or claim is invalid. Crypto returned to seller balance.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                      decision === "DISMISSED"
                        ? "border-red-500 bg-red-500/10 text-white"
                        : "border-white/10 bg-[#121212] text-gray-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="DISMISSED"
                      checked={decision === "DISMISSED"}
                      onChange={() => setDecision("DISMISSED")}
                      className="mt-0.5 accent-red-500"
                    />
                    <div>
                      <span className="font-bold text-white block">Dismiss Dispute</span>
                      <span className="text-[11px] text-gray-400">
                        Case dismissed without releasing escrow.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Administrative Audit Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record rationale and reference ID for the decision..."
                  className="w-full rounded-xl border border-white/10 bg-[#121212] p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedDispute(null)}
                  className="border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isResolving}
                  className="bg-[#00A070] hover:bg-[#00B07C] text-white font-bold"
                >
                  {isResolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Authorize Decision
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
