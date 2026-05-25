import type { ChatAttachment, ChatMessage } from "@/types/aion";
import type { ProviderCallOptions, ProviderResponse, ProviderStreamResponse } from "@/services/types";
import {
  compactContent,
  fetchWithTimeout,
  fetchJsonWithTimeout,
  getTimeoutMs,
  missingProviderConfig,
  ProviderHttpError,
  providerFailure,
  truncate
} from "@/providers/providerUtils";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type GeminiPart =
  | {
      text: string;
    }
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiStreamChunk = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export async function callGemini(options: ProviderCallOptions): Promise<ProviderResponse> {
  const provider = "gemini";
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const models = getGeminiModelCandidates(options.model);
  const missing = [
    !apiKey ? "GEMINI_API_KEY" : "",
    models.length === 0 ? "GEMINI_MODEL" : ""
  ].filter(Boolean);

  if (missing.length > 0) {
    return missingProviderConfig(provider, missing, startedAt, models[0]);
  }

  const timeoutMs =
    options.timeoutMs ?? getTimeoutMs(process.env.AION_PROVIDER_TIMEOUT_MS, 25000);
  const failures: string[] = [];

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      const data = await fetchJsonWithTimeout<GeminiResponse>(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: options.systemPrompt
              ? {
                  parts: [{ text: options.systemPrompt }]
                }
              : undefined,
            generationConfig: {
              temperature: options.temperature ?? 0.35
            },
            contents: toGeminiContents(options.messages, options.attachments)
          })
        },
        timeoutMs
      );

      const content = compactContent(
        data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("")
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
      failures.push(`${model}: ${getFailureMessage(error)}`);
    }
  }

  return providerFailure(provider, new Error(failures.join(" | ")), startedAt, models[0]);
}

export async function streamGemini(options: ProviderCallOptions): Promise<ProviderStreamResponse> {
  const provider = "gemini";
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const models = getGeminiModelCandidates(options.model);
  const missing = [
    !apiKey ? "GEMINI_API_KEY" : "",
    models.length === 0 ? "GEMINI_MODEL" : ""
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      ...missingProviderConfig(provider, missing, startedAt, models[0]),
      stream: undefined
    };
  }

  const timeoutMs =
    options.timeoutMs ?? getTimeoutMs(process.env.AION_PROVIDER_TIMEOUT_MS, 25000);
  const failures: string[] = [];

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: options.systemPrompt
              ? {
                  parts: [{ text: options.systemPrompt }]
                }
              : undefined,
            generationConfig: {
              temperature: options.temperature ?? 0.35
            },
            contents: toGeminiContents(options.messages, options.attachments)
          })
        },
        timeoutMs
      );

      if (!response.ok || !response.body) {
        const text = await response.text();
        failures.push(`${model}: HTTP ${response.status}: ${truncate(text, 160)}`);
        continue;
      }

      return {
        provider,
        model,
        ok: true,
        stream: readGeminiSse(response.body),
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      failures.push(`${model}: ${getFailureMessage(error)}`);
    }
  }

  return {
    provider,
    model: models[0],
    ok: false,
    error: truncate(failures.join(" | "), 260),
    latencyMs: Date.now() - startedAt
  };
}

function toGeminiContents(messages: ChatMessage[], attachments: ChatAttachment[] = []): GeminiContent[] {
  const lastUserIndex = findLastUserMessageIndex(messages);
  const imageParts = toGeminiImageParts(attachments);
  const contents: GeminiContent[] = messages.map((message, index): GeminiContent => ({
    role: message.role === "assistant" ? "model" : "user",
    parts:
      index === lastUserIndex && imageParts.length > 0
        ? [{ text: message.content }, ...imageParts]
        : [{ text: message.content }]
  }));

  if (contents.length === 0) {
    return [
      {
        role: "user",
        parts: [{ text: "Respond when the user provides a request." }]
      }
    ];
  }

  if (contents[0].role === "model") {
    contents.unshift({
      role: "user",
      parts: [{ text: "Continue the conversation using the latest user request." }]
    });
  }

  return contents;
}

function findLastUserMessageIndex(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return index;
    }
  }

  return -1;
}

function toGeminiImageParts(attachments: ChatAttachment[]): GeminiPart[] {
  return attachments
    .filter(
      (attachment) =>
        attachment.kind === "image" &&
        Boolean(attachment.data) &&
        Boolean(attachment.mimeType || attachment.type)
    )
    .map((attachment) => ({
      inlineData: {
        mimeType: attachment.mimeType || attachment.type,
        data: attachment.data as string
      }
    }));
}

function getGeminiModelCandidates(model?: string) {
  const fallbackModels = parseModelList(process.env.GEMINI_FALLBACK_MODELS);
  const candidates = [model ?? process.env.GEMINI_MODEL ?? "", ...fallbackModels]
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  return [...new Set(candidates)];
}

function parseModelList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function getFailureMessage(error: unknown) {
  if (error instanceof ProviderHttpError && error.status === 429) {
    const retryHint = error.retryAfterMs
      ? ` Retry after ${Math.ceil(error.retryAfterMs / 1000)}s.`
      : "";
    return truncate(`Rate limit reached (HTTP 429).${retryHint} ${error.body}`.trim(), 160);
  }

  if (error instanceof Error) {
    return truncate(error.name === "AbortError" ? "Request timed out" : error.message, 160);
  }

  return "Request failed";
}

async function* readGeminiSse(body: ReadableStream<Uint8Array>) {
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
          yield* parseGeminiEventData(eventData);
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

    yield* parseGeminiEventData(eventData);
  } finally {
    reader.releaseLock();
  }
}

function* parseGeminiEventData(eventData: string) {
  const data = eventData.trim();

  if (!data || data === "[DONE]") {
    return;
  }

  try {
    const parsed = JSON.parse(data) as GeminiStreamChunk;
    const text = parsed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");

    if (text) {
      yield text;
    }
  } catch {
    return;
  }
}
