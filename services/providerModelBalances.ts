import { fetchJsonWithTimeout, getTimeoutMs, truncate } from "@/providers/providerUtils";
import { loadAionRoutingSettings } from "@/services/aionRoutingConfig";
import { getProviderBudgets } from "@/services/adminSettings";
import {
  getAionRoutingProviderLabel,
  type AionRouteSlot,
  type AionRoutingProvider
} from "@/types/aionRouting";

type ModelPrice = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  sourceLabel: string;
};

type ProviderCatalog = {
  status: ProviderModelBalanceRow["liveStatus"];
  source: string;
  modelIds: Set<string>;
  modelDetails: Map<string, ProviderModelDetails>;
  message?: string;
};

type ProviderModelDetails = {
  displayName?: string;
  contextWindowTokens?: number;
  outputLimitTokens?: number;
};

type OpenAIModelsResponse = {
  data?: Array<{
    id?: string;
  }>;
};

type AnthropicModelsResponse = {
  data?: Array<{
    id?: string;
    display_name?: string;
  }>;
};

type GeminiModelsResponse = {
  models?: Array<{
    name?: string;
    baseModelId?: string;
    displayName?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
  }>;
};

type OpenAICostsResponse = {
  data?: Array<{
    results?: Array<{
      amount?: {
        currency?: string;
        value?: number | string;
      };
    }>;
  }>;
};

type OpenAICreditGrantsResponse = {
  total_granted?: number;
  total_used?: number;
  total_available?: number;
  total_paid_available?: number;
};

type DeepSeekBalanceResponse = {
  is_available?: boolean;
  balance_infos?: Array<{
    currency?: string;
    total_balance?: string | number;
    granted_balance?: string | number;
    topped_up_balance?: string | number;
  }>;
};

type AnthropicCostAmount = string | number | { value?: number; currency?: string } | undefined;

type AnthropicCostResponse = {
  data?: Array<{
    results?: Array<{
      amount?: AnthropicCostAmount;
      currency?: string;
    }>;
  }>;
};

type ProviderBalance = {
  remainingUsd: number;
  source: string;
};

type RouteModelSlot = {
  routeLabel: string;
  slot: AionRouteSlot;
};

export type ProviderModelBalanceRow = {
  id: string;
  provider: AionRoutingProvider;
  providerLabel: string;
  label: string;
  model: string;
  enabled: boolean;
  routes: string[];
  liveStatus: "available" | "not-found" | "missing-key" | "api-error" | "not-supported";
  liveStatusLabel: string;
  liveSource: string;
  inputUsdPerMillion: number | null;
  outputUsdPerMillion: number | null;
  pricingSource: string | null;
  budgetUsd: number | null;
  spentUsd: number | null;
  remainingUsd: number | null;
  balanceSource: string | null;
  inputTokensLeft: number | null;
  outputTokensLeft: number | null;
  contextWindowTokens?: number;
  outputLimitTokens?: number;
  note?: string;
};

export type ProviderModelBalancesPayload = {
  generatedAt: string;
  cycleStart: string;
  rows: ProviderModelBalanceRow[];
  notes: string[];
};

