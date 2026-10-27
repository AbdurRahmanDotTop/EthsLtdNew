import { P2POrderWorkspace } from "@/components/p2p/P2POrderWorkspace";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/p2p/order/${id}`)}`);
  }

  return (
    <div className="max-w-[1280px] mx-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-10 pb-28 sm:pb-36 lg:pb-16">
      <div className="mb-4">
        <Link
          href="/p2p/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Orders
        </Link>
      </div>
      <P2POrderWorkspace orderId={id} />
    </div>
  );
}
