import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS_INFO } from "@/lib/businessInfo";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Aria Mind",
  description: "Aria Mind subscription cancellation and refund terms."
};

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy" updated={BUSINESS_INFO.policiesUpdated}>
      <p>
        This policy explains how cancellations and refunds work for {BUSINESS_INFO.brandName}{" "}
        subscriptions operated by {BUSINESS_INFO.legalName}.
      </p>
      <LegalSection heading="Cancellation">
        <p>
          You can cancel your subscription at any time from your account settings or by
          emailing us. When you cancel, your plan remains active until the end of the
          current billing period and is not renewed afterwards.
        </p>
      </LegalSection>
      <LegalSection heading="Refunds">
        <p>
          {/* REPLACE the bracketed terms below to match the policy you actually offer. */}
          As {BUSINESS_INFO.brandName} is a digital service delivered immediately, fees are
          generally non-refundable once a billing period has started. If you believe you
          were charged in error or experienced a technical issue that prevented use, contact
          us within 7 days of the charge and we will review your case in good faith.
        </p>
      </LegalSection>
      <LegalSection heading="How refunds are processed">
        <p>
          Approved refunds are credited to the original payment method through our payment
          gateway within 5–7 business days, depending on your bank or card issuer.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          For any cancellation or refund request, email{" "}
          <a href={`mailto:${BUSINESS_INFO.email}`} style={{ color: "var(--accent)" }}>
            {BUSINESS_INFO.email}
          </a>{" "}
          or call {BUSINESS_INFO.phone}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
