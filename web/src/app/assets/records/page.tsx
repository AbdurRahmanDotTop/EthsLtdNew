"use client";

import { useState, useEffect, Suspense } from "react";
import { ChevronLeft, Loader2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getUserRecords } from "@/actions/user";

function RecordsPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw" | "transactions">(
    tabParam === "withdraw" ? "withdraw" : tabParam === "transactions" ? "transactions" : "deposit"
  );
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync tab with URL search parameter if changed
  useEffect(() => {
    if (tabParam === "withdraw" || tabParam === "deposit" || tabParam === "transactions") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    getUserRecords()
      .then((data) => {
        setDeposits(data.deposits || []);
        setWithdrawals(data.withdrawals || []);
        setTransactions(data.transactions || []);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
        <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <span className="font-bold text-lg absolute left-1/2 -translate-x-1/2">Transaction Records</span>
      </header>

      {/* Tabs */}
      <div className="flex bg-[#121212] border-b border-white/5">
        <button
          onClick={() => setActiveTab("deposit")}
          className={`flex-1 py-4 text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === "deposit"
              ? "text-[#00A070] border-b-2 border-[#00A070]"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Deposits
        </button>
        <button
          onClick={() => setActiveTab("withdraw")}
          className={`flex-1 py-4 text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === "withdraw"
              ? "text-[#00A070] border-b-2 border-[#00A070]"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Withdrawals
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`flex-1 py-4 text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === "transactions"
              ? "text-[#00A070] border-b-2 border-[#00A070]"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Trading & Balance
        </button>
      </div>

      {/* Records List */}
      <div className="p-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-16 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#00A070]" />
          </div>
        ) : activeTab === "deposit" ? (
          deposits.length === 0 ? (
            <div className="text-center py-16 text-xs text-gray-500">
              No deposit records found
            </div>
          ) : (
            deposits.map((item) => {
              const statusColor =
                item.status === "APPROVED"
                  ? "bg-[#22c55e] text-white"
                  : item.status === "REJECTED"
                  ? "bg-red-500 text-white"
                  : "bg-amber-500 text-white";

              const statusLabel =
                item.status === "APPROVED" ? "Passed" : item.status === "REJECTED" ? "Failed" : "Processing";

              const formattedDate = new Date(item.createdAt).toISOString().replace("T", " ").substring(0, 19).replace(/-/g, "/");

              return (
                <div key={item.id} className="bg-[#1A1C24] border border-white/5 rounded-xl p-4 font-sans">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="w-4 h-4 text-[#00A070]" />
                      <span className="text-gray-200 text-sm font-bold">Deposit ({item.asset})</span>
                    </div>
                    <span className={`${statusColor} text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-xs font-mono">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-right text-[#00A070] font-bold">+{item.amount.toFixed(4)} USDT</span>

                    <span className="text-gray-400">Method:</span>
                    <span className="text-right text-gray-300">{item.bankName || item.method}</span>

                    <span className="text-gray-400">Reference:</span>
                    <span className="text-right text-gray-400 truncate max-w-[130px] sm:max-w-[220px] ml-auto">{item.referenceNumber}</span>

                    <span className="text-gray-400">Time:</span>
                    <span className="text-right text-gray-400">{formattedDate}</span>
                  </div>

                  {item.rejectionReason && (
                    <div className="mt-2.5 text-[11px] text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                      Reason: {item.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : activeTab === "withdraw" ? (
          withdrawals.length === 0 ? (
            <div className="text-center py-16 text-xs text-gray-500">
              No withdrawal records found
            </div>
          ) : (
            withdrawals.map((item) => {
              const statusColor =
                item.status === "APPROVED"
                  ? "bg-[#22c55e] text-white"
                  : item.status === "REJECTED"
                  ? "bg-red-500 text-white"
                  : "bg-amber-500 text-white";

              const statusLabel =
                item.status === "APPROVED" ? "Passed" : item.status === "REJECTED" ? "Failed" : "Processing";

              const formattedDate = new Date(item.createdAt).toISOString().replace("T", " ").substring(0, 19).replace(/-/g, "/");

              return (
                <div key={item.id} className="bg-[#1A1C24] border border-white/5 rounded-xl p-4 font-sans">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4 text-rose-500" />
                      <span className="text-gray-200 text-sm font-bold">
                        Withdrawal ({item.asset}) {item.method ? `• ${item.method}` : ""}
                      </span>
                    </div>
                    <span className={`${statusColor} text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-xs font-mono">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-right text-rose-400 font-bold">-{item.amount.toFixed(4)} {item.asset}</span>

                    <span className="text-gray-400">Fee:</span>
                    <span className="text-right text-gray-300">{(item.fee || 0).toFixed(4)}</span>

                    <span className="text-gray-400">Actually obtained:</span>
                    <span className="text-right text-emerald-400 font-bold">{item.receiveAmount.toFixed(4)} {item.asset}</span>

                    <span className="text-gray-400">Destination:</span>
                    <span className="text-right text-gray-300 truncate max-w-[130px] sm:max-w-[220px] ml-auto font-sans" title={item.method === "CRYPTO" ? `${item.network}: ${item.walletAddress}` : `${item.bankName}: ${item.accountNumber}`}>
                      {item.method === "CRYPTO"
                        ? `${item.network || "CRYPTO"}: ${item.walletAddress ? `${item.walletAddress.slice(0, 6)}...${item.walletAddress.slice(-4)}` : "Wallet"}`
                        : `${item.bankName || "Bank"}${item.accountNumber ? ` (${item.accountNumber.slice(-4)})` : ""}`}
                    </span>

                    {item.txHash && (
                      <>
                        <span className="text-gray-400">Tx Hash / Ref:</span>
                        <span className="text-right text-emerald-400 truncate max-w-[130px] sm:max-w-[220px] ml-auto" title={item.txHash}>
                          {item.txHash}
                        </span>
                      </>
                    )}

                    <span className="text-gray-400">Time:</span>
                    <span className="text-right text-gray-400">{formattedDate}</span>
                  </div>

                  {item.rejectionReason && (
                    <div className="mt-2.5 text-[11px] text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 leading-relaxed">
                      <strong>Declined Reason:</strong> {item.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          transactions.length === 0 ? (
            <div className="text-center py-16 text-xs text-gray-500">
              No trading or balance transactions found
            </div>
          ) : (
            transactions.map((item) => {
              const isCredit = item.amount > 0;
              const isDebit = item.amount < 0;
              const formattedAmount = isCredit
                ? `+${item.amount.toFixed(4)}`
                : isDebit
                ? `${item.amount.toFixed(4)}`
                : `0.0000`;

              const amountColor = isCredit
                ? "text-[#00A070]"
                : isDebit
                ? "text-rose-400"
                : "text-gray-300";

              const formattedDate = new Date(item.createdAt).toISOString().replace("T", " ").substring(0, 19).replace(/-/g, "/");

              return (
                <div key={item.id} className="bg-[#1A1C24] border border-white/5 rounded-xl p-4 font-sans">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      {isCredit ? (
                        <ArrowDownCircle className="w-4 h-4 text-[#00A070]" />
                      ) : (
                        <ArrowUpCircle className="w-4 h-4 text-rose-500" />
                      )}
                      <span className="text-gray-200 text-sm font-bold">{item.type}</span>
                    </div>
                    <span className="bg-[#22c55e]/20 text-[#22c55e] text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                      {item.status || "Passed"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-xs font-mono">
                    <span className="text-gray-400">Net Shift:</span>
                    <span className={`text-right font-bold ${amountColor}`}>
                      {formattedAmount} {item.asset || "USDT"}
                    </span>

                    <span className="text-gray-400">Asset:</span>
                    <span className="text-right text-gray-300">{item.asset || "USDT"}</span>

                    {item.description && (
                      <>
                        <span className="text-gray-400">Details:</span>
                        <span className="text-right text-gray-300 truncate max-w-[130px] sm:max-w-[220px] ml-auto">
                          {item.description}
                        </span>
                      </>
                    )}

                    <span className="text-gray-400">Time:</span>
                    <span className="text-right text-gray-400">{formattedDate}</span>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen bg-[#121212] text-white">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
        </div>
      }
    >
      <RecordsPageContent />
    </Suspense>
  );
}
