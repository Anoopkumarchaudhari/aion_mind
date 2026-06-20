import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS_INFO } from "@/lib/businessInfo";

export const metadata: Metadata = {
  title: "Terms & Conditions | Aria Mind",
  description: "The terms governing your use of the Aria Mind service."
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated={BUSINESS_INFO.policiesUpdated}>
      <p>
        These Terms &amp; Conditions govern your use of the {BUSINESS_INFO.brandName}{" "}
        website and services operated by {BUSINESS_INFO.legalName}. By creating an account
        or using the service, you agree to these terms.
      </p>
      <LegalSection heading="The service">
        <p>
          {BUSINESS_INFO.brandName} provides AI-powered tools (chat, search, notebooks,
          media generation, translation, and more) on a subscription basis. We may update,
          add, or remove features over time.
        </p>
      </LegalSection>
      <LegalSection heading="Accounts">
        <p>
          You are responsible for keeping your login credentials secure and for all
          activity under your account. You must provide accurate information and be
          authorised to use any payment method you add.
        </p>
      </LegalSection>
      <LegalSection heading="Subscriptions & payment">
        <p>
          Paid plans are billed in advance and renew automatically until cancelled. Prices
          and applicable taxes are shown before checkout. Failure to pay may result in
          suspension of access.
        </p>
      </LegalSection>
      <LegalSection heading="Acceptable use">
        <p>
          You agree not to misuse the service, including by attempting to disrupt it,
          infringe others&rsquo; rights, or generate unlawful content. We may suspend or
          terminate accounts that violate these terms.
        </p>
      </LegalSection>
      <LegalSection heading="Intellectual property">
        <p>
          The {BUSINESS_INFO.brandName} platform, branding, and software are owned by
          {" "}{BUSINESS_INFO.legalName}. You retain rights to the content you create using
          the service, subject to these terms and the policies of underlying AI providers.
        </p>
      </LegalSection>
      <LegalSection heading="Disclaimer & liability">
        <p>
          The service is provided on an &ldquo;as is&rdquo; basis. AI outputs may be
          inaccurate; you are responsible for how you use them. To the extent permitted by
          law, our liability is limited to the amount you paid in the preceding 12 months.
        </p>
      </LegalSection>
      <LegalSection heading="Governing law">
        <p>
          These terms are governed by the laws of India. Disputes are subject to the
          jurisdiction of the competent courts at our registered location.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          Questions about these terms? Email{" "}
          <a href={`mailto:${BUSINESS_INFO.email}`} style={{ color: "var(--accent)" }}>
            {BUSINESS_INFO.email}
          </a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
