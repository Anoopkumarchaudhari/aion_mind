import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth";

export const dynamic = "force-dynamic";

// Dashboard now lives inside Settings as a tab. Keep the auth gate, then forward
// to the Settings dashboard tab.
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent("/settings?tab=dashboard")}`);
  }

  redirect("/settings?tab=dashboard");
}
