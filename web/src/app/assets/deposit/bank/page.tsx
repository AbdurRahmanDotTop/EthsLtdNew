import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DepositBankPage() {
  redirect("/assets/deposit");
}
