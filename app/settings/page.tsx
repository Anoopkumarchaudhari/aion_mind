import { Suspense } from "react";
import { SettingsPageContent } from "@/components/SettingsPageContent";
import { getResolvedBillingCatalog } from "@/services/adminSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const catalog = await getResolvedBillingCatalog();

  return (
    <Suspense fallback={null}>
      <SettingsPageContent catalog={catalog} />
    </Suspense>
  );
}
