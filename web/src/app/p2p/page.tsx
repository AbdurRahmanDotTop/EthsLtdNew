"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { P2PAdvertisement, P2PMerchant } from "@/lib/p2p/types";
import { P2PHero } from "@/components/p2p/P2PHero";
import { P2PControls } from "@/components/p2p/P2PControls";
import { P2PTable } from "@/components/p2p/P2PTable";
import { P2POrderDrawer } from "@/components/p2p/P2POrderDrawer";
import { useP2PStore } from "@/stores/p2p-store";

function QuerySync() {
  const searchParams = useSearchParams();
  const setQuery = useP2PStore((state) => state.setQuery);

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "sell" || type === "buy") {
      setQuery({ side: type });
    }
    const asset = searchParams.get("asset");
    if (asset) {
      setQuery({ asset });
    }
  }, [searchParams, setQuery]);

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
        <QuerySync />
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
