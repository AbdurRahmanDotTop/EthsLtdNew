import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function ContractsIndexPage() {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login?redirect=/relationship-managers");
  }

  try {
    const contract = await prisma.investmentContract.findFirst({
      where: {
        OR: [
          { userId: session.userId },
          { rmId: session.userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (contract?.id) {
      redirect(`/contracts/${contract.id}`);
    }
  } catch {}

  redirect("/relationship-managers");
}
