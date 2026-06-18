"use client";

import { create } from "zustand";
import {
  BILLING_PLANS,
  type BillingFeatureId,
  type BillingPlanId
} from "@/services/billingCatalog";
import type { AionModelId, AriaDiverseProvider } from "@/types/aion";

export { BILLING_PLANS, BILLING_TOP_UP_PACKS, FEATURE_CREDIT_RATES } from "@/services/billingCatalog";
export type { BillingFeatureId, BillingPlanId } from "@/services/billingCatalog";

export type BillingCharge = {
  featureId: BillingFeatureId;
  label: string;
  credits: number;
};

export type BillingUsageItem = {
  id: string;
  featureId: BillingFeatureId;
  label: string;
  credits: number;
  createdAt: number;
};

export type BillingLedgerItem = {
  id: string;
  kind: "subscription" | "top-up" | "usage" | "renewal";
  label: string;
  credits: number;
  amountInr?: number;
  status: "paid" | "recorded";
  createdAt: number;
};

// Shape returned by GET /api/billing/account (server-authoritative).
type ServerLedgerEntry = {
  id: string;
  kind: string;
  featureId: string | null;
  label: string;
  credits: number;
  balanceAfter: number;
  amountInr: number | null;
  status: string;
  createdAt: number;
};

type ServerAccount = {
  planId: string;
  credits: number;
  ledger: ServerLedgerEntry[];
};

type BillingState = {
  /** Wallet is loaded from the server; localStorage is never the source of truth. */
  planId: BillingPlanId;
  credits: number;
  usage: BillingUsageItem[];
  ledger: BillingLedgerItem[];
  loaded: boolean;
  loading: boolean;
  autoTopUpEnabled: boolean;
  invoiceEmailEnabled: boolean;
  paymentMethodLabel: string;
  loadAccount: () => Promise<void>;
  applyAccount: (account: ServerAccount) => void;
  spendCredits: (charge: BillingCharge) => Promise<boolean>;
  selectPlan: (planId: BillingPlanId) => Promise<void>;
  buyTopUp: (packId: string) => Promise<void>;
  toggleAutoTopUp: () => void;
  toggleInvoiceEmail: () => void;
  reset: () => void;
};

const LEDGER_KIND_MAP: Record<string, BillingLedgerItem["kind"]> = {
  plan: "subscription",
  topup: "top-up",
  usage: "usage",
  renewal: "renewal",
  signup: "renewal",
  adjust: "usage"
};

function mapServerLedger(entry: ServerLedgerEntry): BillingLedgerItem {
  return {
    id: entry.id,
    kind: LEDGER_KIND_MAP[entry.kind] ?? "usage",
    label: entry.label,
    credits: entry.credits,
    amountInr: entry.amountInr ?? undefined,
    status: entry.status === "paid" ? "paid" : "recorded",
    createdAt: entry.createdAt
  };
}

function deriveUsage(ledger: ServerLedgerEntry[]): BillingUsageItem[] {
  return ledger
    .filter((entry) => entry.kind === "usage")
    .map((entry) => ({
      id: entry.id,
      featureId: (entry.featureId ?? "chat") as BillingFeatureId,
      label: entry.label,
      credits: Math.abs(entry.credits),
      createdAt: entry.createdAt
    }));
}

const EMPTY_STATE = {
  planId: "free" as BillingPlanId,
  credits: 0,
  usage: [] as BillingUsageItem[],
  ledger: [] as BillingLedgerItem[],
  loaded: false,
  loading: false
};

function normalizePlanId(planId: string): BillingPlanId {
  return BILLING_PLANS.some((plan) => plan.id === planId) ? (planId as BillingPlanId) : "free";
}

