import { notFound } from "next/navigation";
import { AdminGate } from "@/components/AdminGate";
import { AdminPanelContent } from "@/components/AdminPanelContent";
import { requireAdminUser } from "@/services/adminAuth";
import { getAdminGateState } from "@/services/adminGate";
import { getAdminOverview } from "@/services/adminOverview";

export const dynamic = "force-dynamic";

export default async function AdminVaultPage() {
  let admin;

  try {
    admin = await requireAdminUser();
  } catch {
    // Hide the panel's existence from non-admins.
    notFound();
  }

  const gate = await getAdminGateState(admin);

  if (!gate.unlocked) {
    return (
      <AdminGate
        hasPassword={gate.hasPassword}
        emailMasked={gate.emailMasked}
        emailConfigured={gate.emailConfigured}
      />
    );
  }

  const overview = await getAdminOverview(admin);

  return <AdminPanelContent initialOverview={overview} />;
}
