export type BillingPlanId = "free" | "starter" | "plus" | "pro" | "power";

export type BillingFeatureId =
  | "chat"
  | "file-chat"
  | "research"
  | "analyzer"
  | "translate"
  | "image"
  | "video"
  | "audio";

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  priceInr: number;
  monthlyCredits: number;
  accent: string;
  note: string;
};

export type BillingTopUpPack = {
  id: string;
  name: string;
  priceInr: number;
  credits: number;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    priceInr: 0,
    monthlyCredits: 40,
    accent: "#94a3b8",
    note: "Trial wallet"
  },
  {
    id: "starter",
    name: "Starter",
    priceInr: 199,
    monthlyCredits: 220,
    accent: "#22d3ee",
    note: "Light daily use"
  },
  {
    id: "plus",
    name: "Plus",
    priceInr: 499,
    monthlyCredits: 620,
    accent: "#34d399",
    note: "Regular AI work"
  },
  {
    id: "pro",
    name: "Pro",
    priceInr: 999,
    monthlyCredits: 1350,
    accent: "#60a5fa",
    note: "Research and creation"
  },
  {
    id: "power",
    name: "Power",
    priceInr: 1999,
    monthlyCredits: 3000,
    accent: "#f59e0b",
    note: "High-volume workspace"
  }
];

export const BILLING_TOP_UP_PACKS: BillingTopUpPack[] = [
  { id: "topup-small", name: "Small", priceInr: 99, credits: 90 },
  { id: "topup-medium", name: "Medium", priceInr: 299, credits: 320 },
  { id: "topup-large", name: "Large", priceInr: 999, credits: 1250 }
];

export const FEATURE_CREDIT_RATES: Array<{
  id: BillingFeatureId;
  label: string;
  credits: string;
  color: string;
}> = [
  { id: "chat", label: "Aria Mind chat", credits: "2", color: "#22d3ee" },
  { id: "file-chat", label: "File or image chat", credits: "4+", color: "#38bdf8" },
  { id: "research", label: "Aria Research", credits: "10+", color: "#60a5fa" },
  { id: "analyzer", label: "Aria Analyzer", credits: "24+", color: "#34d399" },
  { id: "translate", label: "Translate", credits: "3+", color: "#a78bfa" },
  { id: "image", label: "Image generation", credits: "28-45", color: "#f97316" },
  { id: "video", label: "Video generation", credits: "120-360", color: "#fb7185" },
  { id: "audio", label: "Audio and podcast", credits: "40+", color: "#f59e0b" }
];
