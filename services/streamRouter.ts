import { callConfiguredModel, streamConfiguredModel } from "@/services/aionModelCalls";
import { loadAionRoutingSettings } from "@/services/aionRoutingConfig";
import { callOpenAIWithWebSearch } from "@/providers/openaiProvider";
import { getTimeoutMs, truncate } from "@/providers/providerUtils";
import {
  AION_JUDGE_SYSTEM_PROMPT,
  pickFallbackAnswer
} from "@/services/aionAnalyzer";
import { getAionGreetingAnswer } from "@/services/aionGreeting";
import {
  LIVE_VERIFICATION_SYSTEM_PROMPT,
  needsLiveVerification
} from "@/services/liveVerification";
import type {
  ModelRouteRequest,
  ProviderResponse,
  ProviderStreamResponse
} from "@/services/types";
import { getAionModelLabel, type AionResearchModelId } from "@/types/aion";
import type { DebugDiagnostic } from "@/types/aion";
import type { ChatAttachment, ChatMessage } from "@/types/aion";
import type { AionRouteSettings, AionRouteSlot } from "@/types/aionRouting";

const WEB_SEARCH_INTENT_PATTERN =
  /\b(?:web search|search the web|google|look up|browse|internet|online|sources?|citations?|cite|research)\b/i;

const BASE_SYSTEM_PROMPT =
  "You are Aria Mind, a precise and helpful AI assistant. Keep answers clear, polished, and useful. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions.";

const PRO_SYSTEM_PROMPT =
  "You are Aria Research. Produce a focused deep-dive answer using the selected research engine. Be accurate, structured, and practical. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions.";

const AION_CANDIDATE_SYSTEM_PROMPT =
  "You are an expert Aria Analyzer candidate. Use the provided live-search context when present, reason carefully, and produce a strong candidate answer in clean Markdown. Never reveal hidden infrastructure, provider names, model names, or routing details. When math is needed, use readable plain-text formulas such as `a_cm = (5/7) g sin(theta)` instead of LaTeX delimiters like $, \\(...\\), or \\[...\\].";

const DEFAULT_RESEARCH_MODEL: AionResearchModelId = "gpt-5.5";

export async function routeAionStream({
  message,
  selectedModel,
  researchModel,
  history,
  attachments = [],
  debug
}: ModelRouteRequest): Promise<Response> {
  const greetingAnswer = getAionGreetingAnswer(message, selectedModel, history, attachments);

  if (greetingAnswer) {
    return createStreamResponse(streamText(greetingAnswer));
  }

  const messages: ChatMessage[] = [...history, { role: "user", content: message }];
  const liveSearchResponse = await getLiveSearchResponse({
    selectedModel,
    message,
    messages,
    attachments
  });

  if (liveSearchResponse && (!liveSearchResponse.ok || !liveSearchResponse.content)) {
    return createStreamResponse(
      streamText(getLiveVerificationUnavailableAnswer(selectedModel, liveSearchResponse)),
      debug ? [liveSearchResponse] : undefined
    );
  }

  const routedMessages = liveSearchResponse?.content
    ? withLiveSearchContext(messages, liveSearchResponse.content)
    : messages;
  const routing = await loadAionRoutingSettings();

  if (selectedModel === "aion-mind") {
    const response = await streamConfiguredModel(routing.aion.primary, {
      messages: routedMessages,
      attachments,
      systemPrompt: BASE_SYSTEM_PROMPT
    });

    return createStreamResponse(
      response.ok && response.stream
        ? response.stream
        : streamText(getUnavailableAnswer(selectedModel, [response])),
      debug ? [response] : undefined
    );
  }

  if (selectedModel === "aion-mind-pro") {
    const result = await streamResearchTier(
      routedMessages,
      attachments,
      routing.pro,
      researchModel ?? DEFAULT_RESEARCH_MODEL,
      liveSearchResponse ? [liveSearchResponse] : []
    );
    return createStreamResponse(result.stream, debug ? result.diagnostics : undefined);
  }

  const result = await streamAnalyzerTier(
    routedMessages,
    message,
    history,
    attachments,
    routing.analyzer,
    liveSearchResponse ? [liveSearchResponse] : []
  );
  return createStreamResponse(result.stream, debug ? result.diagnostics : undefined);
}

