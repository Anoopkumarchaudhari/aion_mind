import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS_INFO } from "@/lib/businessInfo";

export const metadata: Metadata = {
  title: "Pricing | Aria Mind",
  description: "Aria Mind subscription plans and pricing."
};

export default function PricingPage() {
  return (
    <LegalPage title="Pricing" updated={BUSINESS_INFO.policiesUpdated}>
      <LegalSection heading="Subscription plans">
        <p>
          {BUSINESS_INFO.brandName} is offered as a subscription. Choose a plan that fits
          your needs — all plans are billed in advance and renew automatically until
          cancelled. Final prices, inclusive of applicable taxes (GST), are shown on the
          checkout screen before payment.
        </p>
      </LegalSection>
      <LegalSection heading="Current plans">
        <p>
          You can view the latest plans, features, and exact prices on our{" "}
          <a href="/" style={{ color: "var(--accent)" }}>home page</a>, or after signing in
          on the <a href="/billing" style={{ color: "var(--accent)" }}>billing page</a>.
        </p>
        {/* REPLACE: list your concrete plans and amounts here, e.g.
            Free — ₹0, Pro — ₹799/month, Pro Annual — ₹7,990/year. */}
      </LegalSection>
      <LegalSection heading="Billing & cancellation">
        <p>
          Subscriptions renew automatically at the end of each billing cycle. You can
          cancel anytime from your account settings; cancellation stops future renewals.
          See our <a href="/refund-policy" style={{ color: "var(--accent)" }}>Refund &amp;
          Cancellation Policy</a> for details.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
