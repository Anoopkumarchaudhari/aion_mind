"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  BILLING_PLANS,
  BILLING_TOP_UP_PACKS,
  type BillingFeatureId,
  type BillingPlanId
} from "@/services/billingCatalog";
import type { AionModelId } from "@/types/aion";

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

type BillingState = {
  planId: BillingPlanId;
  usedMonthlyCredits: number;
  topUpCredits: number;
  autoTopUpEnabled: boolean;
  invoiceEmailEnabled: boolean;
  paymentMethodLabel: string;
  usage: BillingUsageItem[];
  ledger: BillingLedgerItem[];
  selectPlan: (planId: BillingPlanId) => void;
  buyTopUp: (packId: string) => void;
  spendCredits: (charge: BillingCharge) => boolean;
  toggleAutoTopUp: () => void;
  toggleInvoiceEmail: () => void;
  resetBillingCycle: () => void;
};

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      planId: "free",
      usedMonthlyCredits: 0,
      topUpCredits: 0,
      autoTopUpEnabled: false,
      invoiceEmailEnabled: true,
      paymentMethodLabel: "No payment method on file",
      usage: [],
      ledger: [],

      selectPlan(planId) {
        const plan = getBillingPlan(planId);

        set((state) => ({
          planId,
          usedMonthlyCredits: Math.min(state.usedMonthlyCredits, plan.monthlyCredits),
          ledger: [
            createLedgerItem({
              kind: "subscription",
              label: `${plan.name} plan`,
              credits: plan.monthlyCredits,
              amountInr: plan.priceInr,
              status: "paid"
            }),
            ...state.ledger
          ].slice(0, 20)
        }));
      },

      buyTopUp(packId) {
        const pack = BILLING_TOP_UP_PACKS.find((item) => item.id === packId);

        if (!pack) {
          return;
        }

        set((state) => ({
          topUpCredits: state.topUpCredits + pack.credits,
          ledger: [
            createLedgerItem({
              kind: "top-up",
              label: `${pack.name} credit pack`,
              credits: pack.credits,
              amountInr: pack.priceInr,
              status: "paid"
            }),
            ...state.ledger
          ].slice(0, 20)
        }));
      },

      spendCredits(charge) {
        const state = get();
        const available = getAvailableCredits(state);

        if (available < charge.credits) {
          return false;
        }

        const plan = getBillingPlan(state.planId);
        const monthlyRemaining = Math.max(0, plan.monthlyCredits - state.usedMonthlyCredits);
        const monthlySpend = Math.min(monthlyRemaining, charge.credits);
        const topUpSpend = charge.credits - monthlySpend;
        const usageItem: BillingUsageItem = {
          id: createClientId("usage"),
          featureId: charge.featureId,
          label: charge.label,
          credits: charge.credits,
          createdAt: Date.now()
        };

        set((current) => ({
          usedMonthlyCredits: current.usedMonthlyCredits + monthlySpend,
          topUpCredits: Math.max(0, current.topUpCredits - topUpSpend),
          usage: [usageItem, ...current.usage].slice(0, 80),
          ledger: [
            createLedgerItem({
              kind: "usage",
              label: charge.label,
              credits: -charge.credits,
              status: "recorded"
            }),
            ...current.ledger
          ].slice(0, 20)
        }));

        return true;
      },

      toggleAutoTopUp() {
        set((state) => ({ autoTopUpEnabled: !state.autoTopUpEnabled }));
      },

      toggleInvoiceEmail() {
        set((state) => ({ invoiceEmailEnabled: !state.invoiceEmailEnabled }));
      },

      resetBillingCycle() {
        const plan = getBillingPlan(get().planId);

        set((state) => ({
          usedMonthlyCredits: 0,
          ledger: [
            createLedgerItem({
              kind: "renewal",
              label: `${plan.name} monthly credits renewed`,
              credits: plan.monthlyCredits,
              status: "recorded"
            }),
            ...state.ledger
          ].slice(0, 20)
        }));
      }
    }),
    {
      name: "aion-mind-billing",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // v0 shipped every browser a fabricated "Pro" wallet. Reset stale wallets
      // to a clean Free state; real purchases are recorded server-side.
      migrate: (persisted, version) => {
        if (version < 1) {
          return {
            planId: "free",
            usedMonthlyCredits: 0,
            topUpCredits: 0,
            autoTopUpEnabled: false,
            invoiceEmailEnabled: true,
            paymentMethodLabel: "No payment method on file",
            usage: [],
            ledger: []
          } as Partial<BillingState> as BillingState;
        }

        return persisted as BillingState;
      }
    }
  )
);

export function getBillingPlan(planId: BillingPlanId) {
  return BILLING_PLANS.find((plan) => plan.id === planId) ?? BILLING_PLANS[0];
}

export function getAvailableCredits(state: Pick<BillingState, "planId" | "usedMonthlyCredits" | "topUpCredits">) {
  const plan = getBillingPlan(state.planId);
  return Math.max(0, plan.monthlyCredits - state.usedMonthlyCredits) + state.topUpCredits;
}

export function getMonthlyRemainingCredits(
  state: Pick<BillingState, "planId" | "usedMonthlyCredits">
) {
  const plan = getBillingPlan(state.planId);
  return Math.max(0, plan.monthlyCredits - state.usedMonthlyCredits);
}

export function getCreditUsagePercent(state: Pick<BillingState, "planId" | "usedMonthlyCredits">) {
  const plan = getBillingPlan(state.planId);
  return Math.min(100, Math.round((state.usedMonthlyCredits / Math.max(1, plan.monthlyCredits)) * 100));
}

export function getChatCreditCharge(model: AionModelId, attachmentCount: number): BillingCharge {
  const attachmentCredits = attachmentCount > 0 ? attachmentCount * 2 : 0;

  // Aria Mind = ask all 4 providers + GPT-5.5 judge (5 model calls).
  if (model === "aion-mind") {
    return {
      featureId: "analyzer",
      label: "Aria Mind answer",
      credits: 24 + attachmentCredits
    };
  }

  // Aria Research = all 4 providers side by side (4 model calls).
  if (model === "aion-mind-pro") {
    return {
      featureId: "research",
      label: "Aria Research answer",
      credits: 20 + attachmentCredits
    };
  }

  // Aria Analyzer = router pass + the chosen model (2 calls).
  if (model === "aion-mind-analyzer") {
    return {
      featureId: "analyzer",
      label: "Aria Analyzer answer",
      credits: 8 + attachmentCredits
    };
  }

  // Aria Diverse = one provider the user picked.
  if (model === "aria-diverse") {
    return {
      featureId: attachmentCount > 0 ? "file-chat" : "chat",
      label: "Aria Diverse answer",
      credits: (attachmentCount > 0 ? 4 : 3) + attachmentCredits
    };
  }

  // Aria Instant = one fast model.
  if (attachmentCount > 0) {
    return {
      featureId: "file-chat",
      label: "File chat answer",
      credits: 4 + attachmentCredits
    };
  }

  return {
    featureId: "chat",
    label: "Aria Instant answer",
    credits: 2
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

function createLedgerItem(input: Omit<BillingLedgerItem, "id" | "createdAt">): BillingLedgerItem {
  return {
    id: createClientId("ledger"),
    createdAt: Date.now(),
    ...input
  };
}

function createClientId(prefix: string) {
  const randomUUID = globalThis.crypto?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