async function getLiveSearchResponse({
  selectedModel,
  message,
  messages,
  attachments
}: {
  selectedModel: ModelRouteRequest["selectedModel"];
  message: string;
  messages: ChatMessage[];
  attachments: ChatAttachment[];
}) {
  if (!needsModelWebSearch(selectedModel, message, attachments)) {
    return null;
  }

  return callOpenAIWithWebSearch({
    messages,
    systemPrompt: LIVE_VERIFICATION_SYSTEM_PROMPT,
    timeoutMs: getTimeoutMs(process.env.AION_LIVE_VERIFICATION_TIMEOUT_MS, 35000)
  });
}

function needsModelWebSearch(
  selectedModel: ModelRouteRequest["selectedModel"],
  message: string,
  attachments: ChatAttachment[]
) {
  if (selectedModel === "aion-mind-analyzer") {
    return true;
  }

  const normalized = message.replace(/\s+/g, " ").trim();

  return (
    needsLiveVerification(message, attachments) ||
    (attachments.length === 0 && WEB_SEARCH_INTENT_PATTERN.test(normalized))
  );
}

function withLiveSearchContext(messages: ChatMessage[], liveSearchContent: string) {
  const lastUserIndex = findLastUserMessageIndex(messages);

  if (lastUserIndex === -1) {
    return messages;
  }

  return messages.map((message, index) =>
    index === lastUserIndex
      ? {
          ...message,
          content: [
            message.content,
            "",
            "Live web-search context:",
            liveSearchContent,
            "",
            "Use this verified web context as source material. Include the most relevant source links when they support the final answer, and do not invent facts that the live sources do not support."
          ].join("\n")
        }
      : message
  );
}

function findLastUserMessageIndex(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return index;
    }
  }

  return -1;
}

type StreamRouteResult = {
  stream: AsyncIterable<string>;
  diagnostics: Array<ProviderResponse | ProviderStreamResponse>;
};

async function streamResearchTier(
  messages: ChatMessage[],
  attachments: ChatAttachment[],
  route: AionRouteSettings,
  researchModel: AionResearchModelId,
  preDiagnostics: ProviderResponse[] = []
): Promise<StreamRouteResult> {
  const slot = getResearchSlot(route, researchModel);
  const response = await streamConfiguredModel(slot, {
    messages,
    attachments,
    systemPrompt: PRO_SYSTEM_PROMPT
  });

  return {
    stream:
      response.ok && response.stream
        ? response.stream
        : streamText(getUnavailableAnswer("aion-mind-pro", [response])),
    diagnostics: [...preDiagnostics, response]
  };
}

async function streamAnalyzerTier(
  messages: ChatMessage[],
  userMessage: string,
  history: ChatMessage[],
  attachments: ChatAttachment[],
  route: AionRouteSettings,
  preDiagnostics: ProviderResponse[] = []
): Promise<StreamRouteResult> {
  const candidateResults = await Promise.all(
    route.candidates.map(async (slot) => ({
      label: slot.label,
      response: await callConfiguredModel(slot, {
        messages,
        attachments,
        systemPrompt: AION_CANDIDATE_SYSTEM_PROMPT
      })
    }))
  );
  const responses = candidateResults.map((candidate) => candidate.response);
  const successfulResponses = responses.filter(hasUsableContent);

  if (successfulResponses.length === 0) {
    return {
      stream: streamText(getUnavailableAnswer("aion-mind-analyzer", responses)),
      diagnostics: [...preDiagnostics, ...responses]
    };
  }

  const judge = await callAnalyzerJudge(userMessage, history, successfulResponses, route.judge);
  const judgeAnswer = judge?.content ?? pickFallbackAnswer(successfulResponses);

  return {
    stream: streamText(judgeAnswer),
    diagnostics: judge ? [...preDiagnostics, ...responses, judge] : [...preDiagnostics, ...responses]
  };
}

