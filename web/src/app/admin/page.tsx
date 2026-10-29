import { 
  Users, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  TrendingUp, 
  FileCheck, 
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Scale
} from "lucide-react";
import Link from "next/link";
import { getAdminStats } from "@/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#161822] to-[#1E202B] p-4 sm:p-6 rounded-2xl border border-white/5 shadow-xl min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
            Administrative Operations Console
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time platform ledger, risk controls, user account management, and trading oversight.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/users"
            className="px-4 py-2 bg-[#00A070] hover:bg-[#00b880] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-[#00A070]/20"
          >
            Manage Users
          </Link>
        </div>
      </div>

      {/* Pending Action Alerts */}
      {(stats.pendingKycCount > 0 || stats.pendingDepositsCount > 0 || stats.pendingWithdrawalsCount > 0 || ((stats as any).pendingDisputesCount || 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {((stats as any).pendingDisputesCount || 0) > 0 && (
            <Link
              href="/admin/p2p/disputes"
              className="flex items-center justify-between p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs text-amber-300 hover:bg-amber-500/25 transition-all min-w-0 shadow-lg shadow-amber-950/20"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Scale className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span className="truncate"><strong>{(stats as any).pendingDisputesCount}</strong> Disputes requiring review</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 shrink-0 ml-2" />
            </Link>
          )}

          {stats.pendingKycCount > 0 && (
            <Link
              href="/admin/kyc"
              className="flex items-center justify-between p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 hover:bg-amber-500/15 transition-colors min-w-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate"><strong>{stats.pendingKycCount}</strong> Pending KYC applications</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 shrink-0 ml-2" />
            </Link>
          )}

          {stats.pendingDepositsCount > 0 && (
            <Link
              href="/admin/deposits"
              className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 hover:bg-emerald-500/15 transition-colors min-w-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate"><strong>{stats.pendingDepositsCount}</strong> Deposit requests awaiting review</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 shrink-0 ml-2" />
            </Link>
          )}

          {stats.pendingWithdrawalsCount > 0 && (
            <Link
              href="/admin/withdrawals"
              className="flex items-center justify-between p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 hover:bg-rose-500/15 transition-colors min-w-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ArrowUpCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate"><strong>{stats.pendingWithdrawalsCount}</strong> Withdrawal requests awaiting review</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 shrink-0 ml-2" />
            </Link>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Users */}
        <div className="bg-[#161822] border border-white/5 p-4 sm:p-5 rounded-2xl min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-3">
            <span>Total Accounts</span>
            <Users className="w-4 h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight break-all">
            {stats.totalUsers}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Platform Members</div>
        </div>

        {/* Card 2: Deposits */}
        <div className="bg-[#161822] border border-white/5 p-4 sm:p-5 rounded-2xl min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-3">
            <span>Total Deposits</span>
            <ArrowDownCircle className="w-4 h-4 text-[#00A070] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight break-all" title={`$${stats.totalDeposited.toFixed(2)}`}>
            ${stats.totalDeposited.toFixed(2)}
          </div>
          <div className="text-[11px] text-[#00A070] mt-1 font-mono">Approved Inflow</div>
        </div>

        {/* Card 3: Withdrawals */}
        <div className="bg-[#161822] border border-white/5 p-4 sm:p-5 rounded-2xl min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-3">
            <span>Total Withdrawals</span>
            <ArrowUpCircle className="w-4 h-4 text-rose-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight break-all" title={`$${stats.totalWithdrawn.toFixed(2)}`}>
            ${stats.totalWithdrawn.toFixed(2)}
          </div>
          <div className="text-[11px] text-rose-400 mt-1 font-mono">Approved Outflow</div>
        </div>

        {/* Card 4: Orders & Volume */}
        <div className="bg-[#161822] border border-white/5 p-4 sm:p-5 rounded-2xl min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-3">
            <span>Active Positions</span>
            <TrendingUp className="w-4 h-4 text-purple-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight break-all">
            {stats.activeOrders}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-mono">Open Contracts</div>
        </div>
      </div>

      {/* Quick Access Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <Link
          href="/admin/users"
          className="bg-[#161822] hover:bg-[#1E202B] border border-white/5 p-5 rounded-2xl transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-white mb-1">User & Asset Management</h3>
          <p className="text-xs text-gray-400">
            Inspect user wallets, adjust balances with audit trail, and manage account statuses.
          </p>
        </Link>

        <Link
          href="/admin/trading"
          className="bg-[#161822] hover:bg-[#1E202B] border border-white/5 p-5 rounded-2xl transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#00A070]/10 text-[#00A070] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-white mb-1">Trading & Position Monitor</h3>
          <p className="text-xs text-gray-400">
            Real-time inspection of active Perpetual contracts and settled Option records.
          </p>
        </Link>

        <Link
          href="/admin/deposits"
          className="bg-[#161822] hover:bg-[#1E202B] border border-white/5 p-5 rounded-2xl transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ArrowDownCircle className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-white mb-1">Financial Inflow & Deposits</h3>
          <p className="text-xs text-gray-400">
            Verify bank transfer UTR references and approve instant wallet balance credits.
          </p>
        </Link>
      </div>
    </div>
  );
}
