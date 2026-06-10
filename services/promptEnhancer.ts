import { getTimeoutMs, truncate } from "@/providers/providerUtils";
import { callConfiguredModel } from "@/services/aionModelCalls";
import { loadAionRoutingSettings } from "@/services/aionRoutingConfig";
import {
  getAionModelLabel,
  getAionResearchModelLabel,
  type AionModelId,
  type AionResearchModelId
} from "@/types/aion";

const MAX_ENHANCED_PROMPT_LENGTH = 9000;

const PROMPT_ENHANCER_SYSTEM_PROMPT = [
  "You are Aria Prompt Enhancer. Rewrite the user's rough draft into a clearer, stronger prompt.",
  "Do not answer the prompt. Do not invent facts, names, files, requirements, or constraints.",
  "Preserve the user's intent, language, tone, important wording, numbers, and named entities.",
  "If the draft is already good, improve it lightly.",
  "Return only the enhanced prompt text. Do not add labels, quotes, markdown fences, or commentary."
].join(" ");

export type PromptEnhanceAttachment = {
  name: string;
  type: string;
  size: number;
  kind?: "image" | "text" | "file";
};

export type PromptEnhanceInput = {
  prompt: string;
  selectedModel: AionModelId;
  researchModel?: AionResearchModelId;
  attachments?: PromptEnhanceAttachment[];
};

export async function enhancePrompt({
  prompt,
  selectedModel,
  researchModel,
  attachments = []
}: PromptEnhanceInput) {
  const routing = await loadAionRoutingSettings();
  const response = await callConfiguredModel(
    {
      ...routing.aion.primary,
      temperature: Math.min(routing.aion.primary.temperature, 0.25)
    },
    {
      messages: [
        {
          role: "user",
          content: buildEnhancementRequest(prompt, selectedModel, researchModel, attachments)
        }
      ],
      systemPrompt: PROMPT_ENHANCER_SYSTEM_PROMPT,
      timeoutMs: getTimeoutMs(process.env.AION_PROMPT_ENHANCE_TIMEOUT_MS, 12000)
    }
  );

  if (!response.ok || !response.content) {
    if (response.skipped) {
      throw new Error(
        "Prompt enhancer is not configured yet. Enable the Aria Mind primary route and add the required server-side API key."
      );
    }

    throw new Error(
      response.error
        ? `Prompt enhancer failed: ${truncate(response.error, 180)}`
        : "Prompt enhancer could not return a response."
    );
  }

  return normalizeEnhancedPrompt(response.content, prompt);
}

function buildEnhancementRequest(
  prompt: string,
  selectedModel: AionModelId,
  researchModel: AionResearchModelId | undefined,
  attachments: PromptEnhanceAttachment[]
) {
  return [
    `Current Aria mode: ${getModeLabel(selectedModel, researchModel)}`,
    "",
    "Mode-specific rewrite guidance:",
    getModeGuidance(selectedModel),
    "",
    "Attachment context:",
    buildAttachmentContext(attachments),
    "",
    "Draft prompt:",
    truncate(prompt, 6000),
    "",
    "Rewrite this draft into one polished prompt the user can review and send."
  ].join("\n");
}

function getModeLabel(selectedModel: AionModelId, researchModel: AionResearchModelId | undefined) {
  if (selectedModel === "aion-mind-pro" && researchModel) {
    return `${getAionModelLabel(selectedModel)} using ${getAionResearchModelLabel(researchModel)}`;
  }

  return getAionModelLabel(selectedModel);
}

function getModeGuidance(selectedModel: AionModelId) {
  switch (selectedModel) {
    case "aion-mind-pro":
      return "Make it a focused research brief with objective, scope, timeframe if implied, source expectations, comparison points, and preferred output format.";
    case "aion-mind-analyzer":
      return "Make it evaluation-ready with clear criteria, constraints, assumptions to test, edge cases, and a final synthesis format.";
    case "aion-mind":
      return "Make it concise, specific, and easy to answer in one fast response. Add useful context and output format only when it helps.";
  }
}

function buildAttachmentContext(attachments: PromptEnhanceAttachment[]) {
  if (attachments.length === 0) {
    return "No attachments.";
  }

  return attachments
    .slice(0, 5)
    .map((attachment, index) => {
      const kind = attachment.kind ?? "file";
      return `${index + 1}. ${truncate(attachment.name, 120)} (${kind}, ${truncate(
        attachment.type,
        80
      )}, ${formatBytes(attachment.size)})`;
    })
    .join("\n");
}

function normalizeEnhancedPrompt(content: string, fallback: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*(?:enhanced prompt|rewritten prompt|prompt)\s*:\s*/i, "")
    .trim();

  return (cleaned || fallback.trim()).slice(0, MAX_ENHANCED_PROMPT_LENGTH);
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