const MODEL_PRICES: Record<string, ModelPrice> = {
  "openai:gpt-5.5": {
    inputUsdPerMillion: 5,
    outputUsdPerMillion: 30,
    sourceLabel: "OpenAI standard short-context pricing"
  },
  "openai:gpt-5.4": {
    inputUsdPerMillion: 2.5,
    outputUsdPerMillion: 15,
    sourceLabel: "OpenAI standard short-context pricing"
  },
  "openai:gpt-5.4-mini": {
    inputUsdPerMillion: 0.75,
    outputUsdPerMillion: 4.5,
    sourceLabel: "OpenAI standard pricing"
  },
  "openai:gpt-5.4-nano": {
    inputUsdPerMillion: 0.2,
    outputUsdPerMillion: 1.25,
    sourceLabel: "OpenAI standard pricing"
  },
  "anthropic:claude-fable-5": {
    inputUsdPerMillion: 10,
    outputUsdPerMillion: 50,
    sourceLabel: "Anthropic standard pricing"
  },
  "anthropic:claude-opus-4-8": {
    inputUsdPerMillion: 5,
    outputUsdPerMillion: 25,
    sourceLabel: "Anthropic standard pricing"
  },
  "anthropic:claude-sonnet-4-6": {
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    sourceLabel: "Anthropic standard pricing"
  },
  "anthropic:claude-haiku-4-5": {
    inputUsdPerMillion: 1,
    outputUsdPerMillion: 5,
    sourceLabel: "Anthropic standard pricing"
  },
  "deepseek:deepseek-v4-pro": {
    inputUsdPerMillion: 1.74,
    outputUsdPerMillion: 3.48,
    sourceLabel: "DeepSeek API standard pricing"
  },
  "deepseek:deepseek-v4-flash": {
    inputUsdPerMillion: 0.14,
    outputUsdPerMillion: 0.28,
    sourceLabel: "DeepSeek API standard pricing"
  },
  "deepseek:deepseek-chat": {
    inputUsdPerMillion: 0.14,
    outputUsdPerMillion: 0.28,
    sourceLabel: "DeepSeek API standard pricing (V4 Flash alias)"
  },
  "deepseek:deepseek-reasoner": {
    inputUsdPerMillion: 0.14,
    outputUsdPerMillion: 0.28,
    sourceLabel: "DeepSeek API standard pricing (V4 Flash alias)"
  },
  "gemini:gemini-3.1-pro-preview": {
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 12,
    sourceLabel: "Google Gemini API standard pricing"
  },
  "gemini:gemini-3-flash-preview": {
    inputUsdPerMillion: 0.5,
    outputUsdPerMillion: 3,
    sourceLabel: "Google Gemini API standard pricing"
  },
  "gemini:gemini-2.5-pro": {
    inputUsdPerMillion: 1.25,
    outputUsdPerMillion: 10,
    sourceLabel: "Google Gemini API standard pricing"
  }
};

const PROVIDER_MODEL_ENDPOINTS: Record<AionRoutingProvider, string> = {
  openai: "https://api.openai.com/v1/models",
  anthropic: "https://api.anthropic.com/v1/models",
  deepseek: "https://api.deepseek.com/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  grok: "https://api.x.ai/v1/models"
};

