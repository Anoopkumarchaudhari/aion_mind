import { BillingPageContent } from "@/components/BillingPageContent";
import { getResolvedBillingCatalog } from "@/services/adminSettings";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const catalog = await getResolvedBillingCatalog();

  return <BillingPageContent catalog={catalog} />;
}
