"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { P2PAdvertisement, P2PMerchant } from "@/lib/p2p/types";
import { P2PHero } from "@/components/p2p/P2PHero";
import { P2PControls } from "@/components/p2p/P2PControls";
import { P2PTable } from "@/components/p2p/P2PTable";
import { P2POrderDrawer } from "@/components/p2p/P2POrderDrawer";
import { useP2PStore } from "@/stores/p2p-store";
import { useAuth } from "@/hooks/use-auth";
import { getP2pAds } from "@/actions/p2p";

function QuerySync({
  onRestoreTrade,
}: {
  onRestoreTrade: (ad: P2PAdvertisement, merchant: P2PMerchant) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setQuery = useP2PStore((state) => state.setQuery);
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "sell" || type === "buy") {
      setQuery({ side: type });
    }
    const asset = searchParams.get("asset");
    if (asset) {
      setQuery({ asset });
    }

    // Check for trade restoration
    const action = searchParams.get("action");
    const adId = searchParams.get("adId");
    if (action === "trade" && adId) {
      if (!isLoading) {
        if (!isAuthenticated) {
          router.push(`/login?redirect=${encodeURIComponent(`/p2p?action=trade&adId=${adId}`)}`);
        } else {
          // User is authenticated, restore the trade modal destination
          getP2pAds().then((res) => {
            if (res.success && res.data) {
              const match = res.data.find((a: any) => a.id === adId);
              if (match) {
                const u = match.user || {};
                const merchantName = u.name || u.email?.split("@")[0] || `Merchant-${u.uid || match.userId?.slice(-4)}`;
                const methods = Array.isArray(match.paymentMethods) ? match.paymentMethods : [];
                const merchantObj: P2PMerchant = {
                  id: u.id || match.userId,
                  username: merchantName,
                  displayName: merchantName,
                  verified: Boolean(u.isKycVerified || u.merchantTier),
                  online: true,
                  completionRate: u.p2pCompletionRate ?? 100,
                  totalOrders: u.p2pTotalOrders ?? 0,
                  averageReleaseTime: 5,
                  positiveFeedback: u.p2pPositiveFeedback ?? 0,
                  negativeFeedback: u.p2pNegativeFeedback ?? 0,
                  joinedAt: new Date().toISOString(),
                  supportedPaymentMethods: methods.map((m: any) =>
                    typeof m === "string" ? m : m?.type || m?.name || "Payment"
                  ),
                };
                onRestoreTrade(match, merchantObj);
              }
            }
          });
        }
      }
    }
  }, [searchParams, setQuery, isAuthenticated, isLoading, router, onRestoreTrade]);

  return null;
}

export default function P2PPage() {
  const [selectedAd, setSelectedAd] = useState<P2PAdvertisement | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<P2PMerchant | null>(null);

  const handleSelectAd = (ad: P2PAdvertisement, merchant: P2PMerchant) => {
    setSelectedAd(ad);
    setSelectedMerchant(merchant);
  };

  const handleCloseDrawer = () => {
    setSelectedAd(null);
    setSelectedMerchant(null);
  };

  return (
    <div className="pb-36 md:pb-24 min-h-screen">
      <Suspense fallback={null}>
        <QuerySync onRestoreTrade={handleSelectAd} />
      </Suspense>
      
      <P2PHero />
      
      <div className="max-w-[1280px] mx-auto px-3 sm:px-6 md:px-8">
        <P2PControls />
        
        <div className="mt-2">
          <P2PTable onSelectAd={handleSelectAd} />
        </div>
      </div>

      {selectedAd && selectedMerchant && (
        <P2POrderDrawer 
          ad={selectedAd} 
          merchant={selectedMerchant} 
          onClose={handleCloseDrawer} 
        />
      )}
    </div>
  );
}
