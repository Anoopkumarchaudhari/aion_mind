export const AION_ROUTING_PROVIDERS = [
  "openai",
  "anthropic",
  "deepseek",
  "gemini",
  "grok"
] as const;

export type AionRoutingProvider = (typeof AION_ROUTING_PROVIDERS)[number];

export type AionRouteSlot = {
  id: string;
  label: string;
  provider: AionRoutingProvider;
  model: string;
  enabled: boolean;
  temperature: number;
};

export type AionRouteSettings = {
  candidates: AionRouteSlot[];
  judge: AionRouteSlot;
};

export type AionRoutingSettings = {
  aion: {
    primary: AionRouteSlot;
  };
  /** Aria Diverse: one configurable model per provider the user can pick. */
  diverse: AionRouteSlot[];
  pro: AionRouteSettings;
  analyzer: AionRouteSettings;
};

export type AionProviderStatus = {
  id: AionRoutingProvider;
  label: string;
  apiKeyConfigured: boolean;
  defaultModels: Array<{
    label: string;
    value: string;
  }>;
};

export type AionRoutingPayload = {
  settings: AionRoutingSettings;
  defaults: AionRoutingSettings;
  providerStatus: AionProviderStatus[];
  /** Preset model options the admin can assign to Aria Instant. */
  instantModelChoices: Array<{ label: string; value: string }>;
};

export function getAionRoutingProviderLabel(provider: AionRoutingProvider) {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "deepseek":
      return "DeepSeek";
    case "gemini":
      return "Gemini";
    case "grok":
      return "Grok";
  }
}

export function isAionRoutingProvider(value: unknown): value is AionRoutingProvider {
  return (
    typeof value === "string" &&
    AION_ROUTING_PROVIDERS.includes(value as AionRoutingProvider)
  );
}
