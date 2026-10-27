"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getP2pOrders } from "@/actions/p2p";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Loader2, Clock, CheckCircle2, AlertCircle, ChevronRight, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function P2POrdersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Immediate authentication guard
  useEffect(() => {
    if (!isAuthenticated && !isAuthLoading) {
      router.replace(`/login?redirect=${encodeURIComponent("/p2p/orders")}`);
    }
  }, [isAuthenticated, isAuthLoading, router]);

  const fetchOrders = async () => {
    if (!isAuthenticated && !isAuthLoading) return;
    setIsLoading(true);
    try {
      const res = await getP2pOrders({ status: filter === "ALL" ? undefined : filter });
      if (res.success && res.data) {
        setOrders(res.data);
      } else if (res.error?.includes("Unauthorized") || res.error?.includes("Log in")) {
        router.replace(`/login?redirect=${encodeURIComponent("/p2p/orders")}`);
        return;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [filter, isAuthenticated]);

  const tabs = [
    { label: "All Orders", val: "ALL" },
    { label: "Awaiting Payment", val: "AWAITING_PAYMENT" },
    { label: "Paid / Verifying", val: "PAYMENT_MARKED" },
    { label: "Completed", val: "COMPLETED" },
    { label: "Disputed", val: "DISPUTED" },
    { label: "Cancelled", val: "CANCELLED" },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-3 sm:px-6 md:px-8 py-6 md:py-12 pb-36 md:pb-16">
      <div className="mb-6 sm:mb-8">
        <Link
          href="/p2p"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </Link>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">My P2P Orders</h1>
        <p className="text-xs text-gray-400 mt-1">
          Track all ongoing escrow trades, payment confirmations, and completed peer-to-peer orders.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3 mb-4">
        {tabs.map((t) => (
          <button
            key={t.val}
            onClick={() => setFilter(t.val)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              filter === t.val
                ? "bg-[#00A070] text-white shadow-md"
                : "bg-[#161822] text-gray-400 border border-white/5 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="py-20 text-center text-gray-400 bg-[#161822] rounded-2xl border border-white/10">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070] mx-auto mb-3" />
          <p className="text-xs">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center text-gray-400 bg-[#161822] rounded-2xl border border-white/10 p-6">
          <p className="text-sm font-semibold text-white mb-2">No orders found in this category.</p>
          <p className="text-xs text-gray-400 mb-5">Visit the marketplace to place a new trade.</p>
          <Link
            href="/p2p"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00A070] text-white text-xs font-semibold"
          >
            Browse Offers
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile Card View (md:hidden) */}
          <div className="space-y-3.5 md:hidden">
            {orders.map((ord) => {
              const isBuyer = ord.role === "BUYER" || ord.buyer?.id === ord.buyerId;
              const statusClass =
                ord.status === "COMPLETED"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : ord.status === "CANCELLED" || ord.status === "EXPIRED"
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : ord.status === "DISPUTED"
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-blue-500/20 text-blue-400 border-blue-500/30";

              return (
                <div
                  key={ord.id}
                  className="bg-[#161822] border border-white/10 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-white block">
                        #{ord.orderNumber || ord.id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusClass}`}
                    >
                      {ord.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-[#121212] p-3 rounded-xl border border-white/5 text-xs">
                    <div>
                      <span className="text-gray-400 text-[11px] block">Fiat Amount</span>
                      <span className="font-mono font-bold text-white block mt-0.5">
                        {Number(ord.fiatAmount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {ord.fiatCurrency}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Crypto Volume</span>
                      <span className="font-mono font-bold text-[#00A070] block mt-0.5">
                        {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <span className="text-gray-400 text-[11px] truncate">
                      {ord.seller?.name || ord.buyer?.name || "Counterparty"}
                    </span>
                    <Link
                      href={`/p2p/order/${ord.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00A070] hover:bg-[#00B07C] text-white text-xs font-bold transition-colors shrink-0"
                    >
                      <span>Open Workspace</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
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
                    <th className="px-6 py-4">Order Number & Asset</th>
                    <th className="px-6 py-4">Fiat Amount</th>
                    <th className="px-6 py-4">Crypto Volume</th>
                    <th className="px-6 py-4">Counterparty</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {orders.map((ord) => {
                    return (
                      <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-5">
                          <div className="font-bold text-white text-sm">
                            #{ord.orderNumber || ord.id.slice(0, 8)}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 font-medium">
                            {ord.asset} • {new Date(ord.createdAt).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="px-6 py-5 font-mono font-bold text-white">
                          {Number(ord.fiatAmount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {ord.fiatCurrency}
                        </td>

                        <td className="px-6 py-5 font-mono text-[#00A070] font-bold text-sm">
                          {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}
                        </td>

                        <td className="px-6 py-5 text-xs text-gray-300">
                          {ord.seller?.name || ord.buyer?.name || "Counterparty"}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              ord.status === "COMPLETED"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : ord.status === "CANCELLED" || ord.status === "EXPIRED"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : ord.status === "DISPUTED"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            }`}
                          >
                            {ord.status.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <Link
                            href={`/p2p/order/${ord.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-colors"
                          >
                            View Order <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
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
