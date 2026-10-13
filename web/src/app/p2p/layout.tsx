import { Metadata } from "next";
import { P2PNav } from "@/components/p2p/P2PNav";

export const metadata: Metadata = {
  title: "P2P Crypto Marketplace | ETHS LTD",
  description: "Trade cryptocurrency directly with other users via escrow protection with zero fees.",
};

export default function P2PLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0E1015] text-white">
      <P2PNav />
      <main>{children}</main>
    </div>
  );
}
