import { ArrowDownToLine, ArrowUpRight, MessageCircle, Share2, Wallet } from "lucide-react";
import HeroSlider from "@/components/home/HeroSlider";
import HomeMarketList from "@/components/home/HomeMarketList";
import { getHeroSlides } from "@/actions/slider";
import { getHomepageMarkets } from "@/actions/markets";
import Link from "next/link";

export default async function Home() {
  const [slides, { topTickers, homeListings }] = await Promise.all([
    getHeroSlides(),
    getHomepageMarkets(),
  ]);

  const quickActions = [
    { name: "Finance", icon: ArrowDownToLine, href: "/assets/deposit" },
    { name: "Option", icon: ArrowUpRight, href: "/options" },
    { name: "Trade", icon: Wallet, href: "/trade" },
    { name: "Share", icon: Share2, href: "/assets" },
    { name: "Assets", icon: MessageCircle, href: "/assets" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] pb-16 pt-2">
      {/* Dynamic Continuous Hero Slider */}
      <HeroSlider slides={slides} />

      {/* Dynamic Real-Time Market Tickers & Listings with Quick Actions above Gainers */}
      <HomeMarketList topTickers={topTickers} homeListings={homeListings}>
        {/* Quick Actions Navigation - Placed above Gainers */}
        <div className="grid grid-cols-5 gap-2 px-4 py-4 my-1">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="flex flex-col items-center gap-2 group cursor-pointer transition-transform active:scale-95"
            >
              <div className="w-11 h-11 rounded-full bg-[#1A1C24] group-hover:bg-[#252836] flex items-center justify-center text-[#00A070] transition-colors shadow-sm border border-white/5">
                <action.icon className="w-5 h-5" />
              </div>
              <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors font-medium">
                {action.name}
              </span>
            </Link>
          ))}
        </div>
      </HomeMarketList>
    </div>
  );
}
