import { LandingPage } from "@/components/LandingPage";
import { getResolvedBillingCatalog } from "@/services/adminSettings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await getResolvedBillingCatalog();

  return <LandingPage catalog={catalog} />;
}
