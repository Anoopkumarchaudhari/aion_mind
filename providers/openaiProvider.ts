import type { ChatAttachment, ChatMessage } from "@/types/aion";
import type { WebSearchSource } from "@/types/aion";
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

type OpenAIResponsesResponse = {
  output_text?: string;
  output?: OpenAIResponsesOutputItem[];
};

type OpenAIResponsesOutputItem = {
  type?: string;
  content?: OpenAIResponsesContentPart[];
  action?: {
    sources?: OpenAIWebSource[];
  };
};

type OpenAIResponsesContentPart = {
  type?: string;
  text?: string;
  annotations?: OpenAIUrlCitation[];
};

type OpenAIUrlCitation = {
  type?: string;
  title?: string;
  url?: string;
};

type OpenAIWebSource = {
  title?: string;
  url?: string;
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

type OpenAIVariant = "base" | "advanced" | "judge" | "live";

type OpenAIConfig = {
  provider: ProviderName;
  model: string;
  modelEnvName: string;
};

const DEFAULT_OPENAI_JUDGE_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_LIVE_MODEL = DEFAULT_OPENAI_JUDGE_MODEL;

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

export async function callOpenAIWithWebSearch(
  options: ProviderCallOptions,
  variant: OpenAIVariant = "live"
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

  const timeoutMs =
    options.timeoutMs ??
    getTimeoutMs(
      process.env.AION_LIVE_VERIFICATION_TIMEOUT_MS,
      getTimeoutMs(process.env.AION_PROVIDER_TIMEOUT_MS, 35000)
    );

  try {
    const data = await fetchJsonWithTimeout<OpenAIResponsesResponse>(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          input: buildLiveVerificationInput(options.messages, options.systemPrompt),
          tools: [{ type: "web_search", external_web_access: true }],
          tool_choice: "required",
          include: ["web_search_call.action.sources"],
          ...getOpenAITemperaturePayload(model, options.temperature ?? 0.2)
        })
      },
      timeoutMs
    );

    const sources = extractOpenAIWebSources(data);
    const content = compactContent(extractOpenAIResponseText(data));

    if (sources.length === 0) {
      throw new Error("Live web search returned no verifiable sources");
    }

    if (!content) {
      throw new Error("Empty verified response");
    }

    return {
      provider,
      model,
      ok: true,
      content: appendVerifiedSources(content, sources),
      webSources: toWebSearchSources(sources),
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

  if (variant === "live") {
    return {
      provider: "openai-live",
      model:
        options.model ??
        (process.env.OPENAI_LIVE_MODEL ||
          process.env.OPENAI_JUDGE_MODEL ||
          DEFAULT_OPENAI_LIVE_MODEL),
      modelEnvName: "OPENAI_LIVE_MODEL"
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

function buildLiveVerificationInput(messages: ChatMessage[], systemPrompt?: string) {
  const conversation = messages
    .map((message, index) => {
      const label = message.role === "assistant" ? "Assistant" : "User";
      return `${index + 1}. ${label}: ${truncate(message.content, 2500)}`;
    })
    .join("\n\n");

  return [
    systemPrompt,
    "Conversation:",
    conversation || "No prior conversation.",
    "",
    "Use live web search for the latest facts before answering the final user request."
  ]
    .filter(Boolean)
    .join("\n");
}

function extractOpenAIResponseText(data: OpenAIResponsesResponse) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  return (
    data.output
      ?.flatMap((item) => item.content?.map((part) => part.text ?? "") ?? [])
      .join("")
      .trim() ?? ""
  );
}

function extractOpenAIWebSources(data: OpenAIResponsesResponse) {
  const sources: OpenAIWebSource[] = [];

  for (const item of data.output ?? []) {
    for (const source of item.action?.sources ?? []) {
      if (source.url) {
        sources.push(source);
      }
    }

    for (const part of item.content ?? []) {
      for (const annotation of part.annotations ?? []) {
        if (annotation.url) {
          sources.push({
            title: annotation.title,
            url: annotation.url
          });
        }
      }
    }
  }

  return dedupeSources(sources).slice(0, 6);
}

function dedupeSources(sources: OpenAIWebSource[]) {
  const seen = new Set<string>();
  const output: OpenAIWebSource[] = [];

  for (const source of sources) {
    const url = source.url?.trim();

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    output.push({
      title: source.title?.trim() || getSourceLabel(url),
      url
    });
  }

  return output;
}

function appendVerifiedSources(content: string, sources: OpenAIWebSource[]) {
  const sourceLines = sources
    .map((source, index) => `${index + 1}. [${escapeMarkdownLabel(source.title ?? "Source")}](${source.url})`)
    .join("\n");

  return `${content.trim()}\n\nSources:\n${sourceLines}`;
}

function toWebSearchSources(sources: OpenAIWebSource[]): WebSearchSource[] {
  return sources.flatMap((source) => {
    if (!source.url) {
      return [];
    }

    return [
      {
        title: source.title?.trim() || getSourceLabel(source.url),
        url: source.url
      }
    ];
  });
}

function getSourceLabel(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Source";
  }
}

function escapeMarkdownLabel(value: string) {
  return value.replace(/[[\]]/g, "");
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
