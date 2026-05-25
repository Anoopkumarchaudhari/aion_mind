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

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicContentBlock =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: string;
        data: string;
      };
    };

type AnthropicStreamEvent = {
  type?: string;
  delta?: {
    type?: string;
    text?: string;
  };
};

export async function callClaude(options: ProviderCallOptions = { messages: [] }): Promise<ProviderResponse> {
  const provider = options.providerName ?? "anthropic";
  const startedAt = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const model =
    options.model ??
    (provider === "anthropic-opus" ? process.env.ANTHROPIC_OPUS_MODEL : process.env.ANTHROPIC_MODEL) ??
    "";
  const missing = [
    !apiKey ? "ANTHROPIC_API_KEY" : "",
    !model ? (provider === "anthropic-opus" ? "ANTHROPIC_OPUS_MODEL" : "ANTHROPIC_MODEL") : ""
  ].filter(Boolean);

  if (missing.length > 0) {
    return missingProviderConfig(provider, missing, startedAt, model);
  }

  const timeoutMs =
    options.timeoutMs ?? getTimeoutMs(process.env.AION_PROVIDER_TIMEOUT_MS, 25000);

  try {
    const data = await fetchJsonWithTimeout<AnthropicResponse>(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: options.temperature ?? 0.35,
          system: options.systemPrompt,
          messages: toAnthropicMessages(options.messages, options.attachments)
        })
      },
      timeoutMs
    );

    const content = compactContent(
      data.content
        ?.filter((part) => part.type === "text" || part.text)
        .map((part) => part.text ?? "")
        .join("")
    );

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

export async function streamClaude(
  options: ProviderCallOptions = { messages: [] }
): Promise<ProviderStreamResponse> {
  const provider = options.providerName ?? "anthropic";
  const startedAt = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const model =
    options.model ??
    (provider === "anthropic-opus" ? process.env.ANTHROPIC_OPUS_MODEL : process.env.ANTHROPIC_MODEL) ??
    "";
  const missing = [
    !apiKey ? "ANTHROPIC_API_KEY" : "",
    !model ? (provider === "anthropic-opus" ? "ANTHROPIC_OPUS_MODEL" : "ANTHROPIC_MODEL") : ""
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      ...missingProviderConfig(provider, missing, startedAt, model),
      stream: undefined
    };
  }

  const timeoutMs =
    options.timeoutMs ?? getTimeoutMs(process.env.AION_PROVIDER_TIMEOUT_MS, 25000);

  try {
    const response = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: options.temperature ?? 0.35,
          system: options.systemPrompt,
          messages: toAnthropicMessages(options.messages, options.attachments),
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
      stream: readAnthropicSse(response.body),
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return providerFailure(provider, error, startedAt, model);
  }
}

function toAnthropicMessages(messages: ChatMessage[], attachments: ChatAttachment[] = []): AnthropicMessage[] {
  const formatted: AnthropicMessage[] = [];
  const lastUserIndex = findLastUserMessageIndex(messages);
  const imageBlocks = toAnthropicImageBlocks(attachments);

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const previous = formatted[formatted.length - 1];
    const content =
      message.role === "user" && index === lastUserIndex && imageBlocks.length > 0
        ? ([{ type: "text", text: message.content }, ...imageBlocks] satisfies AnthropicContentBlock[])
        : message.content;

    if (previous?.role === message.role) {
      previous.content = mergeAnthropicContent(previous.content, content);
    } else {
      formatted.push({
        role: message.role,
        content
      });
    }
  }

  if (formatted[0]?.role === "assistant") {
    formatted.unshift({
      role: "user",
      content: "Continue the conversation using the latest user request."
    });
  }

  return formatted.length > 0
    ? formatted
    : [{ role: "user", content: "Respond when the user provides a request." }];
}

function mergeAnthropicContent(
  previous: AnthropicMessage["content"],
  next: AnthropicMessage["content"]
): AnthropicMessage["content"] {
  if (typeof previous === "string" && typeof next === "string") {
    return `${previous}\n\n${next}`;
  }

  const previousBlocks =
    typeof previous === "string" ? [{ type: "text", text: previous } satisfies AnthropicContentBlock] : previous;
  const nextBlocks =
    typeof next === "string" ? [{ type: "text", text: next } satisfies AnthropicContentBlock] : next;

  return [...previousBlocks, ...nextBlocks];
}

function findLastUserMessageIndex(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return index;
    }
  }

  return -1;
}

function toAnthropicImageBlocks(attachments: ChatAttachment[]): AnthropicContentBlock[] {
  return attachments
    .filter(
      (attachment) =>
        attachment.kind === "image" &&
        Boolean(attachment.data) &&
        Boolean(attachment.mimeType || attachment.type)
    )
    .map((attachment) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: attachment.mimeType || attachment.type,
        data: attachment.data as string
      }
    }));
}

async function* readAnthropicSse(body: ReadableStream<Uint8Array>) {
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
          yield* parseAnthropicEventData(eventData);
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

    yield* parseAnthropicEventData(eventData);
  } finally {
    reader.releaseLock();
  }
}

function* parseAnthropicEventData(eventData: string) {
  const data = eventData.trim();

  if (!data || data === "[DONE]") {
    return;
  }

  try {
    const parsed = JSON.parse(data) as AnthropicStreamEvent;
    const text = parsed.type === "content_block_delta" ? parsed.delta?.text : undefined;

    if (text) {
      yield text;
    }
  } catch {
    return;
  }
}