export async function getProviderModelBalances(): Promise<ProviderModelBalancesPayload> {
  const settings = await loadAionRoutingSettings();
  const slots = dedupeRouteSlots([
    { routeLabel: "Aria Mind", slot: settings.aion.primary },
    ...settings.pro.candidates.map((slot) => ({ routeLabel: "Aria Research", slot })),
    { routeLabel: "Aria Research judge", slot: settings.pro.judge },
    ...settings.analyzer.candidates.map((slot) => ({ routeLabel: "Aria Analyzer", slot })),
    { routeLabel: "Aria Analyzer judge", slot: settings.analyzer.judge }
  ]);
  const providers = [...new Set(slots.map((item) => item.slot.provider))];
  const [catalogs, spendByProvider, balanceByProvider, adminBudgets] = await Promise.all([
    getProviderCatalogs(providers),
    getProviderSpend(providers),
    getProviderBalances(providers),
    getProviderBudgets()
  ]);
  const generatedAt = new Date();
  const rows = slots.map((item) => {
    const { slot } = item;
    const providerCatalog = catalogs.get(slot.provider) ?? getUnsupportedCatalog(slot.provider);
    const price = getModelPrice(slot.provider, slot.model);
    const liveBalance = balanceByProvider.get(slot.provider) ?? null;
    const adminBudget = adminBudgets[slot.provider];
    const providerDisabled = adminBudget?.enabled === false;
    // Admin-configured budget (DB) takes priority over env vars.
    const configuredBudget = adminBudget?.budgetUsd ?? getProviderBudgetUsd(slot.provider);
    const spentUsd = spendByProvider.get(slot.provider) ?? null;

    // Priority for "remaining":
    //   1. Manual balance the admin typed from the provider console (most reliable).
    //   2. A live balance API (DeepSeek /user/balance, OpenAI credit grants).
    //   3. Budget − spend math.
    const manualBalance = adminBudget?.balanceUsd ?? null;
    let remainingUsd: number | null;
    let budgetUsd: number | null;
    let balanceSource: string | null = null;

    if (manualBalance !== null) {
      remainingUsd = manualBalance;
      budgetUsd = configuredBudget ?? manualBalance;
      balanceSource = "Manual (admin)";
    } else if (liveBalance) {
      remainingUsd = liveBalance.remainingUsd;
      budgetUsd = configuredBudget ?? liveBalance.remainingUsd;
      balanceSource = liveBalance.source;
    } else {
      budgetUsd = configuredBudget;
      remainingUsd = budgetUsd === null ? null : Math.max(0, budgetUsd - Math.max(0, spentUsd ?? 0));
    }

    const liveStatus = getLiveStatus(slot.model, providerCatalog);
    const modelDetails = getModelDetails(slot.model, providerCatalog);
    const note = getRowNote(slot.provider, price, budgetUsd, providerCatalog.message, {
      hasLiveBalance: Boolean(liveBalance),
      providerDisabled
    });

    return {
      id: `${slot.provider}:${slot.model}`,
      provider: slot.provider,
      providerLabel: getAionRoutingProviderLabel(slot.provider),
      label: modelDetails.displayName || slot.label,
      model: slot.model,
      enabled: item.slot.enabled && !providerDisabled,
      routes: item.routeLabel.split(" | "),
      liveStatus,
      liveStatusLabel: getLiveStatusLabel(liveStatus),
      liveSource: providerCatalog.source,
      inputUsdPerMillion: price?.inputUsdPerMillion ?? null,
      outputUsdPerMillion: price?.outputUsdPerMillion ?? null,
      pricingSource: price?.sourceLabel ?? null,
      budgetUsd,
      spentUsd,
      remainingUsd,
      balanceSource,
      inputTokensLeft: estimateTokensLeft(remainingUsd, price?.inputUsdPerMillion),
      outputTokensLeft: estimateTokensLeft(remainingUsd, price?.outputUsdPerMillion),
      contextWindowTokens: modelDetails.contextWindowTokens,
      outputLimitTokens: modelDetails.outputLimitTokens,
      note
    } satisfies ProviderModelBalanceRow;
  });

  return {
    generatedAt: generatedAt.toISOString(),
    cycleStart: getCycleStartDate().toISOString(),
    rows,
    notes: [
      "Live status is fetched from each provider's model-list API using server-side keys.",
      "Real balance: DeepSeek (/user/balance) and OpenAI (credit grants, if your account exposes it) report actual remaining balance.",
      "Real spend: OpenAI and Anthropic cost APIs (need OPENAI_ADMIN_API_KEY / ANTHROPIC_ADMIN_API_KEY) give live month-to-date spend; remaining = budget − spend.",
      "Gemini and Grok have no public balance/spend API, so they rely on the budget you set in Admin → Providers (which overrides the *_BUDGET_USD env values)."
    ]
  };
}

