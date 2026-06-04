import type { ChatAttachment, ChatMessage } from "@/types/aion";
import type { ProviderCallOptions, ProviderResponse } from "@/services/types";
import {
  compactContent,
  fetchJsonWithTimeout,
  getTimeoutMs,
  missingProviderConfig,
  providerFailure
} from "@/providers/providerUtils";

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro";

export async function callDeepSeek(options: ProviderCallOptions): Promise<ProviderResponse> {
  const provider = "deepseek";
  const startedAt = Date.now();
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_MODEL;
  const missing = [
    !apiKey ? "DEEPSEEK_API_KEY" : "",
    !model ? "DEEPSEEK_MODEL" : ""
  ].filter(Boolean);

  if (missing.length > 0) {
    return missingProviderConfig(provider, missing, startedAt, model);
  }

  const timeoutMs =
    options.timeoutMs ?? getTimeoutMs(process.env.AION_PROVIDER_TIMEOUT_MS, 25000);

  try {
    const data = await fetchJsonWithTimeout<DeepSeekResponse>(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: toDeepSeekMessages(options.messages, options.systemPrompt, options.attachments),
          temperature: options.temperature ?? 1
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

function toDeepSeekMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
  attachments: ChatAttachment[] = []
): DeepSeekMessage[] {
  const formatted: DeepSeekMessage[] = [];

  if (systemPrompt) {
    formatted.push({ role: "system", content: systemPrompt });
  }

  for (const message of messages) {
    formatted.push({
      role: message.role,
      content: message.content
    });
  }

  if (attachments.length > 0) {
    formatted.push({
      role: "user",
      content: attachments
        .map((attachment, index) =>
          [
            `Attachment ${index + 1}: ${attachment.name}`,
            `Type: ${attachment.type}`,
            attachment.content
          ].join("\n")
        )
        .join("\n\n---\n\n")
    });
  }

  return formatted;
}
