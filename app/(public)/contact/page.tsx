import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS_INFO } from "@/lib/businessInfo";

export const metadata: Metadata = {
  title: "Contact Us | Aria Mind",
  description: "Contact Aria Mind support — email, phone, and registered address."
};

export default function ContactPage() {
  return (
    <LegalPage title="Contact Us" updated={BUSINESS_INFO.policiesUpdated}>
      <LegalSection heading="Customer support">
        <p>
          We're here to help with any question about your account, billing, or the
          {" "}{BUSINESS_INFO.brandName} service.
        </p>
      </LegalSection>
      <LegalSection heading="Reach us">
        <p style={{ margin: "4px 0" }}>
          <strong style={{ color: "var(--text-primary)" }}>Business name:</strong>{" "}
          {BUSINESS_INFO.legalName}
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong style={{ color: "var(--text-primary)" }}>Email:</strong>{" "}
          <a href={`mailto:${BUSINESS_INFO.email}`} style={{ color: "var(--accent)" }}>
            {BUSINESS_INFO.email}
          </a>
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong style={{ color: "var(--text-primary)" }}>Phone:</strong>{" "}
          <a href={`tel:${BUSINESS_INFO.phone.replace(/\s+/g, "")}`} style={{ color: "var(--accent)" }}>
            {BUSINESS_INFO.phone}
          </a>
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong style={{ color: "var(--text-primary)" }}>Registered address:</strong>{" "}
          {BUSINESS_INFO.address}
        </p>
      </LegalSection>
      <LegalSection heading="Support hours">
        <p>
          We typically respond to email within 1–2 business days, Monday to Friday.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
