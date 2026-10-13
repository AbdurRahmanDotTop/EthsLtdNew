import { getAdminP2pOrders } from "@/actions/admin";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default async function AdminP2POrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const { status, search } = await searchParams;
  const orders = await getAdminP2pOrders({ status, search }).catch(() => []);

  const tabs = [
    { label: "All Orders", val: "ALL" },
    { label: "Awaiting Payment", val: "AWAITING_PAYMENT" },
    { label: "Paid / Verifying", val: "PAYMENT_MARKED" },
    { label: "Completed", val: "COMPLETED" },
    { label: "Disputed", val: "DISPUTED" },
    { label: "Cancelled", val: "CANCELLED" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <Link
          href="/admin/p2p"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to P2P Oversight
        </Link>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">
          All P2P Orders
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Complete audit history and escrow status across all peer-to-peer orders.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 pt-1 -mx-1 px-1">
        {tabs.map((t) => {
          const isActive = (!status && t.val === "ALL") || status === t.val;
          return (
            <Link
              key={t.val}
              href={`/admin/p2p/orders${t.val === "ALL" ? "" : `?status=${t.val}`}`}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? "bg-[#00A070] text-white shadow-md"
                  : "bg-[#161822] text-gray-400 border border-white/5 hover:text-white"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Orders Container */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-white/5">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">
              No P2P orders found matching filters.
            </div>
          ) : (
            orders.map((ord: any) => (
              <div key={ord.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-white text-xs block">#{ord.orderNumber}</span>
                    <span className="text-[10px] text-gray-500">{new Date(ord.createdAt).toLocaleString()}</span>
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
                      {Number(ord.fiatAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ord.fiatCurrency}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Crypto Volume</span>
                    <span className="font-mono font-bold text-[#00A070] text-xs">
                      {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Buyer:</span>
                    <span className="truncate text-gray-300 max-w-[200px] font-medium">{ord.buyer?.email || ord.buyer?.name || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Seller:</span>
                    <span className="truncate text-gray-300 max-w-[200px] font-medium">{ord.seller?.email || ord.seller?.name || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-gray-500">Payment Method:</span>
                    <span className="text-gray-300 font-medium uppercase">{ord.paymentMethod?.replace(/_/g, " ") || "N/A"}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-[#121212]/50 text-gray-400 uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Order ID & Date</th>
                <th className="px-6 py-4">Buyer Details</th>
                <th className="px-6 py-4">Seller Details</th>
                <th className="px-6 py-4">Crypto Volume</th>
                <th className="px-6 py-4">Fiat Value</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-500">
                    No P2P orders found matching filters.
                  </td>
                </tr>
              ) : (
                orders.map((ord: any) => (
                  <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-white block">#{ord.orderNumber}</span>
                      <span className="text-[11px] text-gray-500">{new Date(ord.createdAt).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white block">{ord.buyer?.name || "Buyer"}</span>
                      <span className="text-gray-400 text-[11px]">{ord.buyer?.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white block">{ord.seller?.name || "Seller"}</span>
                      <span className="text-gray-400 text-[11px]">{ord.seller?.email}</span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-[#00A070]">
                      {Number(ord.cryptoAmount).toLocaleString()} {ord.asset}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      {Number(ord.fiatAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ord.fiatCurrency}
                    </td>
                    <td className="px-6 py-4 uppercase text-gray-300">
                      {ord.paymentMethod?.replace(/_/g, " ")}
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
