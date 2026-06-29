import { isDatabaseConfigured, query } from "@/services/db";
import {
  getDefaultBillingCatalog,
  mergeBillingCatalog,
  type BillingPlan,
  type BillingTopUpPack,
  type FeatureCreditRate,
  type ResolvedBillingCatalog
} from "@/services/billingCatalog";

/**
 * Generic key/value settings store backed by the `app_settings` table, plus
 * typed helpers for the three admin-controlled config groups:
 *   - feature flags (signup, maintenance, broadcast announcement)
 *   - provider budgets / enablement
 *   - billing catalog overrides (plans, top-ups, feature rates)
 *
 * Each helper returns sensible defaults when the database is not configured or
 * a key has never been written, so the rest of the app always gets a value.
 */

const SETTINGS_KEYS = {
  featureFlags: "feature_flags",
  providerBudgets: "provider_budgets",
  billingOverrides: "billing_overrides",
  // Full admin-managed catalog (supports adding / removing items, not just
  // field overrides). Takes precedence over billingOverrides when present.
  billingCatalog: "billing_catalog"
} as const;

export type AnnouncementTone = "info" | "success" | "warning" | "danger";

export type FeatureFlags = {
  signupEnabled: boolean;
  maintenanceMode: boolean;
  announcement: {
    enabled: boolean;
    tone: AnnouncementTone;
    message: string;
  };
};

export type ProviderBudget = {
  enabled: boolean;
  budgetUsd: number | null;
  /** Manual real balance from the provider console; overrides API/budget math when set. */
  balanceUsd: number | null;
};

export type ProviderBudgets = Record<string, ProviderBudget>;

export type BillingOverrides = {
  plans: Record<string, Partial<Pick<BillingPlan, "priceInr" | "monthlyCredits" | "note">>>;
  topUps: Record<string, Partial<Pick<BillingTopUpPack, "priceInr" | "credits">>>;
  featureRates: Record<string, { credits?: string }>;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  signupEnabled: true,
  maintenanceMode: false,
  announcement: {
    enabled: false,
    tone: "info",
    message: ""
  }
};

const DEFAULT_BILLING_OVERRIDES: BillingOverrides = {
  plans: {},
  topUps: {},
  featureRates: {}
};

type SettingRow = {
  value: unknown;
};

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  if (!isDatabaseConfigured()) {
    return fallback;
  }

  try {
    const result = await query<SettingRow>("SELECT value FROM app_settings WHERE key = $1", [key]);
    const value = result.rows[0]?.value;

    if (value && typeof value === "object") {
      return value as T;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

async function writeSetting<T>(key: string, value: T): Promise<T> {
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, JSON.stringify(value), Date.now()]
  );

  return value;
}

/* -------------------------------------------------------------------------- */
/* Feature flags                                                              */
/* -------------------------------------------------------------------------- */

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const stored = await readSetting<Partial<FeatureFlags>>(SETTINGS_KEYS.featureFlags, {});
  return normalizeFeatureFlags(stored);
}

export async function saveFeatureFlags(value: unknown): Promise<FeatureFlags> {
  const next = normalizeFeatureFlags(value);
  await writeSetting(SETTINGS_KEYS.featureFlags, next);
  return next;
}

