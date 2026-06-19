import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Billing now lives inside Settings as a tab. Preserve any ?plan= deep link
// (used by the landing page) so plan selection still works after the redirect.
export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  redirect(plan ? `/settings?tab=billing&plan=${encodeURIComponent(plan)}` : "/settings?tab=billing");
}