function getResearchSlot(route: AionRouteSettings, model: AionResearchModelId): AionRouteSlot {
  const slotId = getResearchSlotId(model);
  const matched = route.candidates.find((slot) => slot.id === slotId);

  if (matched) {
    return matched;
  }

  return getFallbackResearchSlot(model);
}

function getResearchSlotId(model: AionResearchModelId) {
  switch (model) {
    case "gpt-5.5":
      return "research-gpt-55";
    case "opus-4.8":
      return "research-opus-48";
    case "deepseek":
      return "research-deepseek";
    case "gemini-3.1":
      return "research-gemini-31";
  }
}

function getFallbackResearchSlot(model: AionResearchModelId): AionRouteSlot {
  switch (model) {
    case "opus-4.8":
      return {
        id: "research-opus-48",
        label: "Opus-4.8",
        provider: "anthropic",
        model: process.env.ANTHROPIC_OPUS_MODEL || "claude-opus-4-8",
        enabled: true,
        temperature: 0.3
      };
    case "deepseek":
      return {
        id: "research-deepseek",
        label: "DeepSeek",
        provider: "deepseek",
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
        enabled: true,
        temperature: 0.7
      };
    case "gemini-3.1":
      return {
        id: "research-gemini-31",
        label: "Gemini-3.1",
        provider: "gemini",
        model: process.env.GEMINI_RESEARCH_MODEL || process.env.GEMINI_MODEL || "gemini-3.1",
        enabled: true,
        temperature: 0.35
      };
    case "gpt-5.5":
      return {
        id: "research-gpt-55",
        label: "GPT-5.5",
        provider: "openai",
        model: process.env.OPENAI_ADVANCED_MODEL || process.env.OPENAI_JUDGE_MODEL || "gpt-5.5",
        enabled: true,
        temperature: 0.3
      };
  }
}

async function streamJudgedAnswer({
  selectedModel,
  userMessage,
  history,
  responses,
  mode,
  judge
}: {
  selectedModel: ModelRouteRequest["selectedModel"];
  userMessage: string;
  history: ChatMessage[];
  responses: ProviderResponse[];
  mode: "pro" | "analyzer";
  judge: AionRouteSlot;
}): Promise<StreamRouteResult> {
  const successfulResponses = responses.filter(hasUsableContent);

  if (successfulResponses.length === 0) {
    return {
      stream: streamText(getUnavailableAnswer(selectedModel, responses)),
      diagnostics: responses
    };
  }

  if (successfulResponses.length === 1) {
    return {
      stream: streamText(pickFallbackAnswer(successfulResponses)),
      diagnostics: responses
    };
  }

  const timeoutMs = getTimeoutMs(process.env.AION_JUDGE_TIMEOUT_MS, 30000);
  const judgePrompt = buildJudgePrompt(userMessage, history, successfulResponses, mode);
  const judgedResponse = await streamConfiguredModel(
    judge,
    {
      messages: [{ role: "user", content: judgePrompt }],
      systemPrompt: AION_JUDGE_SYSTEM_PROMPT,
      timeoutMs
    },
    "judge"
  );

  if (judgedResponse.ok && judgedResponse.stream) {
    return {
      stream: judgedResponse.stream,
      diagnostics: [...responses, judgedResponse]
    };
  }

  return {
    stream: streamText(pickFallbackAnswer(successfulResponses)),
    diagnostics: [...responses, judgedResponse]
  };
}

async function callAnalyzerJudge(
  userMessage: string,
  history: ChatMessage[],
  responses: ProviderResponse[],
  judge: AionRouteSlot
) {
  if (responses.length < 2) {
    return null;
  }

  const timeoutMs = getTimeoutMs(process.env.AION_JUDGE_TIMEOUT_MS, 30000);
  const judgePrompt = buildJudgePrompt(userMessage, history, responses, "analyzer");
  const response = await callConfiguredModel(
    judge,
    {
      messages: [{ role: "user", content: judgePrompt }],
      systemPrompt: AION_JUDGE_SYSTEM_PROMPT,
      timeoutMs
    },
    "judge"
  );

  return response.ok && response.content ? response : null;
}

