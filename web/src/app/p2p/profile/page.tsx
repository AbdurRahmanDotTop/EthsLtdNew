"use client";

import { useEffect, useState } from "react";
import { getP2pProfile, transferFundingWallet } from "@/actions/p2p";
import {
  User,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  FileText,
  ArrowLeftRight,
  ArrowLeft,
  Loader2,
  Star,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function P2PProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAsset, setTransferAsset] = useState("USDT");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDir, setTransferDir] = useState<"TO_FUNDING" | "FROM_FUNDING">("TO_FUNDING");
  const [isTransferring, setIsTransferring] = useState(false);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await getP2pProfile();
      if (res.success && res.data) {
        setProfile(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsTransferring(true);
    try {
      const res = await transferFundingWallet({
        asset: transferAsset,
        amount: amt,
        direction: transferDir,
      });

      if (res.success) {
        toast.success("Wallet transfer successful!");
        setShowTransferModal(false);
        setTransferAmount("");
      } else {
        toast.error(res.error || "Transfer failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
    } finally {
      setIsTransferring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A070] mb-3" />
        <p className="text-xs">Loading profile & reputation metrics...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto py-24 text-center text-gray-400">
        <p className="text-sm">Please log in to view your P2P profile.</p>
        <Link href="/login?redirect=/p2p/profile" className="mt-4 inline-block text-[#00A070] text-xs font-semibold">
          Go to Login
        </Link>
      </div>
    );
  }

  const user = profile.user || {};
  const stats = profile.stats || {};
  const completionRate = user.p2pCompletionRate ?? 100;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 pb-32 md:pb-16">
      <div className="mb-8">
        <Link
          href="/p2p"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </Link>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">
          P2P Merchant Profile
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Review your trading track record, completion statistics, and manage your funding balance.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#00A070]/15 border border-[#00A070]/30 text-[#00A070] text-2xl font-bold flex items-center justify-center">
            {(user.name || user.email)?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{user.name || user.email}</h2>
              {user.isKycVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00A070]/20 text-[#00A070] text-[11px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> KYC Verified
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              User ID: #{user.uid} • Merchant Tier: {user.merchantTier || "STANDARD"}
            </p>
          </div>
        </div>

        <Button
          onClick={() => setShowTransferModal(true)}
          className="bg-[#00A070] hover:bg-[#00B07C] text-white font-semibold text-xs gap-2"
        >
          <ArrowLeftRight className="w-4 h-4" /> Internal Wallet Transfer
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#161822] border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-xs text-gray-400 mb-1">Completion Rate</p>
          <p className="text-2xl font-black text-emerald-400 font-mono">{completionRate}%</p>
          <p className="text-[11px] text-gray-500 mt-1">30-day performance</p>
        </div>

        <div className="bg-[#161822] border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-xs text-gray-400 mb-1">Completed Trades</p>
          <p className="text-2xl font-black text-white font-mono">{user.p2pCompletedOrders || 0}</p>
          <p className="text-[11px] text-gray-500 mt-1">of {user.p2pTotalOrders || 0} total orders</p>
        </div>

        <div className="bg-[#161822] border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-xs text-gray-400 mb-1">Active Advertisements</p>
          <p className="text-2xl font-black text-[#00A070] font-mono">{stats.activeAdsCount || 0}</p>
          <Link href="/p2p/my-ads" className="text-[11px] text-[#00A070] hover:underline mt-1 block">
            Manage Ads →
          </Link>
        </div>

        <div className="bg-[#161822] border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-xs text-gray-400 mb-1">Payment Methods</p>
          <p className="text-2xl font-black text-white font-mono">{stats.paymentMethodsCount || 0}</p>
          <Link href="/p2p/payment-methods" className="text-[11px] text-gray-400 hover:text-white mt-1 block">
            Manage Methods →
          </Link>
        </div>
      </div>

      {/* Trust & Escrow Guarantee */}
      <div className="bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <ShieldCheck className="w-5 h-5 text-[#00A070]" /> Institutional Trust Standard
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          All P2P orders are settled through server-authoritative double-entry ledger verification. Funds never move directly between user wallets without smart escrow lock validation.
        </p>
      </div>

      {/* Internal Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-[#00A070]" /> Transfer Between Wallets
            </DialogTitle>
            <DialogDescription>
              Instant, fee-free transfer between your Spot (Currency) wallet and P2P Funding wallet.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTransferSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransferDir("TO_FUNDING")}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  transferDir === "TO_FUNDING"
                    ? "border-[#00A070] bg-[#00A070]/10 text-white"
                    : "border-white/10 bg-[#121212] text-gray-400"
                }`}
              >
                Spot → P2P Funding
              </button>
              <button
                type="button"
                onClick={() => setTransferDir("FROM_FUNDING")}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  transferDir === "FROM_FUNDING"
                    ? "border-[#00A070] bg-[#00A070]/10 text-white"
                    : "border-white/10 bg-[#121212] text-gray-400"
                }`}
              >
                P2P Funding → Spot
              </button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Crypto Asset</Label>
              <select
                value={transferAsset}
                onChange={(e) => setTransferAsset(e.target.value)}
                className="w-full h-11 rounded-lg border border-white/10 bg-[#121212] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00A070]"
              >
                <option value="USDT">USDT</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="SOL">SOL</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tAmt" className="text-xs text-gray-300">Amount to Transfer</Label>
              <Input
                id="tAmt"
                type="number"
                step="any"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)} className="border-white/10">
                Cancel
              </Button>
              <Button type="submit" disabled={isTransferring} className="bg-[#00A070] hover:bg-[#00B07C] text-white font-bold">
                {isTransferring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirm Transfer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
