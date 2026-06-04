import type { ChatAttachment, ChatMessage } from "@/types/aion";
import type {
  ProviderCallOptions,
  ProviderName,
  ProviderResponse,
  ProviderStreamResponse
} from "@/services/types";
import {
  compactContent,
  fetchWithTimeout,
  fetchJsonWithTimeout,
  getTimeoutMs,
  missingProviderConfig,
  providerFailure,
  truncate
} from "@/providers/providerUtils";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type OpenAIChatStreamEvent = {
  choices?: Array<{
    delta?: {
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

type OpenAIVariant = "base" | "advanced" | "judge";

type OpenAIConfig = {
  provider: ProviderName;
  model: string;
  modelEnvName: string;
};

const DEFAULT_OPENAI_JUDGE_MODEL = "gpt-5.5";

export async function callOpenAI(
  options: ProviderCallOptions,
  variant: OpenAIVariant = "base"
): Promise<ProviderResponse> {
  const { provider, model, modelEnvName } = getOpenAIConfig(options, variant);
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const missing = [
    !apiKey ? "OPENAI_API_KEY" : "",
    !model ? modelEnvName : ""
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
          ...getOpenAITemperaturePayload(model, options.temperature ?? 0.4)
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

export async function streamOpenAI(
  options: ProviderCallOptions,
  variant: OpenAIVariant = "base"
): Promise<ProviderStreamResponse> {
  const { provider, model, modelEnvName } = getOpenAIConfig(options, variant);
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const missing = [
    !apiKey ? "OPENAI_API_KEY" : "",
    !model ? modelEnvName : ""
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      ...missingProviderConfig(provider, missing, startedAt, model),
      stream: undefined
    };
  }

  const messages = toOpenAIMessages(options.messages, options.systemPrompt, options.attachments);
  const timeoutMs =
    options.timeoutMs ?? getTimeoutMs(process.env.AION_PROVIDER_TIMEOUT_MS, 25000);

  try {
    const response = await fetchWithTimeout(
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
          ...getOpenAITemperaturePayload(model, options.temperature ?? 0.4),
          stream: true
        })
      },
      timeoutMs
    );

    if (!response.ok || !response.body) {
      const text = await response.text();

      return {
        provider,
        model,
        ok: false,
        error: `HTTP ${response.status}: ${truncate(text, 220)}`,
        latencyMs: Date.now() - startedAt
      };
    }

    return {
      provider,
      model,
      ok: true,
      stream: readOpenAIChatSse(response.body),
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return providerFailure(provider, error, startedAt, model);
  }
}

function getOpenAIConfig(options: ProviderCallOptions, variant: OpenAIVariant): OpenAIConfig {
  if (variant === "advanced") {
    return {
      provider: "openai-advanced",
      model: options.model ?? process.env.OPENAI_ADVANCED_MODEL ?? "",
      modelEnvName: "OPENAI_ADVANCED_MODEL"
    };
  }

  if (variant === "judge") {
    return {
      provider: "aion-judge",
      model: options.model ?? (process.env.OPENAI_JUDGE_MODEL || DEFAULT_OPENAI_JUDGE_MODEL),
      modelEnvName: "OPENAI_JUDGE_MODEL"
    };
  }

  return {
    provider: "openai",
    model: options.model ?? process.env.OPENAI_MODEL ?? "",
    modelEnvName: "OPENAI_MODEL"
  };
}

function getOpenAITemperaturePayload(model: string, temperature: number) {
  if (model.trim().toLowerCase().startsWith("gpt-5.5")) {
    return {};
  }

  return { temperature };
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

async function* readOpenAIChatSse(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventData = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          yield* parseOpenAIEventData(eventData);
          eventData = "";
          continue;
        }

        if (line.startsWith("data:")) {
          eventData += line.slice(5).trim();
        }
      }
    }

    buffer += decoder.decode();

    if (buffer.startsWith("data:")) {
      eventData += buffer.slice(5).trim();
    }

    yield* parseOpenAIEventData(eventData);
  } finally {
    reader.releaseLock();
  }
}

function* parseOpenAIEventData(eventData: string) {
  const data = eventData.trim();

  if (!data || data === "[DONE]") {
    return;
  }

  try {
    const parsed = JSON.parse(data) as OpenAIChatStreamEvent;
    const text = parsed.choices?.map((choice) => choice.delta?.content ?? "").join("");

    if (text) {
      yield text;
    }
  } catch {
    return;
  }
}
