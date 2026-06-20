import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS_INFO } from "@/lib/businessInfo";

export const metadata: Metadata = {
  title: "Privacy Policy | Aria Mind",
  description: "How Aria Mind collects, uses, and protects your personal data."
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={BUSINESS_INFO.policiesUpdated}>
      <p>
        This Privacy Policy explains how {BUSINESS_INFO.legalName} (&ldquo;
        {BUSINESS_INFO.brandName}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects,
        uses, and protects information when you use our website and services at{" "}
        {BUSINESS_INFO.website}.
      </p>
      <LegalSection heading="Information we collect">
        <p>
          We collect the account details you provide (such as name and email), the content
          you submit while using the service, and standard technical data (such as device
          and usage information) needed to operate and secure the product. Payments are
          processed by our payment gateway; we do not store your full card details.
        </p>
      </LegalSection>
      <LegalSection heading="How we use information">
        <p>
          We use information to provide and improve the service, process payments and
          subscriptions, communicate with you about your account, ensure security, and
          comply with legal obligations.
        </p>
      </LegalSection>
      <LegalSection heading="Sharing">
        <p>
          We do not sell your personal data. We share information only with service
          providers who help us operate (such as hosting, AI model providers, and payment
          processing), and where required by law.
        </p>
      </LegalSection>
      <LegalSection heading="Data security & retention">
        <p>
          We apply reasonable technical and organisational measures to protect your data
          and retain it only as long as needed to provide the service or meet legal
          requirements.
        </p>
      </LegalSection>
      <LegalSection heading="Your rights">
        <p>
          You may request access to, correction of, or deletion of your personal data by
          contacting us. To exercise any right, email{" "}
          <a href={`mailto:${BUSINESS_INFO.email}`} style={{ color: "var(--accent)" }}>
            {BUSINESS_INFO.email}
          </a>.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          {BUSINESS_INFO.legalName}
          <br />
          {BUSINESS_INFO.address}
          <br />
          Email:{" "}
          <a href={`mailto:${BUSINESS_INFO.email}`} style={{ color: "var(--accent)" }}>
            {BUSINESS_INFO.email}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
