import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared shell for the public, non-authenticated business pages
 * (About, Contact, Pricing, and the legal/policy pages).
 *
 * These pages must stay publicly reachable — they are required by
 * payment gateways (e.g. Razorpay) for website verification. The
 * routes are whitelisted in middleware.ts so they never redirect to
 * /login. Keep them indexable (no `noindex`).
 */

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/refund-policy", label: "Refunds" },
  { href: "/shipping-policy", label: "Shipping" }
];

export function LegalPage({
  title,
  updated,
  children
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        height: "100dvh",
        overflowY: "auto",
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-sidebar)"
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap"
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: 17
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Aria%20logo/aria-icon.png"
              alt="Aria Mind"
              width={28}
              height={28}
              style={{ borderRadius: 6 }}
            />
            Aria Mind
          </Link>
          <nav
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              fontSize: 14
            }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ color: "var(--text-secondary)", textDecoration: "none" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 920,
          margin: "0 auto",
          padding: "40px 24px 64px",
          lineHeight: 1.7,
          fontSize: 16
        }}
      >
        <h1 style={{ fontSize: 34, fontWeight: 700, margin: "0 0 8px" }}>{title}</h1>
        {updated ? (
          <p style={{ color: "var(--text-muted)", margin: "0 0 32px", fontSize: 14 }}>
            Last updated: {updated}
          </p>
        ) : (
          <div style={{ height: 24 }} />
        )}
        <div style={{ color: "var(--text-secondary)" }}>{children}</div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--bg-sidebar)",
          color: "var(--text-muted)",
          fontSize: 13
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            padding: "24px",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "space-between"
          }}
        >
          <span>© {new Date().getFullYear()} Aria Mind. All rights reserved.</span>
          <nav style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ color: "var(--text-muted)", textDecoration: "none" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Small heading used inside policy bodies. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
        {heading}
      </h2>
      {children}
    </section>
  );
}
