/**
 * Public business identity used across the legal / contact pages.
 *
 * Razorpay (and other payment gateways) verify that these details are
 * present and consistent on your live website. Replace every
 * `REPLACE_*` placeholder with your real, registered business
 * information before submitting the site for verification.
 */
export const BUSINESS_INFO = {
  /** Legal / registered name of the entity operating Aria Mind. */
  legalName: "JB Crownstone Private Limited",
  /** Public brand / trade name shown to users. */
  brandName: "AriamindX",
  /** Support email — must be a working inbox you monitor. */
  email: "admin@jbcrownstone.com",
  /** Support phone in international format, e.g. +91 98765 43210. */
  phone: "+91 81714 90082",
  /** Full registered business address (required by Razorpay). */
  address: "C-101,Nirman Vihar, Delhi, 110029, India",
  /** Primary website URL. */
  website: "https://www.ariamindx.com",
  /** Date the current policies took effect (YYYY-MM-DD or human form). */
  policiesUpdated: "20 June 2026"
} as const;
