"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useP2PStore } from "@/stores/p2p-store";
import { getP2pSupportedPaymentMethods } from "@/actions/p2p";
import { useCurrencies } from "@/hooks/use-currencies";
import { Zap, ChevronRight } from "lucide-react";

interface ExpressP2PModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExpressP2PModal({ isOpen, onClose }: ExpressP2PModalProps) {
  const { setQuery } = useP2PStore();
  const { assets, fiats } = useCurrencies();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [asset, setAsset] = useState("USDT");
  const [fiat, setFiat] = useState("INR");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [methods, setMethods] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    getP2pSupportedPaymentMethods({ activeOnly: true, currency: fiat })
      .then((res) => {
        if (mounted && res.success && res.data) {
          setMethods(res.data);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [fiat]);

  const fiatSymbol = fiats.find(f => f.code === fiat)?.symbol || "$";

  const handlePickAds = () => {
    setQuery({
      side,
      asset,
      fiat,
      amount: amount ? parseFloat(amount) : undefined,
      paymentMethod
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Express P2P
          </DialogTitle>
          <DialogDescription>
            Specify your requirements to find the best matching P2P offers instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Trading Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <select 
                value={side}
                onChange={(e) => setSide(e.target.value as "buy" | "sell")}
                className="flex h-11 w-full rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
              >
                <option value="buy">Buy Crypto</option>
                <option value="sell">Sell Crypto</option>
              </select>
              <select 
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
              >
                {assets.map(a => (
                  <option key={a.code} value={a.code}>{a.code}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Payment Currency & Amount</label>
            <div className="flex relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
                {fiatSymbol}
              </span>
              <Input 
                type="number" 
                placeholder="Enter Amount" 
                className="pl-8 h-11 rounded-r-none border-r-0 text-sm font-medium"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select 
                value={fiat}
                onChange={(e) => setFiat(e.target.value)}
                className="flex h-11 w-28 rounded-l-none rounded-r-lg border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
              >
                {fiats.map(f => (
                  <option key={f.code} value={f.code}>{f.code}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Payment Method</label>
            <select 
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
            >
              <option value="all">All payment methods</option>
              {methods.map((m) => (
                <option key={m.id || m.identifier} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          <Button size="lg" className="w-full text-sm font-semibold h-11 mt-2" onClick={handlePickAds}>
            Find Matching Ads
          </Button>

          <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-white/10 flex-wrap gap-y-2">
            <div className="flex flex-col items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-[11px]">1</span>
              <span>Pick Offer</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            <div className="flex flex-col items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-[11px]">2</span>
              <span>Transfer Funds</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            <div className="flex flex-col items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-[11px]">3</span>
              <span>Release Crypto</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
