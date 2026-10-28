"use client";

import { useEffect, useState } from "react";
import { getAuditLogs } from "@/actions/admin";
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  Filter, 
  Clock, 
  UserCheck, 
  DollarSign, 
  FileCheck, 
  AlertTriangle 
} from "lucide-react";
import { toast } from "sonner";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs();
      setLogs(data);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction =
      actionFilter === "ALL" ||
      (actionFilter === "SECURITY"
        ? log.action?.includes("REGISTRATION") ||
          log.action?.includes("FLAGGED") ||
          log.action?.includes("BLOCKED") ||
          log.action?.includes("SECURITY") ||
          log.action?.includes("EMAIL_VERIFICATION")
        : log.action?.includes(actionFilter));

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    if (action.includes("APPROVAL") || action.includes("SUCCESS")) {
      return "bg-[#00A070]/15 text-[#00A070] border-[#00A070]/30";
    }
    if (action.includes("REJECTION") || action.includes("BANNED") || action.includes("BLOCKED")) {
      return "bg-rose-500/15 text-rose-400 border-rose-500/30 font-semibold";
    }
    if (action.includes("FLAGGED") || action.includes("SPAM")) {
      return "bg-purple-500/15 text-purple-400 border-purple-500/30 font-bold";
    }
    if (action.includes("ADJUSTMENT")) {
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    }
    if (action.includes("ROLE") || action.includes("STATUS")) {
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    }
    return "bg-gray-500/15 text-gray-400 border-gray-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
            <ShieldAlert className="w-5 h-5 text-[#00A070] shrink-0" />
            <span>Administrative Audit Trail</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Immutable log of all financial modifications, user verifications, balance adjustments, and privilege changes
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#1A1C24] border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#252836] transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between min-w-0">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Admin, Action, Target ID, or Details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#10121A] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070]"
          />
        </div>

        <div className="flex bg-[#10121A] p-1 rounded-xl border border-white/5 text-xs overflow-x-auto max-w-full">
          {[
            { label: "All Logs", value: "ALL" },
            { label: "Security & Anti-Spam", value: "SECURITY" },
            { label: "Adjustments", value: "ADJUSTMENT" },
            { label: "Deposits", value: "DEPOSIT" },
            { label: "Withdrawals", value: "WITHDRAWAL" },
            { label: "KYC", value: "KYC" },
            { label: "User Roles", value: "ROLE" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setActionFilter(item.value)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                actionFilter === item.value
                  ? "bg-[#00A070] text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden min-w-0">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-[#12131C] text-gray-400 border-b border-white/5 uppercase font-mono text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Admin Operator</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Target</th>
                <th className="px-5 py-3.5">Action Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#00A070]" />
                      <span>Loading audit entries...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#1C1F2E]/60 transition-colors">
                    {/* Timestamp */}
                    <td className="px-5 py-4 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    {/* Admin Operator */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{log.adminEmail}</div>
                      <div className="text-[10px] text-gray-500 font-mono">ID: {log.adminId?.slice(0, 8)}...</div>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Target */}
                    <td className="px-5 py-4 font-mono text-gray-300">
                      <div className="text-[11px] font-semibold text-white">{log.targetType}</div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[120px]">
                        {log.targetId}
                      </div>
                    </td>

                    {/* Details */}
                    <td className="px-5 py-4 text-gray-200">
                      <p className="line-clamp-2 leading-relaxed">{log.details}</p>
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
