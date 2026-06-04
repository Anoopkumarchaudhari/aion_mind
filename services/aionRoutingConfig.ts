import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  isAionRoutingProvider,
  type AionProviderStatus,
  type AionRouteSettings,
  type AionRouteSlot,
  type AionRoutingSettings
} from "@/types/aionRouting";

const ROUTING_CONFIG_PATH = path.join(process.cwd(), "data", "aion-routing.json");
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro";
const DEFAULT_JUDGE_MODEL = "gpt-5.5";

export async function getAionRoutingPayload() {
  return {
    settings: await loadAionRoutingSettings(),
    defaults: getDefaultAionRoutingSettings(),
    providerStatus: getAionProviderStatus()
  };
}

export async function loadAionRoutingSettings(): Promise<AionRoutingSettings> {
  try {
    const content = await readFile(ROUTING_CONFIG_PATH, "utf8");
    return normalizeRoutingSettings(JSON.parse(content));
  } catch {
    return getDefaultAionRoutingSettings();
  }
}

export async function saveAionRoutingSettings(value: unknown) {
  const settings = normalizeRoutingSettings(value);

  await mkdir(path.dirname(ROUTING_CONFIG_PATH), { recursive: true });
  await writeFile(ROUTING_CONFIG_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8");

  return settings;
}

export function getDefaultAionRoutingSettings(): AionRoutingSettings {
  return {
    aion: {
      primary: {
        id: "aion-primary",
        label: "Primary",
        provider: "gemini",
        model: readEnv("GEMINI_MODEL"),
        enabled: true,
        temperature: 0.35
      }
    },
    pro: {
      candidates: [
        {
          id: "pro-openai",
          label: "GPT candidate",
          provider: "openai",
          model: readEnv("OPENAI_MODEL"),
          enabled: true,
          temperature: 0.32
        },
        {
          id: "pro-claude",
          label: "Claude candidate",
          provider: "anthropic",
          model: readEnv("ANTHROPIC_MODEL"),
          enabled: true,
          temperature: 0.32
        }
      ],
      judge: {
        id: "pro-judge",
        label: "Judge",
        provider: "openai",
        model: readEnv("OPENAI_JUDGE_MODEL") || DEFAULT_JUDGE_MODEL,
        enabled: true,
        temperature: 0.2
      }
    },
    analyzer: {
      candidates: [
        {
          id: "analyzer-claude-opus",
          label: "Claude Opus",
          provider: "anthropic",
          model: readEnv("ANTHROPIC_OPUS_MODEL") || "claude-opus-4-8",
          enabled: true,
          temperature: 0.3
        },
        {
          id: "analyzer-deepseek",
          label: "DeepSeek V4 Pro",
          provider: "deepseek",
          model: readEnv("DEEPSEEK_MODEL") || DEFAULT_DEEPSEEK_MODEL,
          enabled: true,
          temperature: 1
        },
        {
          id: "analyzer-gpt-55",
          label: "GPT-5.5",
          provider: "openai",
          model: readEnv("OPENAI_ADVANCED_MODEL") || readEnv("OPENAI_JUDGE_MODEL") || DEFAULT_JUDGE_MODEL,
          enabled: true,
          temperature: 1
        }
      ],
      judge: {
        id: "analyzer-judge",
        label: "Judge",
        provider: "openai",
        model: readEnv("OPENAI_JUDGE_MODEL") || DEFAULT_JUDGE_MODEL,
        enabled: true,
        temperature: 0.2
      }
    }
  };
}

export function getAionProviderStatus(): AionProviderStatus[] {
  return [
    {
      id: "openai",
      label: "OpenAI",
      apiKeyConfigured: Boolean(readEnv("OPENAI_API_KEY")),
      defaultModels: [
        { label: "Base", value: readEnv("OPENAI_MODEL") },
        { label: "Advanced", value: readEnv("OPENAI_ADVANCED_MODEL") },
        { label: "Judge", value: readEnv("OPENAI_JUDGE_MODEL") || DEFAULT_JUDGE_MODEL }
      ]
    },
    {
      id: "anthropic",
      label: "Anthropic",
      apiKeyConfigured: Boolean(readEnv("ANTHROPIC_API_KEY")),
      defaultModels: [
        { label: "Claude", value: readEnv("ANTHROPIC_MODEL") },
        { label: "Opus", value: readEnv("ANTHROPIC_OPUS_MODEL") }
      ]
    },
    {
      id: "deepseek",
      label: "DeepSeek",
      apiKeyConfigured: Boolean(readEnv("DEEPSEEK_API_KEY")),
      defaultModels: [
        { label: "V4 Pro", value: readEnv("DEEPSEEK_MODEL") || DEFAULT_DEEPSEEK_MODEL },
        { label: "V4 Flash", value: "deepseek-v4-flash" }
      ]
    },
    {
      id: "gemini",
      label: "Gemini",
      apiKeyConfigured: Boolean(readEnv("GEMINI_API_KEY")),
      defaultModels: [{ label: "Primary", value: readEnv("GEMINI_MODEL") }]
    },
    {
      id: "grok",
      label: "Grok",
      apiKeyConfigured: Boolean(readEnv("GROK_API_KEY")),
      defaultModels: [{ label: "Primary", value: readEnv("GROK_MODEL") }]
    }
  ];
}

function normalizeRoutingSettings(value: unknown): AionRoutingSettings {
  const defaults = getDefaultAionRoutingSettings();
  const record = asRecord(value);

  return {
    aion: {
      primary: normalizeSlot(asRecord(asRecord(record.aion).primary), defaults.aion.primary)
    },
    pro: normalizeRoute(asRecord(record.pro), defaults.pro),
    analyzer: normalizeRoute(asRecord(record.analyzer), defaults.analyzer)
  };
}

function normalizeRoute(value: Record<string, unknown>, fallback: AionRouteSettings) {
  const sourceCandidates = Array.isArray(value.candidates) ? value.candidates : [];

  return {
    candidates: fallback.candidates.map((slot) =>
      normalizeSlot(findSlotSource(sourceCandidates, slot.id), slot)
    ),
    judge: normalizeSlot(asRecord(value.judge), fallback.judge)
  };
}

function normalizeSlot(value: Record<string, unknown>, fallback: AionRouteSlot): AionRouteSlot {
  return {
    id: fallback.id,
    label: cleanText(value.label, fallback.label, 60),
    provider: isAionRoutingProvider(value.provider) ? value.provider : fallback.provider,
    model: cleanText(value.model, fallback.model, 160),
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    temperature: cleanTemperature(value.temperature, fallback.temperature)
  };
}

function findSlotSource(values: unknown[], id: string) {
  const matched = values.find((value) => asRecord(value).id === id);
  return asRecord(matched);
}

function cleanTemperature(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(2, Math.max(0, Number(parsed.toFixed(2))));
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readEnv(key: string) {
  return process.env[key]?.trim() ?? "";
}