export const useBillingStore = create<BillingState>()((set, get) => ({
  ...EMPTY_STATE,
  autoTopUpEnabled: false,
  invoiceEmailEnabled: true,
  paymentMethodLabel: "No payment method on file",

  applyAccount(account) {
    set({
      planId: normalizePlanId(account.planId),
      credits: Math.max(0, Math.floor(account.credits)),
      ledger: account.ledger.map(mapServerLedger),
      usage: deriveUsage(account.ledger),
      loaded: true,
      loading: false
    });
  },

  async loadAccount() {
    if (get().loading) {
      return;
    }

    set({ loading: true });

    try {
      const response = await fetch("/api/billing/account", { cache: "no-store" });

      if (!response.ok) {
        set({ loading: false });
        return;
      }

      const account = (await response.json()) as ServerAccount;
      get().applyAccount(account);
    } catch {
      set({ loading: false });
    }
  },

  async spendCredits(charge) {
    try {
      const response = await fetch("/api/billing/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureId: charge.featureId,
          label: charge.label,
          credits: charge.credits
        })
      });

      const data = (await response.json().catch(() => null)) as { ok?: boolean; balance?: number } | null;

      if (typeof data?.balance === "number") {
        set({ credits: Math.max(0, Math.floor(data.balance)) });
      }

      if (!response.ok || !data?.ok) {
        return false;
      }

      // Optimistically reflect the spend in the local history; the server is
      // still the source of truth and a reload re-syncs from it.
      set((state) => ({
        usage: [
          {
            id: `usage-${charge.featureId}-${state.ledger.length}-${charge.credits}`,
            featureId: charge.featureId,
            label: charge.label,
            credits: charge.credits,
            createdAt: 0
          },
          ...state.usage
        ].slice(0, 80)
      }));

      void get().loadAccount();
      return true;
    } catch {
      return false;
    }
  },

  async selectPlan(planId) {
    // Paid plans are credited server-side during payment verification, so we
    // just resync. Free is an explicit downgrade handled by the server.
    if (planId === "free") {
      try {
        const response = await fetch("/api/billing/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "select-free" })
        });

        if (response.ok) {
          get().applyAccount((await response.json()) as ServerAccount);
          return;
        }
      } catch {
        // fall through to a plain resync
      }
    }

    await get().loadAccount();
  },

  async buyTopUp() {
    await get().loadAccount();
  },

  toggleAutoTopUp() {
    set((state) => ({ autoTopUpEnabled: !state.autoTopUpEnabled }));
  },

  toggleInvoiceEmail() {
    set((state) => ({ invoiceEmailEnabled: !state.invoiceEmailEnabled }));
  },

  reset() {
    set({ ...EMPTY_STATE });
  }
}));

export function getBillingPlan(planId: BillingPlanId) {
  return BILLING_PLANS.find((plan) => plan.id === planId) ?? BILLING_PLANS[0];
}

export function getAvailableCredits(state: Pick<BillingState, "credits">) {
  return Math.max(0, state.credits);
}

// ─── Real, token-based credit pricing ──────────────────────────────────────
// Credits are billed from the estimated USD cost of the underlying model
// calls, marked up 2.5x so the platform keeps a 2.5x margin over raw provider
// spend. 1 credit ≈ $0.0089 (derived from the Pro plan: 1,350 credits = ₹999).
//
// USD cost per 1M tokens (input / output) for each Aria Diverse / Research
// provider. These mirror services/providerModelBalances.ts default rates.
const PROVIDER_PRICE_USD_PER_MTOK: Record<AriaDiverseProvider, { input: number; output: number }> = {
  openai: { input: 5, output: 30 }, // GPT-5.5 tier
  anthropic: { input: 5, output: 25 }, // Opus-4.8 tier
  deepseek: { input: 1.74, output: 3.48 }, // DeepSeek V4 Pro
  gemini: { input: 2, output: 12 } // Gemini 3.1 Pro
};

// Aria Instant runs one fast model (gpt-5.4-mini tier).
const INSTANT_PRICE_USD_PER_MTOK = { input: 0.75, output: 4.5 };
// Aria Mind / Analyzer synthesis + routing passes run on the GPT-5.5 judge.
const JUDGE_PRICE_USD_PER_MTOK = PROVIDER_PRICE_USD_PER_MTOK.openai;

const CREDIT_VALUE_USD = 0.0089;
const CREDIT_MARKUP = 2.5;

// Pre-send estimates (we bill before we know the real token count).
const CHARS_PER_TOKEN = 4;
const EST_OUTPUT_TOKENS = 700;
const ATTACHMENT_TOKENS_EACH = 1100;
const ALL_DIVERSE_PROVIDERS: AriaDiverseProvider[] = ["openai", "anthropic", "deepseek", "gemini"];

export type ChatChargeContext = {
  attachmentCount: number;
  inputChars: number;
  diverseProviders?: AriaDiverseProvider[];
  researchProvider?: AriaDiverseProvider;
};

function estimateInputTokens(ctx: ChatChargeContext) {
  const textTokens = Math.ceil(Math.max(0, ctx.inputChars) / CHARS_PER_TOKEN);
  const attachmentTokens = Math.max(0, ctx.attachmentCount) * ATTACHMENT_TOKENS_EACH;
  return textTokens + attachmentTokens;
}

