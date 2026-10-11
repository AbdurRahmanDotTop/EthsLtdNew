"use client";

import { useEffect, useState } from "react";
import { getAllTradingPositions } from "@/actions/admin";
import { 
  TrendingUp, 
  Search, 
  Filter, 
  RefreshCw, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  DollarSign,
  Layers
} from "lucide-react";
import { toast } from "sonner";

export default function AdminTradingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await getAllTradingPositions();
      setOrders(data);
    } catch {
      toast.error("Failed to fetch trading orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(o.user?.uid).includes(searchTerm);

    const matchesCategory =
      categoryFilter === "ALL" || o.category?.toLowerCase() === categoryFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && ["Executed", "Awaiting"].includes(o.status)) ||
      (statusFilter === "CLOSED" && ["Closed", "Win", "Loss"].includes(o.status));

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const activeCount = orders.filter((o) => ["Executed", "Awaiting"].includes(o.status)).length;
  const totalVolume = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalRealizedPnl = orders.reduce((sum, o) => sum + (o.realizedPnl || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#00A070]" />
            Trading Oversight & Order History
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time monitoring of all user Perpetual Positions, Option Contracts, and settlement records
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#1A1C24] border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#252836] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Total Orders</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">{orders.length}</div>
          <div className="text-[10px] text-gray-500 mt-1">Lifetime recorded</div>
        </div>

        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Active Positions</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">{activeCount}</div>
          <div className="text-[10px] text-gray-500 mt-1">Open Perpetual & Options</div>
        </div>

        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Total Margin Volume</span>
            <DollarSign className="w-4 h-4 text-[#00A070]" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            ${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Aggregated order values</div>
        </div>

        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Realized PnL</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`text-xl font-bold font-mono ${totalRealizedPnl >= 0 ? "text-[#00A070]" : "text-rose-400"}`}>
            {totalRealizedPnl >= 0 ? "+" : ""}${totalRealizedPnl.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Settled trader returns</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Symbol (BTC), Email, or UID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#10121A] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex bg-[#10121A] p-1 rounded-xl border border-white/5 text-xs">
            {["ALL", "PERPETUAL", "OPTION"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  categoryFilter === cat ? "bg-[#00A070] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {cat === "ALL" ? "All Types" : cat === "PERPETUAL" ? "Perpetual" : "Options"}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex bg-[#10121A] p-1 rounded-xl border border-white/5 text-xs">
            {["ALL", "ACTIVE", "CLOSED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === st ? "bg-[#1E202B] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {st === "ALL" ? "All Status" : st === "ACTIVE" ? "Active" : "Closed"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#12131C] text-gray-400 border-b border-white/5 uppercase font-mono text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Trader</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Pair / Side</th>
                <th className="px-5 py-3.5 text-right">Entry / Leverage</th>
                <th className="px-5 py-3.5 text-right">Amount / Margin</th>
                <th className="px-5 py-3.5 text-right">PnL / Outcome</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#00A070]" />
                      <span>Loading trading activity...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-500">
                    No matching orders or positions found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isLongOrRise = order.type?.includes("Long") || order.type?.includes("Rise");
                  const isActive = ["Executed", "Awaiting"].includes(order.status);
                  const isWin = order.status === "Win";
                  const isLoss = order.status === "Loss";

                  return (
                    <tr key={order.id} className="hover:bg-[#1C1F2E]/60 transition-colors">
                      {/* Trader */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">{order.user?.email}</div>
                        <div className="text-[10px] text-gray-400 font-mono">UID: {order.user?.uid}</div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                            order.category === "Option"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {order.category || "Perpetual"}
                        </span>
                      </td>

                      {/* Pair / Side */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {order.symbol}
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isLongOrRise
                                ? "bg-[#00A070]/15 text-[#00A070]"
                                : "bg-rose-500/15 text-rose-400"
                            }`}
                          >
                            {isLongOrRise ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {order.type}
                          </span>
                        </div>
                      </td>

                      {/* Entry Price & Leverage */}
                      <td className="px-5 py-4 text-right font-mono">
                        <div className="text-white">${order.price?.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-400">
                          {order.category === "Option"
                            ? `${order.duration || 60}s duration`
                            : `${order.leverage || 10}x Leverage`}
                        </div>
                      </td>

                      {/* Amount / Margin */}
                      <td className="px-5 py-4 text-right font-mono">
                        <div className="text-white">
                          ${order.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        {order.margin && (
                          <div className="text-[10px] text-gray-400">
                            Margin: ${order.margin.toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* PnL / Outcome */}
                      <td className="px-5 py-4 text-right font-mono">
                        {isActive ? (
                          <span className="text-amber-400 text-[11px] font-semibold">Active In-Market</span>
                        ) : order.realizedPnl !== null && order.realizedPnl !== undefined ? (
                          <span
                            className={`font-bold ${
                              order.realizedPnl >= 0 ? "text-[#00A070]" : "text-rose-400"
                            }`}
                          >
                            {order.realizedPnl >= 0 ? "+" : ""}${order.realizedPnl.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase font-mono ${
                            isActive
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : isWin
                              ? "bg-[#00A070]/20 text-[#00A070] border border-[#00A070]/30"
                              : isLoss
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-gray-500/15 text-gray-300 border border-gray-500/30"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="px-5 py-4 text-right text-gray-400 font-mono text-[11px]">
                        {new Date(order.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
