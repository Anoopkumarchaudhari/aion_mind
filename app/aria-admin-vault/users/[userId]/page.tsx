import { notFound } from "next/navigation";
import { AdminGate } from "@/components/AdminGate";
import { AdminUserDetailView } from "@/components/AdminUserDetailView";
import { requireAdminUser } from "@/services/adminAuth";
import { getAdminGateState } from "@/services/adminGate";
import { getAdminUserDetail } from "@/services/adminUserDetail";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserLogPage({ params }: PageProps) {
  let admin;

  try {
    admin = await requireAdminUser();
  } catch {
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

  const { userId } = await params;

  let detail;
  try {
    detail = await getAdminUserDetail(userId);
  } catch {
    notFound();
  }

  return <AdminUserDetailView detail={detail} />;
}