function dedupeRouteSlots(items: RouteModelSlot[]) {
  const grouped = new Map<string, RouteModelSlot>();

  for (const item of items) {
    const key = `${item.slot.provider}:${item.slot.model}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, item);
      continue;
    }

    grouped.set(key, {
      routeLabel: mergeLabels(existing.routeLabel, item.routeLabel),
      slot: {
        ...existing.slot,
        enabled: existing.slot.enabled || item.slot.enabled
      }
    });
  }

  return [...grouped.values()].sort((a, b) =>
    `${a.slot.provider}:${a.slot.model}`.localeCompare(`${b.slot.provider}:${b.slot.model}`)
  );
}

async function getProviderCatalogs(providers: AionRoutingProvider[]) {
  const entries = await Promise.all(
    providers.map(async (provider) => [provider, await getProviderCatalog(provider)] as const)
  );

  return new Map(entries);
}

async function getProviderCatalog(provider: AionRoutingProvider): Promise<ProviderCatalog> {
  switch (provider) {
    case "openai":
      return getOpenAIModelCatalog();
    case "anthropic":
      return getAnthropicModelCatalog();
    case "gemini":
      return getGeminiModelCatalog();
    case "deepseek":
      return getOpenAICompatibleCatalog(provider, readEnv("DEEPSEEK_API_KEY"));
    case "grok":
      return getOpenAICompatibleCatalog(provider, readEnv("GROK_API_KEY"));
  }
}

async function getOpenAIModelCatalog(): Promise<ProviderCatalog> {
  const apiKey = readEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return missingKeyCatalog("openai", "OPENAI_API_KEY");
  }

  try {
    const data = await fetchJsonWithTimeout<OpenAIModelsResponse>(
      PROVIDER_MODEL_ENDPOINTS.openai,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      },
      getModelBalanceTimeoutMs(),
      { maxRetries: 0 }
    );

    return fromModelIds("openai", data.data?.map((model) => model.id) ?? []);
  } catch (error) {
    return apiErrorCatalog("openai", error);
  }
}

async function getAnthropicModelCatalog(): Promise<ProviderCatalog> {
  const apiKey = readEnv("ANTHROPIC_API_KEY");

  if (!apiKey) {
    return missingKeyCatalog("anthropic", "ANTHROPIC_API_KEY");
  }

  try {
    const data = await fetchJsonWithTimeout<AnthropicModelsResponse>(
      `${PROVIDER_MODEL_ENDPOINTS.anthropic}?limit=1000`,
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        }
      },
      getModelBalanceTimeoutMs(),
      { maxRetries: 0 }
    );
    const details = new Map<string, ProviderModelDetails>();

    for (const model of data.data ?? []) {
      if (model.id) {
        details.set(model.id, { displayName: model.display_name });
      }
    }

    return {
      ...fromModelIds("anthropic", data.data?.map((model) => model.id) ?? []),
      modelDetails: details
    };
  } catch (error) {
    return apiErrorCatalog("anthropic", error);
  }
}

async function getGeminiModelCatalog(): Promise<ProviderCatalog> {
  const apiKey = readEnv("GEMINI_API_KEY");

  if (!apiKey) {
    return missingKeyCatalog("gemini", "GEMINI_API_KEY");
  }

  try {
    const url = `${PROVIDER_MODEL_ENDPOINTS.gemini}?pageSize=1000&key=${encodeURIComponent(apiKey)}`;
    const data = await fetchJsonWithTimeout<GeminiModelsResponse>(
      url,
      {},
      getModelBalanceTimeoutMs(),
      { maxRetries: 0 }
    );
    const ids: string[] = [];
    const details = new Map<string, ProviderModelDetails>();

    for (const model of data.models ?? []) {
      const normalizedIds = [
        model.name,
        model.name?.replace(/^models\//, ""),
        model.baseModelId
      ].filter(Boolean) as string[];

      ids.push(...normalizedIds);

      for (const id of normalizedIds) {
        details.set(id, {
          displayName: model.displayName,
          contextWindowTokens: model.inputTokenLimit,
          outputLimitTokens: model.outputTokenLimit
        });
      }
    }

    return {
      ...fromModelIds("gemini", ids),
      modelDetails: details
    };
  } catch (error) {
    return apiErrorCatalog("gemini", error);
  }
}

async function getOpenAICompatibleCatalog(
  provider: Extract<AionRoutingProvider, "deepseek" | "grok">,
  apiKey: string
): Promise<ProviderCatalog> {
  const envName = provider === "deepseek" ? "DEEPSEEK_API_KEY" : "GROK_API_KEY";

  if (!apiKey) {
    return missingKeyCatalog(provider, envName);
  }

  try {
    const data = await fetchJsonWithTimeout<OpenAIModelsResponse>(
      PROVIDER_MODEL_ENDPOINTS[provider],
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      },
      getModelBalanceTimeoutMs(),
      { maxRetries: 0 }
    );

    return fromModelIds(provider, data.data?.map((model) => model.id) ?? []);
  } catch (error) {
    return apiErrorCatalog(provider, error);
  }
}

async function getProviderSpend(providers: AionRoutingProvider[]) {
  const entries = await Promise.all(
    providers.map(async (provider) => [provider, await getProviderSpentUsd(provider)] as const)
  );

  return new Map(entries);
}

async function getProviderSpentUsd(provider: AionRoutingProvider) {
  if (provider === "openai") {
    const liveCost = await getOpenAICycleCostUsd();

    if (liveCost !== null) {
      return liveCost;
    }
  }

  if (provider === "anthropic") {
    const liveCost = await getAnthropicCycleCostUsd();

    if (liveCost !== null) {
      return liveCost;
    }
  }

  return readNumberEnv(`${provider.toUpperCase()}_SPENT_USD`);
}

/**
 * Real account balances. Only providers that expose a balance API are queried;
 * the rest return null and fall back to budget-minus-spend math.
 */
async function getProviderBalances(providers: AionRoutingProvider[]) {
  const entries = await Promise.all(
    providers.map(async (provider) => [provider, await getProviderBalanceUsd(provider)] as const)
  );

  return new Map(entries.filter((entry): entry is [AionRoutingProvider, ProviderBalance] => entry[1] !== null));
}

async function getProviderBalanceUsd(provider: AionRoutingProvider): Promise<ProviderBalance | null> {
  if (provider === "deepseek") {
    return getDeepSeekBalanceUsd();
  }

  if (provider === "openai") {
    return getOpenAICreditBalanceUsd();
  }

  return null;
}

/**
 * Best-effort: OpenAI's legacy credit-grants endpoint returns the real
 * available prepaid balance for accounts that still expose it. Many accounts
 * now require a dashboard session token and will 401 here — in that case we
 * return null and fall back to spend/budget math.
 */
async function getOpenAICreditBalanceUsd(): Promise<ProviderBalance | null> {
  const apiKey = readEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return null;
  }

  try {
    const data = await fetchJsonWithTimeout<OpenAICreditGrantsResponse>(
      "https://api.openai.com/dashboard/billing/credit_grants",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      },
      getModelBalanceTimeoutMs(),
      { maxRetries: 0 }
    );

    const available = Number(data.total_available);

    if (!Number.isFinite(available)) {
      return null;
    }

    return {
      remainingUsd: Math.max(0, available),
      source: "OpenAI credit grants"
    };
  } catch {
    return null;
  }
}

async function getDeepSeekBalanceUsd(): Promise<ProviderBalance | null> {
  const apiKey = readEnv("DEEPSEEK_API_KEY");

  if (!apiKey) {
    return null;
  }

  try {
    const data = await fetchJsonWithTimeout<DeepSeekBalanceResponse>(
      "https://api.deepseek.com/user/balance",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json"
        }
      },
      getModelBalanceTimeoutMs(),
      { maxRetries: 0 }
    );

    const infos = data.balance_infos ?? [];
    const usdInfo = infos.find((info) => (info.currency ?? "").toUpperCase() === "USD");
    const info = usdInfo ?? infos[0];

    if (!info) {
      return null;
    }

    const total = Number(info.total_balance);

    if (!Number.isFinite(total)) {
      return null;
    }

    const currency = (info.currency ?? "USD").toUpperCase();

    return {
      remainingUsd: Math.max(0, total),
      source: `DeepSeek /user/balance${currency === "USD" ? "" : ` (${currency})`}`
    };
  } catch {
    return null;
  }
}

async function getAnthropicCycleCostUsd() {
  const apiKey = readEnv("ANTHROPIC_ADMIN_API_KEY");

  if (!apiKey) {
    return null;
  }

  // Anthropic Cost API: amounts are USD decimal strings, bucketed by day.
  // limit is the number of time buckets (max 31), so a 1d bucket covers a month.
  const params = new URLSearchParams({
    starting_at: getCycleStartDate().toISOString(),
    bucket_width: "1d",
    limit: "31"
  });

  try {
    const data = await fetchJsonWithTimeout<AnthropicCostResponse>(
      `https://api.anthropic.com/v1/organizations/cost_report?${params}`,
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        }
      },
      getModelBalanceTimeoutMs(),
      { maxRetries: 0 }
    );

    let total = 0;
    let sawValue = false;
    let rowCount = 0;

    for (const bucket of data.data ?? []) {
      for (const result of bucket.results ?? []) {
        // Skip non-USD line items so we never mix currencies into a USD total.
        const currency = (result.currency ?? amountCurrency(result.amount) ?? "USD").toUpperCase();

        if (currency !== "USD") {
          continue;
        }

        const value = amountValue(result.amount);

        if (value !== null) {
          total += value;
          sawValue = true;
          rowCount += 1;
        }
      }
    }

    // Anthropic's cost report returns amounts in cents (e.g. 90.73 = $0.9073),
    // unlike OpenAI which reports dollars. Convert cents -> USD and round to cents.
    const usd = total / 100;

    if (readEnv("AION_DEBUG_BALANCES")) {
      console.warn(
        "[balances] Anthropic cost_report:",
        JSON.stringify({ rowCount, totalCents: total, usd, raw: data }, null, 2)
      );
    }

    return sawValue ? Math.round(usd * 100) / 100 : null;
  } catch {
    return null;
  }
}

