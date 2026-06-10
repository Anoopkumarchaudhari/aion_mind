import type {
  AionModelId,
  AionResearchModelId,
  ChatAttachment,
  ChatMessage,
  DebugDiagnostic
} from "@/types/aion";

export type ProviderName =
  | "openai"
  | "openai-live"
  | "openai-advanced"
  | "anthropic"
  | "anthropic-opus"
  | "deepseek"
  | "gemini"
  | "grok"
  | "aion-judge";

export type ProviderCallOptions = {
  messages: ChatMessage[];
  attachments?: ChatAttachment[];
  systemPrompt?: string;
  model?: string;
  timeoutMs?: number;
  temperature?: number;
  providerName?: ProviderName;
};

export type ProviderResponse = {
  provider: ProviderName;
  model?: string;
  ok: boolean;
  content?: string;
  error?: string;
  skipped?: boolean;
  latencyMs: number;
};

export type ProviderStreamResponse = {
  provider: ProviderName;
  model?: string;
  ok: boolean;
  stream?: AsyncIterable<string>;
  error?: string;
  skipped?: boolean;
  latencyMs: number;
};

export type ModelRouteRequest = {
  message: string;
  selectedModel: AionModelId;
  researchModel?: AionResearchModelId;
  history: ChatMessage[];
  attachments?: ChatAttachment[];
  debug: boolean;
};

export type ModelRouteResult = {
  answer: string;
  selectedModel: AionModelId;
  diagnostics?: DebugDiagnostic[];
};
