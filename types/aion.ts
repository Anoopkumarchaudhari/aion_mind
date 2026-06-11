export const AION_MODELS = [
  "aion-mind",
  "aion-mind-pro",
  "aion-mind-analyzer"
] as const;

export type AionModelId = (typeof AION_MODELS)[number];

export const AION_RESEARCH_MODELS = [
  "gpt-5.5",
  "opus-4.8",
  "deepseek",
  "gemini-3.1"
] as const;

export type AionResearchModelId = (typeof AION_RESEARCH_MODELS)[number];

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type AttachmentKind = "text" | "image" | "file";

export type MessageAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  kind?: AttachmentKind;
  mimeType?: string;
  previewData?: string;
  previewWidth?: number;
  previewHeight?: number;
};

export type ChatAttachment = MessageAttachment & {
  content: string;
  data?: string;
};

export type DebugDiagnostic = {
  provider: string;
  model?: string;
  ok: boolean;
  skipped?: boolean;
  latencyMs: number;
  error?: string;
};

export type WebSearchSource = {
  title: string;
  url: string;
};

export type WebSearchActivity = {
  status: "searching" | "found";
  query: string;
  sources?: WebSearchSource[];
};

export type WorkLogItem = {
  id: string;
  label: string;
  detail?: string;
  status: "active" | "done" | "error";
};

export type ChatApiResponse = {
  answer: string;
  selectedModel: AionModelId;
  diagnostics?: DebugDiagnostic[];
};

export function getAionModelLabel(model: AionModelId) {
  switch (model) {
    case "aion-mind":
      return "Aria Mind";
    case "aion-mind-pro":
      return "Aria Research";
    case "aion-mind-analyzer":
      return "Aria Analyzer";
  }
}

export function isAionModelId(value: unknown): value is AionModelId {
  return typeof value === "string" && AION_MODELS.includes(value as AionModelId);
}

export function getAionResearchModelLabel(model: AionResearchModelId) {
  switch (model) {
    case "gpt-5.5":
      return "GPT-5.5";
    case "opus-4.8":
      return "Opus-4.8";
    case "deepseek":
      return "DeepSeek";
    case "gemini-3.1":
      return "Gemini-3.1";
  }
}

export function isAionResearchModelId(value: unknown): value is AionResearchModelId {
  return (
    typeof value === "string" &&
    AION_RESEARCH_MODELS.includes(value as AionResearchModelId)
  );
}