function amountValue(amount: AnthropicCostAmount): number | null {
  const raw =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
        ? Number(amount)
        : typeof amount?.value === "number"
          ? amount.value
          : null;

  return raw !== null && Number.isFinite(raw) ? raw : null;
}

function amountCurrency(amount: AnthropicCostAmount): string | null {
  return typeof amount === "object" && amount !== null && typeof amount.currency === "string"
    ? amount.currency
    : null;
}

async function getOpenAICycleCostUsd() {
  const apiKey = readEnv("OPENAI_ADMIN_API_KEY");

  if (!apiKey) {
    return null;
  }

  const startTime = Math.floor(getCycleStartDate().getTime() / 1000);
  const params = new URLSearchParams({
    start_time: String(startTime),
    bucket_width: "1d",
    limit: "31"
  });

  try {
    const data = await fetchJsonWithTimeout<OpenAICostsResponse>(
      `https://api.openai.com/v1/organization/costs?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      },
      getModelBalanceTimeoutMs(),
      { maxRetries: 0 }
    );

    const total = (data.data ?? []).reduce((runningTotal, bucket) => {
      return (
        runningTotal +
        (bucket.results ?? []).reduce((bucketTotal, result) => {
          const amount = result.amount;

          if (amount?.currency && amount.currency.toLowerCase() !== "usd") {
            return bucketTotal;
          }

          return bucketTotal + (toMoneyNumber(amount?.value) ?? 0);
        }, 0)
      );
    }, 0);

    if (readEnv("AION_DEBUG_BALANCES")) {
      console.warn("[balances] OpenAI costs total:", total);
    }

    return Math.round(total * 100) / 100;
  } catch {
    return null;
  }
}

/** Coerce a money amount that may arrive as a number or a decimal string. */
function toMoneyNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function fromModelIds(provider: AionRoutingProvider, values: Array<string | undefined>): ProviderCatalog {
  return {
    status: "available",
    source: PROVIDER_MODEL_ENDPOINTS[provider],
    modelIds: new Set(values.filter(Boolean) as string[]),
    modelDetails: new Map()
  };
}

function missingKeyCatalog(provider: AionRoutingProvider, envName: string): ProviderCatalog {
  return {
    status: "missing-key",
    source: PROVIDER_MODEL_ENDPOINTS[provider],
    modelIds: new Set(),
    modelDetails: new Map(),
    message: `Missing ${envName}`
  };
}

function apiErrorCatalog(provider: AionRoutingProvider, error: unknown): ProviderCatalog {
  return {
    status: "api-error",
    source: PROVIDER_MODEL_ENDPOINTS[provider],
    modelIds: new Set(),
    modelDetails: new Map(),
    message: truncate(error instanceof Error ? error.message : "API request failed", 180)
  };
}

function getUnsupportedCatalog(provider: AionRoutingProvider): ProviderCatalog {
  return {
    status: "not-supported",
    source: PROVIDER_MODEL_ENDPOINTS[provider],
    modelIds: new Set(),
    modelDetails: new Map(),
    message: "Provider model balance is not supported yet."
  };
}

function getLiveStatus(model: string, catalog: ProviderCatalog): ProviderModelBalanceRow["liveStatus"] {
  if (catalog.status !== "available") {
    return catalog.status;
  }

  return catalog.modelIds.has(model) ? "available" : "not-found";
}

function getModelDetails(model: string, catalog: ProviderCatalog): ProviderModelDetails {
  return catalog.modelDetails.get(model) ?? {};
}

function getModelPrice(provider: AionRoutingProvider, model: string) {
  const override = getModelPriceOverride(provider, model);

  if (override) {
    return override;
  }

  return MODEL_PRICES[`${provider}:${model}`] ?? null;
}

function getModelPriceOverride(provider: AionRoutingProvider, model: string): ModelPrice | null {
  const key = `AION_PRICE_${provider}_${model}`.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const input = readNumberEnv(`${key}_INPUT_USD_PER_MTOK`);
  const output = readNumberEnv(`${key}_OUTPUT_USD_PER_MTOK`);

  if (input === null || output === null) {
    return null;
  }

  return {
    inputUsdPerMillion: input,
    outputUsdPerMillion: output,
    sourceLabel: "Environment pricing override"
  };
}

function getProviderBudgetUsd(provider: AionRoutingProvider) {
  return readNumberEnv(`${provider.toUpperCase()}_BUDGET_USD`) ?? readNumberEnv("AION_PROVIDER_BUDGET_USD");
}

function estimateTokensLeft(remainingUsd: number | null, priceUsdPerMillion: number | undefined) {
  if (remainingUsd === null || !priceUsdPerMillion || priceUsdPerMillion <= 0) {
    return null;
  }

  return Math.floor((remainingUsd / priceUsdPerMillion) * 1_000_000);
}

function getRowNote(
  provider: AionRoutingProvider,
  price: ModelPrice | null,
  budgetUsd: number | null,
  providerMessage?: string,
  options?: { hasLiveBalance?: boolean; providerDisabled?: boolean }
) {
  const notes = [
    options?.providerDisabled ? "Disabled in admin." : "",
    providerMessage,
    price ? "" : `Set AION_PRICE_${provider.toUpperCase()}_<MODEL>_INPUT_USD_PER_MTOK and OUTPUT_USD_PER_MTOK for this model.`,
    budgetUsd === null && !options?.hasLiveBalance
      ? `Set a budget for ${provider.toUpperCase()} in Admin → Providers to calculate tokens left.`
      : ""
  ].filter(Boolean);

  return notes.length > 0 ? notes.join(" ") : undefined;
}

function getLiveStatusLabel(status: ProviderModelBalanceRow["liveStatus"]) {
  switch (status) {
    case "available":
      return "Live";
    case "not-found":
      return "Not listed";
    case "missing-key":
      return "Key needed";
    case "api-error":
      return "API error";
    case "not-supported":
      return "Unsupported";
  }
}

function mergeLabels(first: string, second: string) {
  const labels = [...new Set([...first.split(" | "), second])];
  return labels.join(" | ");
}

function readEnv(key: string) {
  return process.env[key]?.trim() ?? "";
}

function readNumberEnv(key: string) {
  const value = readEnv(key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getModelBalanceTimeoutMs() {
  return getTimeoutMs(process.env.AION_MODEL_BALANCE_TIMEOUT_MS, 8000);
}

function getCycleStartDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