function normalizeFeatureFlags(value: unknown): FeatureFlags {
  const record = asRecord(value);
  const announcement = asRecord(record.announcement);
  const tone = announcement.tone;

  return {
    signupEnabled: asBoolean(record.signupEnabled, DEFAULT_FEATURE_FLAGS.signupEnabled),
    maintenanceMode: asBoolean(record.maintenanceMode, DEFAULT_FEATURE_FLAGS.maintenanceMode),
    announcement: {
      enabled: asBoolean(announcement.enabled, false),
      tone: isAnnouncementTone(tone) ? tone : "info",
      message: typeof announcement.message === "string" ? announcement.message.trim().slice(0, 280) : ""
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Provider budgets                                                           */
/* -------------------------------------------------------------------------- */

export async function getProviderBudgets(): Promise<ProviderBudgets> {
  const stored = await readSetting<ProviderBudgets>(SETTINGS_KEYS.providerBudgets, {});
  return normalizeProviderBudgets(stored);
}

export async function saveProviderBudgets(value: unknown): Promise<ProviderBudgets> {
  const next = normalizeProviderBudgets(value);
  await writeSetting(SETTINGS_KEYS.providerBudgets, next);
  return next;
}

function normalizeProviderBudgets(value: unknown): ProviderBudgets {
  const record = asRecord(value);
  const next: ProviderBudgets = {};

  for (const [id, raw] of Object.entries(record)) {
    const entry = asRecord(raw);

    next[id] = {
      enabled: asBoolean(entry.enabled, true),
      budgetUsd: normalizeUsd(entry.budgetUsd),
      balanceUsd: normalizeUsd(entry.balanceUsd)
    };
  }

  return next;
}

/* -------------------------------------------------------------------------- */
/* Billing catalog overrides                                                  */
/* -------------------------------------------------------------------------- */

export async function getBillingOverrides(): Promise<BillingOverrides> {
  const stored = await readSetting<BillingOverrides>(SETTINGS_KEYS.billingOverrides, DEFAULT_BILLING_OVERRIDES);
  return normalizeBillingOverrides(stored);
}

export async function saveBillingOverrides(value: unknown): Promise<BillingOverrides> {
  const next = normalizeBillingOverrides(value);
  await writeSetting(SETTINGS_KEYS.billingOverrides, next);
  return next;
}

/* -------------------------------------------------------------------------- */
/* Full billing catalog (admin-managed: add / edit / remove / reorder)        */
/* -------------------------------------------------------------------------- */

/**
 * The catalog that every customer-facing surface should render. Resolution
 * order: the full admin-managed catalog if it exists, otherwise the static
 * defaults with any legacy field-overrides applied. Call this from server
 * components so plan/credit/rate edits propagate everywhere.
 */
export async function getResolvedBillingCatalog(): Promise<ResolvedBillingCatalog> {
  return getBillingCatalog();
}

export async function getBillingCatalog(): Promise<ResolvedBillingCatalog> {
  const stored = await readSetting<unknown>(SETTINGS_KEYS.billingCatalog, null);
  const normalized = normalizeBillingCatalog(stored);
  if (normalized) {
    return normalized;
  }
  // No managed catalog yet — seed from defaults + any legacy field overrides.
  return mergeBillingCatalog(await getBillingOverrides());
}

export async function saveBillingCatalog(value: unknown): Promise<ResolvedBillingCatalog> {
  const normalized = normalizeBillingCatalog(value) ?? getDefaultBillingCatalog();
  await writeSetting(SETTINGS_KEYS.billingCatalog, normalized);
  return normalized;
}

/** Validate a full catalog object. Returns null when it isn't a usable catalog. */
function normalizeBillingCatalog(value: unknown): ResolvedBillingCatalog | null {
  const record = asRecord(value);
  if (!Array.isArray(record.plans) || !Array.isArray(record.topUps) || !Array.isArray(record.featureRates)) {
    return null;
  }

  const seenPlan = new Set<string>();
  const plans: BillingPlan[] = [];
  for (const raw of record.plans) {
    const entry = asRecord(raw);
    const id = slugId(entry.id, "plan", seenPlan);
    plans.push({
      id,
      name: asText(entry.name, "Plan", 40),
      priceInr: clampInt(entry.priceInr, 0, 10_000_000),
      monthlyCredits: clampInt(entry.monthlyCredits, 0, 100_000_000),
      accent: asColor(entry.accent, "#3b6df5"),
      note: asText(entry.note, "", 80)
    });
  }

  const seenTopUp = new Set<string>();
  const topUps: BillingTopUpPack[] = [];
  for (const raw of record.topUps) {
    const entry = asRecord(raw);
    topUps.push({
      id: slugId(entry.id, "topup", seenTopUp),
      name: asText(entry.name, "Pack", 40),
      priceInr: clampInt(entry.priceInr, 0, 10_000_000),
      credits: clampInt(entry.credits, 0, 100_000_000)
    });
  }

  const seenRate = new Set<string>();
  const featureRates: FeatureCreditRate[] = [];
  for (const raw of record.featureRates) {
    const entry = asRecord(raw);
    featureRates.push({
      id: slugId(entry.id, "feature", seenRate),
      label: asText(entry.label, "Feature", 48),
      credits: asText(entry.credits, "1", 24),
      color: asColor(entry.color, "#3b6df5")
    });
  }

  if (plans.length === 0 && topUps.length === 0 && featureRates.length === 0) {
    return null;
  }

  return { plans, topUps, featureRates };
}

function normalizeBillingOverrides(value: unknown): BillingOverrides {
  const record = asRecord(value);
  const next: BillingOverrides = { plans: {}, topUps: {}, featureRates: {} };

  for (const [id, raw] of Object.entries(asRecord(record.plans))) {
    const entry = asRecord(raw);
    const patch: BillingOverrides["plans"][string] = {};
    if (isFiniteNumber(entry.priceInr)) patch.priceInr = clampInt(entry.priceInr, 0, 10_000_000);
    if (isFiniteNumber(entry.monthlyCredits)) patch.monthlyCredits = clampInt(entry.monthlyCredits, 0, 100_000_000);
    if (typeof entry.note === "string") patch.note = entry.note.trim().slice(0, 80);
    if (Object.keys(patch).length) next.plans[id] = patch;
  }

  for (const [id, raw] of Object.entries(asRecord(record.topUps))) {
    const entry = asRecord(raw);
    const patch: BillingOverrides["topUps"][string] = {};
    if (isFiniteNumber(entry.priceInr)) patch.priceInr = clampInt(entry.priceInr, 0, 10_000_000);
    if (isFiniteNumber(entry.credits)) patch.credits = clampInt(entry.credits, 0, 100_000_000);
    if (Object.keys(patch).length) next.topUps[id] = patch;
  }

  for (const [id, raw] of Object.entries(asRecord(record.featureRates))) {
    const entry = asRecord(raw);
    if (typeof entry.credits === "string" && entry.credits.trim()) {
      next.featureRates[id] = { credits: entry.credits.trim().slice(0, 24) };
    }
  }

  return next;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown, fallback: string, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function asColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value.trim()) ? value.trim() : fallback;
}

/** Produce a unique, URL-safe id; generate one when missing/duplicated. */
function slugId(value: unknown, prefix: string, seen: Set<string>) {
  let base =
    typeof value === "string"
      ? value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      : "";
  if (!base) {
    base = `${prefix}-${seen.size + 1}`;
  }
  let id = base;
  let n = 2;
  while (seen.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  seen.add(id);
  return id;
}

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function isAnnouncementTone(value: unknown): value is AnnouncementTone {
  return value === "info" || value === "success" || value === "warning" || value === "danger";
}

function isFiniteNumber(value: unknown): value is number {
  return Number.isFinite(Number(value));
}

function clampInt(value: unknown, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(Number(value))));
}

function normalizeUsd(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}
