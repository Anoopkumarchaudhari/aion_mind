import { notFound } from "next/navigation";
import { AdminPanelContent } from "@/components/AdminPanelContent";
import { requireAdminUser } from "@/services/adminAuth";
import { getAdminOverview } from "@/services/adminOverview";

export const dynamic = "force-dynamic";

export default async function AdminVaultPage() {
  try {
    const admin = await requireAdminUser();
    const overview = await getAdminOverview(admin);

    return <AdminPanelContent initialOverview={overview} />;
  } catch {
    notFound();
  }
}
