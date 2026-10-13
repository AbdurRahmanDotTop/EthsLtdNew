"use client";

import { Button } from "@/components/ui/button";
import { History, Zap, ShieldCheck, PlusCircle } from "lucide-react";
import { useP2PStore } from "@/stores/p2p-store";
import Link from "next/link";
import { useState } from "react";
import { ExpressP2PModal } from "./ExpressP2PModal";

export function P2PHero() {
  const { query, setQuery } = useP2PStore();
  const [expressOpen, setExpressOpen] = useState(false);

  return (
    <div className="bg-[#161822] border-b border-white/10 relative overflow-hidden">
      <div className="absolute right-0 top-0 w-96 h-96 bg-[#00A070]/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-10 md:py-14 relative z-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00A070]/15 border border-[#00A070]/30 text-[#00A070] text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Escrow-Protected Peer-to-Peer
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3 text-white">
            Trade Crypto Directly With Zero Fees
          </h1>
          <p className="text-sm md:text-base text-gray-300 mb-6 leading-relaxed">
            Buy and sell cryptocurrencies securely with verified merchants across 50+ local payment methods. All trades are backed by institutional-grade smart escrow.
          </p>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              size="lg" 
              variant={query.side.toLowerCase() === "buy" ? "default" : "outline"}
              onClick={() => setQuery({ side: "buy" })}
              className="text-sm font-semibold h-11 px-6"
            >
              Buy Crypto
            </Button>
            <Button 
              size="lg" 
              variant={query.side.toLowerCase() === "sell" ? "default" : "outline"}
              onClick={() => setQuery({ side: "sell" })}
              className="text-sm font-semibold h-11 px-6"
            >
              Sell Crypto
            </Button>
            <Button 
              variant="secondary" 
              size="lg" 
              className="gap-2 bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/30 text-sm font-semibold h-11 px-5" 
              onClick={() => setExpressOpen(true)}
            >
              <Zap className="w-4 h-4 fill-current" /> Express P2P
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              asChild 
              className="gap-2 text-gray-300 hover:text-white border-white/10 text-sm h-11 px-5"
            >
              <Link href="/p2p/orders">
                <History className="w-4 h-4" /> My Orders
              </Link>
            </Button>
          </div>
        </div>
      </div>
      
      <ExpressP2PModal isOpen={expressOpen} onClose={() => setExpressOpen(false)} />
    </div>
  );
}
