import type { ChatAttachment, ChatMessage } from "@/types/aion";
import type { ProviderCallOptions, ProviderName, ProviderResponse } from "@/services/types";
import {
  compactContent,
  fetchJsonWithTimeout,
  getTimeoutMs,
  missingProviderConfig,
  providerFailure
} from "@/providers/providerUtils";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenAIContentPart[];
};

type OpenAIContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
        detail: "auto";
      };
    };

export async function callOpenAI(
  options: ProviderCallOptions,
  variant: "base" | "advanced" = "base"
): Promise<ProviderResponse> {
  const provider: ProviderName = variant === "advanced" ? "openai-advanced" : "openai";
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model =
    options.model ??
    (variant === "advanced" ? process.env.OPENAI_ADVANCED_MODEL : process.env.OPENAI_MODEL) ??
    "";
  const missing = [
    !apiKey ? "OPENAI_API_KEY" : "",
    !model ? (variant === "advanced" ? "OPENAI_ADVANCED_MODEL" : "OPENAI_MODEL") : ""
  ].filter(Boolean);

  if (missing.length > 0) {
    return missingProviderConfig(provider, missing, startedAt, model);
  }

  const messages = toOpenAIMessages(options.messages, options.systemPrompt, options.attachments);
  const timeoutMs =
    options.timeoutMs ?? getTimeoutMs(process.env.AION_PROVIDER_TIMEOUT_MS, 25000);

  try {
    const data = await fetchJsonWithTimeout<OpenAIChatResponse>(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.4
        })
      },
      timeoutMs
    );

    const content = compactContent(data.choices?.[0]?.message?.content);

    if (!content) {
      throw new Error("Empty response");
    }

    return {
      provider,
      model,
      ok: true,
      content,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return providerFailure(provider, error, startedAt, model);
  }
}

function toOpenAIMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
  attachments: ChatAttachment[] = []
): OpenAIMessage[] {
  const formatted: OpenAIMessage[] = [];
  const lastUserIndex = findLastUserMessageIndex(messages);
  const imageParts = toOpenAIImageParts(attachments);

  if (systemPrompt) {
    formatted.push({ role: "system", content: systemPrompt });
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    formatted.push({
      role: message.role,
      content:
        message.role === "user" && index === lastUserIndex && imageParts.length > 0
          ? [{ type: "text", text: message.content }, ...imageParts]
          : message.content
    });
  }

  return formatted;
}

function findLastUserMessageIndex(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return index;
    }
  }

  return -1;
}

function toOpenAIImageParts(attachments: ChatAttachment[]): OpenAIContentPart[] {
  return attachments
    .filter(
      (attachment) =>
        attachment.kind === "image" &&
        Boolean(attachment.data) &&
        Boolean(attachment.mimeType || attachment.type)
    )
    .map((attachment) => ({
      type: "image_url",
      image_url: {
        url: `data:${attachment.mimeType || attachment.type};base64,${attachment.data}`,
        detail: "auto"
      }
    }));
}
