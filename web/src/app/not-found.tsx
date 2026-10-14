"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Home,
  ArrowLeft,
  TrendingUp,
  Clock,
  ArrowLeftRight,
  ShieldCheck,
  Search,
  Compass,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  const quickLinks = [
    {
      title: "Perpetual Trading",
      desc: "Trade BTC, ETH, SOL and 200+ crypto pairs with real-time charts.",
      href: "/trade",
      icon: TrendingUp,
      badge: "Live Markets",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "Options Contracts",
      desc: "Short-term binary prediction contracts with instant returns.",
      href: "/options",
      icon: Clock,
      badge: "High Yield",
      color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    },
    {
      title: "P2P Marketplace",
      desc: "Zero-fee peer-to-peer crypto exchange with escrow protection.",
      href: "/p2p",
      icon: ArrowLeftRight,
      badge: "Escrow Protected",
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "Security & Trust",
      desc: "Inspect proof of reserves, cold-storage custody, and audit reports.",
      href: "/trust",
      icon: ShieldCheck,
      badge: "Verified 100%",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-140px)] flex flex-col items-center justify-center px-4 py-12 overflow-hidden bg-[#121212]">
      {/* Background Ambient Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-[#00A070]/15 via-teal-500/10 to-transparent blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />

      <div className="relative z-10 w-full max-w-3xl text-center space-y-8">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161822] border border-white/10 text-xs font-mono font-medium text-gray-300 shadow-xl backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[#00A070] animate-pulse" />
          <span className="text-[#00A070] font-bold">ERROR 404</span>
          <span className="text-gray-500">|</span>
          <span>PAGE NOT FOUND IN NETWORK</span>
        </div>

        {/* Big 404 Headline */}
        <div className="space-y-3">
          <div className="relative inline-block select-none">
            <h1 className="text-8xl sm:text-9xl md:text-[11rem] font-extrabold tracking-tighter font-mono bg-gradient-to-b from-white via-gray-200 to-gray-500 bg-clip-text text-transparent leading-none">
              404
            </h1>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-[#00A070]/20 to-teal-500/20 blur-2xl -z-10" />
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
            Lost in the Cryptoverse?
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
            The page or digital asset address you requested could not be resolved on the network. It may have been moved, renamed, or temporarily delisted.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-[#00A070]/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1A1C24] hover:bg-[#252836] text-gray-200 hover:text-white font-semibold text-xs border border-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-gray-400" />
            <span>Back to Previous Page</span>
          </button>
        </div>

        {/* Quick Navigation Cards */}
        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-mono">
              Explore Available Destinations
            </span>
            <span className="text-[11px] text-[#00A070] flex items-center gap-1 font-mono">
              <Sparkles className="w-3 h-3" />
              <span>Verified Routes</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group relative p-4 rounded-2xl bg-[#161822] hover:bg-[#1C1F2E] border border-white/5 hover:border-[#00A070]/30 transition-all duration-200 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-xl ${item.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/5">
                        {item.badge}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-[#00A070] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-[#00A070] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Navigate</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Help Note */}
        <div className="pt-2 text-[11px] text-gray-500">
          Looking for account or wallet recovery?{" "}
          <Link href="/login" className="text-[#00A070] hover:underline font-medium">
            Sign In
          </Link>{" "}
          or{" "}
          <Link href="/relationship-managers" className="text-[#00A070] hover:underline font-medium">
            Contact a Relationship Manager
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
