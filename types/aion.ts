export const AION_MODELS = [
  "aion-mind",
  "aion-mind-pro",
  "aion-mind-analyzer"
] as const;

export type AionModelId = (typeof AION_MODELS)[number];

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

export type ChatApiResponse = {
  answer: string;
  selectedModel: AionModelId;
  diagnostics?: DebugDiagnostic[];
};

export function getAionModelLabel(model: AionModelId) {
  switch (model) {
    case "aion-mind":
      return "Arya Mind";
    case "aion-mind-pro":
      return "Arya Mind Pro";
    case "aion-mind-analyzer":
      return "Arya Mind Analyzer";
  }
}

export function isAionModelId(value: unknown): value is AionModelId {
  return typeof value === "string" && AION_MODELS.includes(value as AionModelId);
}
