"use client";

import { useEffect, useState, useTransition } from "react";
import { getP2pAds } from "@/actions/p2p";
import { P2PAdvertisement, P2PMerchant } from "@/lib/p2p/types";
import { useP2PStore } from "@/stores/p2p-store";
import { useCurrencies } from "@/hooks/use-currencies";
import { Loader2, CheckCircle2, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function P2PTable({ onSelectAd }: { onSelectAd: (ad: P2PAdvertisement, merchant: P2PMerchant) => void }) {
  const { fiats } = useCurrencies();
  const { query, resetQuery } = useP2PStore();

  const [ads, setAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAds = async () => {
      setIsLoading(true);
      try {
        // Invert side: if user wants to buy crypto, advertiser is selling (side: SELL)
        const targetSide = query.side.toLowerCase() === "buy" ? "SELL" : "BUY";
        const res = await getP2pAds({
          side: targetSide,
          asset: query.asset !== "all" ? query.asset : undefined,
          fiat: query.fiat !== "all" ? query.fiat : undefined,
          paymentMethod: query.paymentMethod !== "all" ? query.paymentMethod : undefined,
          amount: query.amount,
        });

        if (res.success && res.data && isMounted) {
          // Additional in-memory filtering for payment method
          let filtered = res.data;
          if (query.paymentMethod && query.paymentMethod !== "all") {
            const pmQuery = query.paymentMethod.toLowerCase().replace(/_/g, " ");
            filtered = filtered.filter((ad: any) => {
              const methods = Array.isArray(ad.paymentMethods) ? ad.paymentMethods : [];
              return methods.some((m: any) => {
                const name = typeof m === "string" ? m : m?.type || m?.name || "";
                return name.toLowerCase().includes(pmQuery) || pmQuery.includes(name.toLowerCase());
              });
            });
          }
          setAds(filtered);
        }
      } catch (err) {
        console.error("Failed to load P2P ads", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAds();
    return () => {
      isMounted = false;
    };
  }, [query]);

  const isBuyMode = query.side.toLowerCase() === "buy";

  return (
    <div className="bg-[#161822] border border-white/10 rounded-2xl shadow-xl overflow-hidden mb-8">
      {isLoading ? (
        <div className="p-16 text-center text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A070] mx-auto mb-3" />
          <p className="text-xs">Loading live P2P marketplace offers...</p>
        </div>
      ) : ads.length === 0 ? (
        <div className="p-16 text-center text-gray-400">
          <div className="text-base font-semibold text-white mb-2">No offers match your current criteria.</div>
          <p className="text-xs text-gray-400 mb-5">Try adjusting your filters, asset selection, or limit amounts.</p>
          <Button variant="outline" size="sm" onClick={resetQuery} className="border-white/10">
            Reset All Filters
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile Card List (visible on screens < md) */}
          <div className="block md:hidden divide-y divide-white/5">
            {ads.map((ad: any) => {
              const u = ad.user || {};
              const merchantName = u.name || u.email?.split("@")[0] || `Merchant-${u.uid || ad.userId?.slice(-4)}`;
              const isVerified = Boolean(u.isKycVerified || u.merchantTier);
              const completionRate = u.p2pCompletionRate ?? 100;
              const totalOrders = u.p2pTotalOrders ?? 0;

              const merchantObj: P2PMerchant = {
                id: u.id || ad.userId,
                username: merchantName,
                displayName: merchantName,
                verified: isVerified,
                online: true,
                completionRate,
                totalOrders,
                averageReleaseTime: 5,
                positiveFeedback: u.p2pPositiveFeedback ?? 0,
                negativeFeedback: u.p2pNegativeFeedback ?? 0,
                joinedAt: new Date().toISOString(),
                supportedPaymentMethods: [],
              };

              const fiatCode = ad.fiatCurrency || ad.fiat || "USD";
              const fiatSymbol = fiats.find(f => f.code === fiatCode)?.symbol || (fiatCode === "INR" ? "₹" : (fiatCode === "USD" ? "$" : fiatCode));
              const methods = Array.isArray(ad.paymentMethods) ? ad.paymentMethods : [];

              return (
                <div key={`m-${ad.id}`} className="p-4 space-y-3 hover:bg-white/[0.02] transition-colors">
                  {/* Merchant & Badges Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#00A070]/15 border border-[#00A070]/30 text-[#00A070] font-bold flex items-center justify-center text-xs">
                        {merchantName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white text-xs">{merchantName}</span>
                          {isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-[#00A070]" />}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          <span className="text-emerald-400">{completionRate}%</span> • {totalOrders} trades
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-white font-mono">
                        {fiatSymbol}{Number(ad.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-gray-400">{fiatCode}/{ad.asset}</div>
                    </div>
                  </div>

                  {/* Limits and Volume */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#121212]/60 p-2.5 rounded-lg border border-white/5">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Available</span>
                      <span className="font-mono text-white font-semibold">
                        {Number(ad.availableAmount).toLocaleString()} {ad.asset}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Trade Limit</span>
                      <span className="font-mono text-gray-300">
                        {fiatSymbol}{Number(ad.minLimit).toLocaleString()} - {fiatSymbol}{Number(ad.maxLimit).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Payment methods badges & Action Button */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap gap-1 max-w-[55%]">
                      {methods.slice(0, 2).map((m: any, idx: number) => {
                        const mName = typeof m === "string" ? m : m?.type || m?.name || "Payment";
                        return (
                          <span key={idx} className="px-1.5 py-0.5 text-[10px] bg-white/5 text-gray-300 rounded border border-white/10 truncate">
                            {String(mName).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        );
                      })}
                      {methods.length > 2 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-white/5 text-gray-400 rounded border border-white/10">
                          +{methods.length - 2}
                        </span>
                      )}
                    </div>

                    <Button 
                      variant={isBuyMode ? "default" : "destructive"} 
                      size="sm"
                      onClick={() => onSelectAd(ad, merchantObj)}
                      className={`font-bold px-5 h-9 text-xs rounded-xl shadow-md shrink-0 ${
                        isBuyMode ? "bg-[#00A070] hover:bg-[#00B07C]" : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {isBuyMode ? `Buy ${ad.asset}` : `Sell ${ad.asset}`}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (visible on screens >= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10 bg-[#121212]/50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Advertiser / Merchant</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Available & Trade Limits</th>
                  <th className="px-6 py-4">Payment Methods</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {ads.map((ad: any) => {
                  const u = ad.user || {};
                  const merchantName = u.name || u.email?.split("@")[0] || `Merchant-${u.uid || ad.userId?.slice(-4)}`;
                  const isVerified = Boolean(u.isKycVerified || u.merchantTier);
                  const completionRate = u.p2pCompletionRate ?? 100;
                  const totalOrders = u.p2pTotalOrders ?? 0;

                  const merchantObj: P2PMerchant = {
                    id: u.id || ad.userId,
                    username: merchantName,
                    displayName: merchantName,
                    verified: isVerified,
                    online: true,
                    completionRate,
                    totalOrders,
                    averageReleaseTime: 5,
                    positiveFeedback: u.p2pPositiveFeedback ?? 0,
                    negativeFeedback: u.p2pNegativeFeedback ?? 0,
                    joinedAt: new Date().toISOString(),
                    supportedPaymentMethods: [],
                  };

                  const fiatCode = ad.fiatCurrency || ad.fiat || "USD";
                  const fiatSymbol = fiats.find(f => f.code === fiatCode)?.symbol || (fiatCode === "INR" ? "₹" : (fiatCode === "USD" ? "$" : fiatCode));
                  const methods = Array.isArray(ad.paymentMethods) ? ad.paymentMethods : [];

                  return (
                    <tr key={ad.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Merchant Column */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#00A070]/15 border border-[#00A070]/30 text-[#00A070] font-bold flex items-center justify-center text-sm">
                            {merchantName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white">{merchantName}</span>
                              {isVerified && (
                                <span title="Verified Merchant">
                                  <CheckCircle2 className="w-4 h-4 text-[#00A070]" />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                              <span className="text-emerald-400 font-medium">{completionRate}% completion</span>
                              <span>•</span>
                              <span>{totalOrders} trades</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price Column */}
                      <td className="px-6 py-5">
                        <div className="text-lg font-bold text-white font-mono">
                          {fiatSymbol}{Number(ad.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 font-medium">
                          {fiatCode} / {ad.asset}
                        </div>
                      </td>

                      {/* Limits Column */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center text-xs gap-3 mb-1">
                          <span className="text-gray-400 w-16">Available</span>
                          <span className="font-mono text-white font-semibold">
                            {Number(ad.availableAmount).toLocaleString()} {ad.asset}
                          </span>
                        </div>
                        <div className="flex items-center text-xs gap-3">
                          <span className="text-gray-400 w-16">Limits</span>
                          <span className="font-mono text-gray-300">
                            {fiatSymbol}{Number(ad.minLimit).toLocaleString()} - {fiatSymbol}{Number(ad.maxLimit).toLocaleString()}
                          </span>
                        </div>
                      </td>

                      {/* Payment Column */}
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                          {methods.slice(0, 3).map((methodObj: any, idx: number) => {
                            const methodName = typeof methodObj === "string" 
                              ? methodObj 
                              : (methodObj?.type || methodObj?.name || "Payment");
                            return (
                              <span 
                                key={idx} 
                                className="px-2 py-0.5 text-[11px] font-medium bg-white/5 text-gray-300 rounded border border-white/10"
                              >
                                {String(methodName).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            );
                          })}
                          {methods.length > 3 && (
                            <span className="px-2 py-0.5 text-[11px] font-medium bg-white/5 text-gray-400 rounded border border-white/10">
                              +{methods.length - 3}
                            </span>
                          )}
                          {methods.length === 0 && (
                            <span className="text-xs text-gray-500">Bank Transfer</span>
                          )}
                        </div>
                      </td>

                      {/* Action Column */}
                      <td className="px-6 py-5 text-right">
                        <Button 
                          variant={isBuyMode ? "default" : "destructive"} 
                          size="sm"
                          onClick={() => onSelectAd(ad, merchantObj)}
                          className={`font-semibold px-5 h-9 text-xs rounded-xl shadow-md ${
                            isBuyMode ? "bg-[#00A070] hover:bg-[#00B07C]" : "bg-red-600 hover:bg-red-700"
                          }`}
                        >
                          {isBuyMode ? `Buy ${ad.asset}` : `Sell ${ad.asset}`}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
