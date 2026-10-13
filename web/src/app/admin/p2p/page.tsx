import { getAdminP2pStats, getAdminP2pOrders, getAdminP2pDisputes } from "@/actions/admin";
import Link from "next/link";
import {
  ArrowLeftRight,
  TrendingUp,
  AlertTriangle,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";

export default async function AdminP2PPage() {
  const [stats, recentOrders, openDisputes] = await Promise.all([
    getAdminP2pStats().catch(() => ({
      totalOrders: 0,
      completedOrders: 0,
      disputedOrders: 0,
      totalDisputes: 0,
      activeAds: 0,
      openDisputes: 0,
      totalVolumeFiat: 0,
      totalVolumeCrypto: 0,
    })),
    getAdminP2pOrders().catch(() => []),
    getAdminP2pDisputes({ status: "OPEN" }).catch(() => []),
  ]);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5 sm:gap-3">
            <ArrowLeftRight className="w-6 h-6 sm:w-8 sm:h-8 text-[#00A070] shrink-0" />
            <span>P2P Marketplace Oversight</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-xl">
            Real-time escrow monitoring, disputes moderation, and peer-to-peer volume analytics.
          </p>
        </div>

        {/* Quick Action Navigation */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            href="/admin/p2p/payment-methods"
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-bold transition-colors text-center shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-[#00A070] shrink-0" />
            <span className="truncate">Payment Methods</span>
          </Link>
          <Link
            href="/admin/p2p/disputes"
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-xs font-bold transition-colors text-center shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">Open Disputes ({stats.openDisputes || 0})</span>
          </Link>
          <Link
            href="/admin/p2p/orders"
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A070] text-white hover:bg-[#00B07C] text-xs font-bold transition-colors shadow-lg shadow-emerald-950/30 text-center"
          >
            <span>All P2P Orders</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-3.5 sm:p-5 shadow-lg">
          <p className="text-[11px] sm:text-xs text-gray-400 mb-1">Total Orders</p>
          <p className="text-xl sm:text-2xl font-black text-white font-mono">{stats.totalOrders}</p>
          <p className="text-[10px] sm:text-[11px] text-emerald-400 mt-1">{stats.completedOrders} completed</p>
        </div>

        <div className="bg-[#161822] border border-white/5 rounded-2xl p-3.5 sm:p-5 shadow-lg overflow-hidden">
          <p className="text-[11px] sm:text-xs text-gray-400 mb-1">Completed Fiat Volume</p>
          <p
            className="text-lg sm:text-2xl font-black text-emerald-400 font-mono truncate"
            title={`$${Number(stats.totalVolumeFiat).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          >
            ${Number(stats.totalVolumeFiat).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1 truncate">
            {Number(stats.totalVolumeCrypto).toLocaleString()} crypto units
          </p>
        </div>

        <div className="bg-[#161822] border border-white/5 rounded-2xl p-3.5 sm:p-5 shadow-lg">
          <p className="text-[11px] sm:text-xs text-gray-400 mb-1">Active Advertisements</p>
          <p className="text-xl sm:text-2xl font-black text-[#00A070] font-mono">{stats.activeAds}</p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1">Live in marketplace</p>
        </div>

        <div className="bg-[#161822] border border-white/5 rounded-2xl p-3.5 sm:p-5 shadow-lg">
          <p className="text-[11px] sm:text-xs text-gray-400 mb-1">Pending Disputes</p>
          <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono">{stats.openDisputes}</p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1">{stats.totalDisputes} total cases</p>
        </div>
      </div>

      {/* Disputes Alert Box */}
      {openDisputes.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Pending Disputes Awaiting Resolution ({openDisputes.length})</span>
            </div>
            <Link
              href="/admin/p2p/disputes"
              className="text-xs text-amber-400 hover:underline font-semibold"
            >
              Go to Resolution Console →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {openDisputes.slice(0, 3).map((dsp: any) => (
              <div key={dsp.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-white block">#{dsp.disputeNumber} • Order #{dsp.order?.orderNumber}</span>
                  <span className="text-gray-400 mt-0.5 block line-clamp-2">{dsp.reason} - {dsp.description}</span>
                </div>
                <Link
                  href="/admin/p2p/disputes"
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-semibold hover:bg-amber-500/30 text-center shrink-0 w-full sm:w-auto"
                >
                  Review Case
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders Overview */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#00A070]" /> Recent P2P Transactions
          </h2>
          <Link href="/admin/p2p/orders" className="text-xs text-[#00A070] hover:underline font-semibold">
            View All ({recentOrders.length}) →
          </Link>
        </div>

        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-white/5">
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">
              No P2P transactions recorded yet.
            </div>
          ) : (
            recentOrders.slice(0, 8).map((ord: any) => (
              <div key={ord.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-white text-xs block">#{ord.orderNumber}</span>
                    <span className="text-[10px] text-gray-500">{new Date(ord.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      ord.status === "COMPLETED"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : ord.status === "DISPUTED"
                        ? "bg-amber-500/20 text-amber-400"
                        : ord.status === "CANCELLED"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {ord.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Fiat Amount</span>
                    <span className="font-mono font-bold text-white text-xs">
                      {Number(ord.fiatAmount).toLocaleString()} {ord.fiatCurrency}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Crypto Volume</span>
                    <span className="font-mono font-bold text-[#00A070] text-xs">
                      {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Buyer:</span>
                    <span className="truncate text-gray-300 max-w-[200px]">{ord.buyer?.email || ord.buyer?.name || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Seller:</span>
                    <span className="truncate text-gray-300 max-w-[200px]">{ord.seller?.email || ord.seller?.name || "N/A"}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px] text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-[#121212]/50 text-gray-400 uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Order ID & Date</th>
                <th className="px-6 py-4">Buyer</th>
                <th className="px-6 py-4">Seller</th>
                <th className="px-6 py-4">Fiat Amount</th>
                <th className="px-6 py-4">Crypto Volume</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No P2P transactions recorded yet.
                  </td>
                </tr>
              ) : (
                recentOrders.slice(0, 10).map((ord: any) => (
                  <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-white block">#{ord.orderNumber}</span>
                      <span className="text-[11px] text-gray-400">{new Date(ord.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{ord.buyer?.email}</td>
                    <td className="px-6 py-4 text-gray-300">{ord.seller?.email}</td>
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      {Number(ord.fiatAmount).toLocaleString()} {ord.fiatCurrency}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-[#00A070]">
                      {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ord.status === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : ord.status === "DISPUTED"
                            ? "bg-amber-500/20 text-amber-400"
                            : ord.status === "CANCELLED"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {ord.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
