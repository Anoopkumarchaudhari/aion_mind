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
const DEFAULT_MIND_MODEL = "gpt-5.4-mini";
const DEFAULT_RESEARCH_GPT_MODEL = "gpt-5.5";
const DEFAULT_JUDGE_MODEL = "gpt-5.5";
const DEFAULT_CLAUDE_OPUS_MODEL = "claude-opus-4-8";
const DEFAULT_GEMINI_RESEARCH_MODEL = "gemini-3.1";
const DEFAULT_INSTANT_MODEL = "gpt-5.4-mini";

/** Preset model options the admin can pick for Aria Instant (single fast model). */
const INSTANT_MODEL_CHOICES: Array<{ label: string; value: string }> = [
  { label: "GPT-5.4 mini (fast)", value: "gpt-5.4-mini" },
  { label: "GPT-5.4 nano (fastest)", value: "gpt-5.4-nano" },
  { label: "GPT-5.4", value: "gpt-5.4" },
  { label: "GPT-5.5 (flagship)", value: "gpt-5.5" },
  { label: "GPT-5 mini", value: "gpt-5-mini" },
  { label: "GPT-4o mini", value: "gpt-4o-mini" },
  { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" }
];

export async function getAionRoutingPayload() {
  return {
    settings: await loadAionRoutingSettings(),
    defaults: getDefaultAionRoutingSettings(),
    providerStatus: getAionProviderStatus(),
    instantModelChoices: INSTANT_MODEL_CHOICES
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
        label: "Aria Instant",
        provider: "openai",
        model: readEnv("OPENAI_INSTANT_MODEL") || DEFAULT_INSTANT_MODEL,
        enabled: true,
        temperature: 0.35
      }
    },
    diverse: [
      {
        id: "diverse-openai",
        label: "ChatGPT",
        provider: "openai",
        model: readEnv("OPENAI_ADVANCED_MODEL") || DEFAULT_RESEARCH_GPT_MODEL,
        enabled: true,
        temperature: 0.4
      },
      {
        id: "diverse-anthropic",
        label: "Claude",
        provider: "anthropic",
        model: readEnv("ANTHROPIC_OPUS_MODEL") || DEFAULT_CLAUDE_OPUS_MODEL,
        enabled: true,
        temperature: 0.4
      },
      {
        id: "diverse-deepseek",
        label: "DeepSeek",
        provider: "deepseek",
        model: readEnv("DEEPSEEK_MODEL") || DEFAULT_DEEPSEEK_MODEL,
        enabled: true,
        temperature: 0.6
      },
      {
        id: "diverse-gemini",
        label: "Gemini",
        provider: "gemini",
        model: readEnv("GEMINI_RESEARCH_MODEL") || readEnv("GEMINI_MODEL") || DEFAULT_GEMINI_RESEARCH_MODEL,
        enabled: true,
        temperature: 0.4
      }
    ],
    pro: {
      candidates: [
        {
          id: "research-gpt-55",
          label: "GPT-5.5",
          provider: "openai",
          model: DEFAULT_RESEARCH_GPT_MODEL,
          enabled: true,
          temperature: 0.3
        },
        {
          id: "research-opus-48",
          label: "Opus-4.8",
          provider: "anthropic",
          model: DEFAULT_CLAUDE_OPUS_MODEL,
          enabled: true,
          temperature: 0.3
        },
        {
          id: "research-deepseek",
          label: "DeepSeek",
          provider: "deepseek",
          model: readEnv("DEEPSEEK_MODEL") || DEFAULT_DEEPSEEK_MODEL,
          enabled: true,
          temperature: 0.7
        },
        {
          id: "research-gemini-31",
          label: "Gemini-3.1",
          provider: "gemini",
          model: readEnv("GEMINI_RESEARCH_MODEL") || readEnv("GEMINI_MODEL") || DEFAULT_GEMINI_RESEARCH_MODEL,
          enabled: true,
          temperature: 0.35
        }
      ],
      judge: {
        id: "research-judge",
        label: "GPT-5.5 Judge",
        provider: "openai",
        model: DEFAULT_JUDGE_MODEL,
        enabled: true,
        temperature: 0.2
      }
    },
    analyzer: {
      candidates: [
        {
          id: "analyzer-gpt-55",
          label: "GPT-5.5",
          provider: "openai",
          model: readEnv("OPENAI_ADVANCED_MODEL") || readEnv("OPENAI_JUDGE_MODEL") || DEFAULT_RESEARCH_GPT_MODEL,
          enabled: true,
          temperature: 0.7
        },
        {
          id: "analyzer-claude-opus",
          label: "Opus-4.8",
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
          temperature: 0.7
        },
        {
          id: "analyzer-gemini-31",
          label: "Gemini-3.1",
          provider: "gemini",
          model: readEnv("GEMINI_RESEARCH_MODEL") || readEnv("GEMINI_MODEL") || DEFAULT_GEMINI_RESEARCH_MODEL,
          enabled: true,
          temperature: 0.7
        }
      ],
      judge: {
        id: "analyzer-judge",
        label: "Aria Analyzer Judge",
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
        { label: "GPT-5.4 mini instant", value: DEFAULT_MIND_MODEL },
        { label: "GPT-5.5", value: DEFAULT_RESEARCH_GPT_MODEL },
        { label: "Base", value: readEnv("OPENAI_MODEL") },
        { label: "Advanced", value: readEnv("OPENAI_ADVANCED_MODEL") },
        { label: "Judge", value: readEnv("OPENAI_JUDGE_MODEL") || DEFAULT_JUDGE_MODEL },
        {
          label: "Live Search",
          value: readEnv("OPENAI_LIVE_MODEL") || readEnv("OPENAI_JUDGE_MODEL") || DEFAULT_JUDGE_MODEL
        }
      ]
    },
    {
      id: "anthropic",
      label: "Anthropic",
      apiKeyConfigured: Boolean(readEnv("ANTHROPIC_API_KEY")),
      defaultModels: [
        { label: "Claude", value: readEnv("ANTHROPIC_MODEL") },
        { label: "Opus 4.8", value: DEFAULT_CLAUDE_OPUS_MODEL },
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
      defaultModels: [
        { label: "Gemini-3.1", value: readEnv("GEMINI_RESEARCH_MODEL") || DEFAULT_GEMINI_RESEARCH_MODEL },
        { label: "Primary", value: readEnv("GEMINI_MODEL") }
      ]
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
  const proRecord = asRecord(record.pro);
  const proCandidateSources = Array.isArray(proRecord.candidates) ? proRecord.candidates : [];
  const diverseSources = Array.isArray(record.diverse) ? record.diverse : [];

  return {
    aion: {
      primary: normalizeFixedProviderSlot(
        asRecord(asRecord(record.aion).primary),
        defaults.aion.primary
      )
    },
    // provider + id stay fixed per slot; the admin controls the model name.
    diverse: defaults.diverse.map((slot) =>
      normalizeFixedProviderSlot(findSlotSource(diverseSources, slot.id), slot)
    ),
    pro: {
      candidates: defaults.pro.candidates.map((slot) =>
        normalizeFixedProviderSlot(findSlotSourceWithLegacy(proCandidateSources, slot.id), slot)
      ),
      judge: normalizeFixedProviderSlot(asRecord(proRecord.judge), defaults.pro.judge)
    },
    analyzer: normalizeRoute(asRecord(record.analyzer), defaults.analyzer)
  };
}

const LEGACY_SLOT_IDS: Record<string, string[]> = {
  "research-gpt-55": ["pro-openai"],
  "research-opus-48": ["pro-claude", "pro-claude-opus"]
};

function findSlotSourceWithLegacy(values: unknown[], id: string) {
  const matched =
    values.find((value) => asRecord(value).id === id) ??
    values.find((value) => LEGACY_SLOT_IDS[id]?.includes(String(asRecord(value).id ?? "")));

  return asRecord(matched);
}

/** Keeps the slot id + provider fixed (admin edits model/label/temperature/enabled). */
function normalizeFixedProviderSlot(value: Record<string, unknown>, fixed: AionRouteSlot): AionRouteSlot {
  return {
    id: fixed.id,
    label: cleanText(value.label, fixed.label, 60),
    provider: fixed.provider,
    model: cleanText(value.model, fixed.model, 160),
    enabled: typeof value.enabled === "boolean" ? value.enabled : fixed.enabled,
    temperature: cleanTemperature(value.temperature, fixed.temperature)
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
