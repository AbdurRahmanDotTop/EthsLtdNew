"use client";

import { useEffect, useState } from "react";
import { getMyP2pAds, updateP2pAdStatus, deleteP2pAd } from "@/actions/p2p";
import { PlusCircle, Loader2, PauseCircle, PlayCircle, XCircle, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";

export default function MyAdsPage() {
  const [ads, setAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMyAds = async () => {
    setIsLoading(true);
    try {
      const res = await getMyP2pAds();
      if (res.success && res.data) {
        setAds(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyAds();
  }, []);

  const handleStatusChange = async (adId: string, status: "ONLINE" | "OFFLINE" | "PAUSED" | "CLOSED") => {
    setUpdatingId(adId);
    try {
      const res = await updateP2pAdStatus(adId, status);
      if (res.success) {
        toast.success(`Ad status updated`);
        fetchMyAds();
      } else {
        toast.error(res.error || "Failed to update ad status");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (adId: string) => {
    if (!window.confirm("Are you sure you want to delete this advertisement? If no orders have been placed, it will be removed permanently. Otherwise, it will be closed safely.")) {
      return;
    }

    setDeletingId(adId);
    try {
      const res = await deleteP2pAd(adId);
      if (res.success) {
        toast.success(res.message || "Advertisement removed successfully");
        fetchMyAds();
      } else {
        toast.error(res.error || "Failed to delete ad");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete advertisement");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-3 sm:px-6 md:px-8 py-6 md:py-12 pb-36 md:pb-16">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <Link
            href="/p2p"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Marketplace
          </Link>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">My Advertisements</h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage your active buy and sell offers, edit pricing and limits, or adjust visibility.
          </p>
        </div>

        <Link
          href="/p2p/post-ad"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A070] text-white hover:bg-[#00B07C] font-semibold text-xs transition-colors shadow-lg w-full sm:w-auto justify-center"
        >
          <PlusCircle className="w-4 h-4" /> Post New Ad
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-gray-400 bg-[#161822] rounded-2xl border border-white/10">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070] mx-auto mb-3" />
          <p className="text-xs">Loading your advertisements...</p>
        </div>
      ) : ads.length === 0 ? (
        <div className="py-20 text-center text-gray-400 bg-[#161822] rounded-2xl border border-white/10 p-6">
          <p className="text-sm font-semibold text-white mb-2">You haven't posted any advertisements yet.</p>
          <p className="text-xs text-gray-400 mb-5">Create an offer to start trading as a peer merchant.</p>
          <Link
            href="/p2p/post-ad"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00A070] text-white text-xs font-semibold"
          >
            Post Your First Ad
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile Card View (md:hidden) */}
          <div className="space-y-3.5 md:hidden">
            {ads.map((ad) => {
              const isSell = ad.side === "SELL";
              const isUpdating = updatingId === ad.id;
              const isDeleting = deletingId === ad.id;
              const isAdActive = ad.status === "ACTIVE" || ad.status === "ONLINE";
              const isAdPaused = ad.status === "PAUSED";

              return (
                <div
                  key={ad.id}
                  className="bg-[#161822] border border-white/10 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isSell ? "bg-red-500/20 text-red-400" : "bg-[#00A070]/20 text-[#00A070]"
                        }`}
                      >
                        {ad.side}
                      </span>
                      <span className="font-bold text-white text-sm">
                        {ad.asset} <span className="text-xs text-gray-400 font-normal">/ {ad.fiatCurrency}</span>
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isAdActive
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : isAdPaused
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                      }`}
                    >
                      {isAdActive ? "ACTIVE" : ad.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-[#121212] p-3 rounded-xl border border-white/5 text-xs">
                    <div>
                      <span className="text-gray-400 text-[11px] block">Unit Price</span>
                      <span className="font-mono font-bold text-white block mt-0.5">
                        {Number(ad.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ad.fiatCurrency}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Available / Total</span>
                      <span className="font-mono text-emerald-400 font-bold block mt-0.5 truncate">
                        {Number(ad.availableAmount).toLocaleString()} / {Number(ad.totalAmount).toLocaleString()} {ad.asset}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-white/5">
                      <span className="text-gray-400 text-[10px] block">Limits</span>
                      <span className="font-mono text-gray-300 text-xs block">
                        {Number(ad.minLimit).toLocaleString()} - {Number(ad.maxLimit).toLocaleString()} {ad.fiatCurrency}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/p2p/post-ad?id=${ad.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#00A070]" />
                      <span>Edit Ad</span>
                    </Link>

                    {isAdActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(ad.id, "PAUSED")}
                        className="border-white/10 text-xs h-9 text-amber-400 hover:text-amber-300 gap-1 px-3"
                      >
                        <PauseCircle className="w-3.5 h-3.5" /> Pause
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(ad.id, "ONLINE")}
                        className="border-white/10 text-xs h-9 text-emerald-400 hover:text-emerald-300 gap-1 px-3"
                      >
                        <PlayCircle className="w-3.5 h-3.5" /> Online
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => handleDelete(ad.id)}
                      className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                      title="Delete advertisement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block bg-[#161822] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/10 bg-[#121212]/50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Ad Type & Asset</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Available / Total</th>
                    <th className="px-6 py-4">Limits</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {ads.map((ad) => {
                    const isSell = ad.side === "SELL";
                    const isUpdating = updatingId === ad.id;
                    const isDeleting = deletingId === ad.id;
                    const isAdActive = ad.status === "ACTIVE" || ad.status === "ONLINE";
                    const isAdPaused = ad.status === "PAUSED";

                    return (
                      <tr key={ad.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isSell ? "bg-red-500/20 text-red-400" : "bg-[#00A070]/20 text-[#00A070]"
                              }`}
                            >
                              {ad.side}
                            </span>
                            <span className="font-bold text-white text-sm">{ad.asset}</span>
                            <span className="text-xs text-gray-400">/ {ad.fiatCurrency}</span>
                          </div>
                        </td>

                        <td className="px-6 py-5 font-mono font-bold text-white">
                          {Number(ad.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ad.fiatCurrency}
                        </td>

                        <td className="px-6 py-5 font-mono text-xs">
                          <span className="text-emerald-400 font-bold">{Number(ad.availableAmount).toLocaleString()}</span>
                          <span className="text-gray-500"> / {Number(ad.totalAmount).toLocaleString()} {ad.asset}</span>
                        </td>

                        <td className="px-6 py-5 font-mono text-xs text-gray-300">
                          {Number(ad.minLimit).toLocaleString()} - {Number(ad.maxLimit).toLocaleString()} {ad.fiatCurrency}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isAdActive
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : isAdPaused
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : ad.status === "COMPLETED"
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                            }`}
                          >
                            {isAdActive ? "ACTIVE" : ad.status}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/p2p/post-ad?id=${ad.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/5 transition-colors"
                              title="Edit Advertisement"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#00A070]" />
                              <span>Edit</span>
                            </Link>

                            {isAdActive ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => handleStatusChange(ad.id, "PAUSED")}
                                className="border-white/10 text-xs h-8 text-amber-400 hover:text-amber-300 gap-1"
                              >
                                <PauseCircle className="w-3.5 h-3.5" /> Pause
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => handleStatusChange(ad.id, "ONLINE")}
                                className="border-white/10 text-xs h-8 text-emerald-400 hover:text-emerald-300 gap-1"
                              >
                                <PlayCircle className="w-3.5 h-3.5" /> Go Online
                              </Button>
                            )}

                            {ad.status !== "CANCELED" && ad.status !== "CLOSED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => handleStatusChange(ad.id, "CLOSED")}
                                className="text-xs h-8 text-gray-400 hover:text-gray-200 hover:bg-white/5 gap-1"
                                title="Close advertisement"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Close
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleDelete(ad.id)}
                              className="text-xs h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1 p-2"
                              title="Delete advertisement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
