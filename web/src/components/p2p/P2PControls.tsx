"use client";

import { useEffect, useState } from "react";
import { useP2PStore } from "@/stores/p2p-store";
import { getP2pSupportedPaymentMethods } from "@/actions/p2p";
import { useCurrencies } from "@/hooks/use-currencies";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export function P2PControls() {
  const { query, setQuery, resetQuery } = useP2PStore();
  const { assets, fiats } = useCurrencies();
  const [methods, setMethods] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    getP2pSupportedPaymentMethods({ activeOnly: true, currency: query.fiat !== "all" ? query.fiat : undefined })
      .then((res) => {
        if (mounted && res.success && res.data) {
          setMethods(res.data);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [query.fiat]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setQuery({ amount: isNaN(val) ? undefined : val });
  };

  const isBuy = query.side.toLowerCase() === "buy";

  return (
    <div className="py-6 space-y-6">
      {/* Primary mode toggle */}
      <div className="flex bg-[#161822] w-full sm:w-fit rounded-xl p-1 border border-white/10">
        <button
          onClick={() => setQuery({ side: "buy" })}
          className={`flex-1 sm:flex-initial px-4 sm:px-8 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer text-center ${
            isBuy
              ? "bg-[#00A070] text-white shadow-md"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Buy Crypto
        </button>
        <button
          onClick={() => setQuery({ side: "sell" })}
          className={`flex-1 sm:flex-initial px-4 sm:px-8 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer text-center ${
            !isBuy
              ? "bg-red-600 text-white shadow-md"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Sell Crypto
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Asset */}
        <div className="space-y-1 lg:col-span-1">
          <label className="text-xs font-semibold text-gray-400">Crypto Asset</label>
          <select 
            value={query.asset || "all"}
            onChange={(e) => setQuery({ asset: e.target.value })}
            className="flex h-10 w-full rounded-lg border border-white/10 bg-[#161822] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
          >
            <option value="all">All Assets</option>
            {assets.map((asset) => (
              <option key={asset.code} value={asset.code}>
                {asset.code}
              </option>
            ))}
          </select>
        </div>

        {/* Fiat */}
        <div className="space-y-1 lg:col-span-1">
          <label className="text-xs font-semibold text-gray-400">Fiat Currency</label>
          <select 
            value={query.fiat || "all"}
            onChange={(e) => setQuery({ fiat: e.target.value })}
            className="flex h-10 w-full rounded-lg border border-white/10 bg-[#161822] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
          >
            <option value="all">All Fiat</option>
            {fiats.map((fiat) => (
              <option key={fiat.code} value={fiat.code}>
                {fiat.code}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Method */}
        <div className="space-y-1 lg:col-span-1">
          <label className="text-xs font-semibold text-gray-400">Payment Method</label>
          <select 
            value={query.paymentMethod || "all"}
            onChange={(e) => setQuery({ paymentMethod: e.target.value })}
            className="flex h-10 w-full rounded-lg border border-white/10 bg-[#161822] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
          >
            <option value="all">All Methods</option>
            {methods.map((method) => (
              <option key={method.id || method.identifier} value={method.name}>
                {method.name}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="space-y-1 lg:col-span-2">
          <label className="text-xs font-semibold text-gray-400">
            {isBuy ? "Target Spend Amount" : "Target Sell Amount"}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-xs">
              {query.fiat === "all" ? "" : fiats.find(f => f.code === query.fiat)?.symbol || ""}
            </span>
            <Input 
              type="number" 
              placeholder="Enter amount to filter limits" 
              className={query.fiat === "all" ? "pl-3" : "pl-8"}
              value={query.amount || ""}
              onChange={handleAmountChange}
            />
          </div>
        </div>

        {/* Reset Button */}
        <div className="space-y-1 lg:col-span-1 flex items-end">
          <Button 
            variant="outline" 
            className="w-full gap-2 border-white/10 text-gray-300 hover:text-white"
            onClick={resetQuery}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
