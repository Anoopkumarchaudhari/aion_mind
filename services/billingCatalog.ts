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
    note: ""
  },
  {
    id: "starter",
    name: "Starter",
    priceInr: 199,
    monthlyCredits: 220,
    accent: "#22d3ee",
    note: ""
  },
  {
    id: "plus",
    name: "Plus",
    priceInr: 499,
    monthlyCredits: 620,
    accent: "#34d399",
    note: ""
  },
  {
    id: "pro",
    name: "Pro",
    priceInr: 999,
    monthlyCredits: 1350,
    accent: "#60a5fa",
    note: ""
  },
  {
    id: "power",
    name: "Power",
    priceInr: 1999,
    monthlyCredits: 3000,
    accent: "#f59e0b",
    note: ""
  }
];

export const BILLING_TOP_UP_PACKS: BillingTopUpPack[] = [
  { id: "topup-small", name: "Small", priceInr: 99, credits: 90 },
  { id: "topup-medium", name: "Medium", priceInr: 299, credits: 320 },
  { id: "topup-large", name: "Large", priceInr: 999, credits: 1250 }
];

export type FeatureCreditRate = {
  id: BillingFeatureId;
  label: string;
  credits: string;
  color: string;
};

export const FEATURE_CREDIT_RATES: FeatureCreditRate[] = [
  { id: "chat", label: "Aria Instant / Diverse", credits: "2-3", color: "#22d3ee" },
  { id: "file-chat", label: "File or image chat", credits: "4+", color: "#38bdf8" },
  { id: "research", label: "Aria Research (all models)", credits: "20+", color: "#60a5fa" },
  { id: "analyzer", label: "Aria Mind / Analyzer", credits: "8-24+", color: "#34d399" },
  { id: "translate", label: "Translate", credits: "3+", color: "#a78bfa" },
  { id: "image", label: "Image generation", credits: "28-45", color: "#f97316" },
  { id: "video", label: "Video generation", credits: "120-360", color: "#fb7185" },
  { id: "audio", label: "Audio and podcast", credits: "40+", color: "#f59e0b" }
];

export type ResolvedBillingCatalog = {
  plans: BillingPlan[];
  topUps: BillingTopUpPack[];
  featureRates: FeatureCreditRate[];
};

type BillingCatalogOverrides = {
  plans?: Record<string, Partial<Pick<BillingPlan, "priceInr" | "monthlyCredits" | "note">>>;
  topUps?: Record<string, Partial<Pick<BillingTopUpPack, "priceInr" | "credits">>>;
  featureRates?: Record<string, { credits?: string }>;
};

/**
 * Merge admin-edited overrides on top of the static defaults. Unknown ids and
 * undefined fields fall through to the defaults, so a partial override is safe.
 */
export function mergeBillingCatalog(overrides: BillingCatalogOverrides | null | undefined): ResolvedBillingCatalog {
  const safe = overrides ?? {};

  return {
    plans: BILLING_PLANS.map((plan) => {
      const patch = safe.plans?.[plan.id];
      return patch ? { ...plan, ...stripUndefined(patch) } : plan;
    }),
    topUps: BILLING_TOP_UP_PACKS.map((pack) => {
      const patch = safe.topUps?.[pack.id];
      return patch ? { ...pack, ...stripUndefined(patch) } : pack;
    }),
    featureRates: FEATURE_CREDIT_RATES.map((rate) => {
      const patch = safe.featureRates?.[rate.id];
      return patch?.credits ? { ...rate, credits: patch.credits } : rate;
    })
  };
}

export function getDefaultBillingCatalog(): ResolvedBillingCatalog {
  return {
    plans: BILLING_PLANS,
    topUps: BILLING_TOP_UP_PACKS,
    featureRates: FEATURE_CREDIT_RATES
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
