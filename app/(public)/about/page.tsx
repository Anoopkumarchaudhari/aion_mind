import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS_INFO } from "@/lib/businessInfo";

export const metadata: Metadata = {
  title: "About Aria Mind",
  description: "Learn about Aria Mind — an AI workspace for chat, research, and content."
};

export default function AboutPage() {
  return (
    <LegalPage title="About Aria Mind">
      <LegalSection heading="Who we are">
        <p>
          {BUSINESS_INFO.brandName} is an AI-powered workspace that brings chat, search,
          research notebooks, image and video tools, translation, and podcasting into a
          single subscription product. It is operated by {BUSINESS_INFO.legalName}.
        </p>
      </LegalSection>
      <LegalSection heading="What we offer">
        <p>
          We provide access to advanced AI assistants and creative tools through monthly
          and annual subscription plans. Customers sign up online, choose a plan, and use
          the service entirely over the web — there is no physical product.
        </p>
      </LegalSection>
      <LegalSection heading="Get in touch">
        <p>
          Questions about the product or your account? Reach us at{" "}
          <a href={`mailto:${BUSINESS_INFO.email}`} style={{ color: "var(--accent)" }}>
            {BUSINESS_INFO.email}
          </a>{" "}
          or visit our <a href="/contact" style={{ color: "var(--accent)" }}>contact page</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
