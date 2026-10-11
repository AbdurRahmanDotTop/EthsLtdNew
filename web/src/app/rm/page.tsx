import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function RmIndexPage() {
  const session = await getSession();

  if (session?.role === "RM") {
    redirect("/rm/dashboard");
  }

  redirect("/relationship-managers");
}