function callCostUsd(
  price: { input: number; output: number },
  inputTokens: number,
  outputTokens: number
) {
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

function usdToCredits(costUsd: number) {
  return Math.max(1, Math.ceil((costUsd * CREDIT_MARKUP) / CREDIT_VALUE_USD));
}

export function getChatCreditCharge(model: AionModelId, ctx: ChatChargeContext): BillingCharge {
  const inputTokens = estimateInputTokens(ctx);
  const hasAttachments = ctx.attachmentCount > 0;

  // Aria Mind = ask all 4 providers + GPT-5.5 judge (5 model calls).
  if (model === "aion-mind") {
    const candidateCost = ALL_DIVERSE_PROVIDERS.reduce(
      (sum, provider) => sum + callCostUsd(PROVIDER_PRICE_USD_PER_MTOK[provider], inputTokens, EST_OUTPUT_TOKENS),
      0
    );
    // The judge reads every candidate answer as input, then writes one answer.
    const judgeInputTokens = inputTokens + ALL_DIVERSE_PROVIDERS.length * EST_OUTPUT_TOKENS;
    const judgeCost = callCostUsd(JUDGE_PRICE_USD_PER_MTOK, judgeInputTokens, EST_OUTPUT_TOKENS);

    return {
      featureId: "analyzer",
      label: "Aria Mind answer",
      credits: usdToCredits(candidateCost + judgeCost)
    };
  }

  // Aria Research = the single provider the user picked.
  if (model === "aion-mind-pro") {
    const provider = ctx.researchProvider ?? "openai";
    const cost = callCostUsd(PROVIDER_PRICE_USD_PER_MTOK[provider], inputTokens, EST_OUTPUT_TOKENS);

    return {
      featureId: "research",
      label: "Aria Research answer",
      credits: usdToCredits(cost)
    };
  }

  // Aria Analyzer = router pass (judge) + the single chosen model.
  if (model === "aion-mind-analyzer") {
    const routerCost = callCostUsd(JUDGE_PRICE_USD_PER_MTOK, inputTokens + 120, 8);
    // We do not know which model the router will pick yet; price the most
    // expensive provider so we never undercharge.
    const answerCost = callCostUsd(PROVIDER_PRICE_USD_PER_MTOK.openai, inputTokens, EST_OUTPUT_TOKENS);

    return {
      featureId: "analyzer",
      label: "Aria Analyzer answer",
      credits: usdToCredits(routerCost + answerCost)
    };
  }

  // Aria Diverse = one call per provider the user selected (1–5), side by side.
  if (model === "aria-diverse") {
    const providers =
      ctx.diverseProviders && ctx.diverseProviders.length > 0 ? ctx.diverseProviders : ["openai" as AriaDiverseProvider];
    const cost = providers.reduce(
      (sum, provider) => sum + callCostUsd(PROVIDER_PRICE_USD_PER_MTOK[provider], inputTokens, EST_OUTPUT_TOKENS),
      0
    );

    return {
      featureId: hasAttachments ? "file-chat" : "chat",
      label: providers.length > 1 ? `Aria Diverse answer (${providers.length} models)` : "Aria Diverse answer",
      credits: usdToCredits(cost)
    };
  }

  // Aria Instant = one fast model.
  const cost = callCostUsd(INSTANT_PRICE_USD_PER_MTOK, inputTokens, EST_OUTPUT_TOKENS);

  return {
    featureId: hasAttachments ? "file-chat" : "chat",
    label: hasAttachments ? "File chat answer" : "Aria Instant answer",
    credits: usdToCredits(cost)
  };
}

export function getImageCreditCharge(modelKey: string, quality: string): BillingCharge {
  const proCost = modelKey === "pro" ? 45 : 28;
  const qualityCost = quality === "high" ? 7 : 0;

  return {
    featureId: "image",
    label: "Image generation",
    credits: proCost + qualityCost
  };
}

export function getVideoCreditCharge(
  provider: string,
  modelKey: string,
  duration: number,
  mode: string
): BillingCharge {
  const providerCost =
    provider === "google"
      ? modelKey === "pro"
        ? 260
        : modelKey === "lite"
          ? 130
          : 190
      : modelKey === "pro"
        ? 220
        : 120;
  const durationCost = Math.max(0, duration - 5) * 18;
  const imageModeCost = mode === "image" ? 25 : 0;

  return {
    featureId: "video",
    label: "Video generation",
    credits: providerCost + durationCost + imageModeCost
  };
}

export function getTranslateCreditCharge(textLength: number): BillingCharge {
  return {
    featureId: "translate",
    label: "Translation",
    credits: Math.max(3, Math.ceil(textLength / 1200) * 3)
  };
}