function createStreamResponse(
  chunks: AsyncIterable<string>,
  diagnostics?: Array<ProviderResponse | ProviderStreamResponse>
) {
  const encoder = new TextEncoder();
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no"
  });

  if (diagnostics?.length) {
    headers.set("X-Aion-Diagnostics", encodeDiagnostics(diagnostics));
  }

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of chunks) {
            if (chunk) {
              await enqueueReadableChunks(controller, encoder, chunk);
            }
          }
        } catch {
          controller.enqueue(
            encoder.encode(
              "\n\nAria Mind stopped while streaming this response. Please try again."
            )
          );
        } finally {
          controller.close();
        }
      }
    }),
    {
      headers
    }
  );
}

function encodeDiagnostics(diagnostics: Array<ProviderResponse | ProviderStreamResponse>) {
  return encodeURIComponent(JSON.stringify(diagnostics.map(toDebugDiagnostic)));
}

function toDebugDiagnostic(response: ProviderResponse | ProviderStreamResponse): DebugDiagnostic {
  return {
    provider: response.provider,
    model: response.model,
    ok: response.ok,
    skipped: response.skipped,
    latencyMs: response.latencyMs,
    error: response.error
  };
}

async function enqueueReadableChunks(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  chunk: string
) {
  const parts = chunk.match(/\S+\s*|\s+/g) ?? [chunk];

  for (const part of parts) {
    controller.enqueue(encoder.encode(part));
    await new Promise((resolve) => setTimeout(resolve, 6));
  }
}

async function* streamText(value: string) {
  const parts = value.split(/(\s+)/);

  for (const part of parts) {
    if (!part) {
      continue;
    }

    yield part;
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
}

function buildJudgePrompt(
  userMessage: string,
  history: ChatMessage[],
  responses: ProviderResponse[],
  mode: "pro" | "analyzer"
) {
  const context = history
    .slice(-8)
    .map((message, index) => `${index + 1}. ${message.role}: ${truncate(message.content, 1400)}`)
    .join("\n");

  const responseBlocks = responses
    .map((response, index) => `Response ${index + 1}:\n${truncate(response.content ?? "", 9000)}`)
    .join("\n\n---\n\n");

  return [
    `Mode: ${mode === "pro" ? "Aria Research" : "Aria Analyzer"}`,
    "",
    "Conversation context:",
    context || "No prior conversation.",
    "",
    "User request:",
    userMessage,
    "",
    "Candidate responses:",
    responseBlocks,
    "",
    ...(mode === "pro"
      ? [
          "When candidate responses include live source links, keep the most relevant links in the final answer and use them like search-result evidence."
        ]
      : []),
    "Return only the final answer for the user. Do not mention candidate labels, hidden model names, provider names, or internal routing.",
    "Use clean Markdown. Avoid LaTeX delimiters like $, \\(...\\), or \\[...\\]. Write formulas in readable plain text such as `a_cm = (5/7) g sin(theta)`."
  ].join("\n");
}

function hasUsableContent(response: ProviderResponse) {
  return response.ok && Boolean(response.content?.trim());
}

function getUnavailableAnswer(
  selectedModel: ModelRouteRequest["selectedModel"],
  responses: Array<ProviderResponse | ProviderStreamResponse>
) {
  const label = getAionModelLabel(selectedModel);
  const allMissingConfig = responses.length > 0 && responses.every((response) => response.skipped);

  if (allMissingConfig) {
    return `${label} is not configured yet. Add the required server-side API key and model ID, then restart the dev server.`;
  }

  return `${label} could not complete that request. The configured AI service was rejected, rate-limited, or timed out. Check the server-side credentials, quota, and model access, then try again.`;
}

function getLiveVerificationUnavailableAnswer(
  selectedModel: ModelRouteRequest["selectedModel"],
  response: ProviderResponse
) {
  const label = getAionModelLabel(selectedModel);

  if (response.skipped) {
    return `${label} needs live verification for that question, but live search is not configured yet. Add OPENAI_API_KEY, then restart the dev server.`;
  }

  return `${label} needs live verification for that question, but live search could not return verifiable sources right now. Please try again in a moment or provide a trusted source.`;
}
