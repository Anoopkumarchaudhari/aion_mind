import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS_INFO } from "@/lib/businessInfo";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | Aria Mind",
  description: "How Aria Mind delivers its digital subscription service."
};

export default function ShippingPolicyPage() {
  return (
    <LegalPage title="Shipping & Delivery Policy" updated={BUSINESS_INFO.policiesUpdated}>
      <LegalSection heading="Digital delivery">
        <p>
          {BUSINESS_INFO.brandName} is a fully digital service. There are no physical goods
          and therefore no shipping. Access to your plan&rsquo;s features is delivered
          electronically and is activated immediately after your payment is successfully
          processed.
        </p>
      </LegalSection>
      <LegalSection heading="Accessing your subscription">
        <p>
          Once payment is confirmed, the corresponding features are enabled on your account
          and available instantly when you sign in at {BUSINESS_INFO.website}. If your
          access is not active within a few minutes of a successful payment, please contact
          us.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          Need help accessing your subscription? Email{" "}
          <a href={`mailto:${BUSINESS_INFO.email}`} style={{ color: "var(--accent)" }}>
            {BUSINESS_INFO.email}
          </a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
