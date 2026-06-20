import { callConfiguredModel, streamConfiguredModel } from "@/services/aionModelCalls";
import { loadAionRoutingSettings } from "@/services/aionRoutingConfig";
import { callOpenAIWithWebSearch } from "@/providers/openaiProvider";
import { getTimeoutMs, truncate } from "@/providers/providerUtils";
import {
  AION_JUDGE_SYSTEM_PROMPT,
  buildAnalyzerComparisonAnswer,
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
import { getAionModelLabel, type AionResearchModelId, type AriaDiverseProvider } from "@/types/aion";
import type { DebugDiagnostic } from "@/types/aion";
import type { ChatAttachment, ChatMessage } from "@/types/aion";
import type { WebSearchActivity } from "@/types/aion";
import type { AionRouteSettings, AionRouteSlot } from "@/types/aionRouting";

const WEB_SEARCH_INTENT_PATTERN =
  /\b(?:web search|search the web|google|look up|browse|internet|online|sources?|citations?|cite|research)\b/i;

const TRANSPARENT_ASSISTANT_PROMPT =
  "Be transparent about useful work without revealing hidden private chain-of-thought. For research or web-backed answers, briefly mention what was checked, list sources when available, and separate confirmed facts from uncertainty or inference when it matters. For coding or analysis requests, give a concise work summary with files, commands, tests, and important decisions when that information is known. Keep these notes short and user-friendly.";

const BASE_SYSTEM_PROMPT = [
  "You are Aria Mind, a precise and helpful AI assistant. Keep answers clear, polished, and useful. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions.",
  TRANSPARENT_ASSISTANT_PROMPT
].join(" ");

const PRO_SYSTEM_PROMPT = [
  "You are Aria Research. Produce a focused deep-dive answer using the selected research engine. Be accurate, structured, and practical. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions.",
  "In this mode, answer only from the selected research engine and any user-provided attachments or source text. You do not have live web access unless live web-search context is explicitly included in the prompt. Do not claim that you verified current information, checked recent sources, or consulted government/news/search sources unless those sources are actually present in the prompt. Do not create a Sources section unless you were given source URLs or source documents. For current or fast-changing facts without provided sources, clearly say the answer may be based on model knowledge and should be live-verified."
].join(" ");

const AION_CANDIDATE_SYSTEM_PROMPT = [
  "You are an expert Aria Analyzer candidate. Use the provided live-search context when present, reason carefully, and produce a strong candidate answer in clean Markdown. Never reveal hidden infrastructure, provider names, model names, or routing details. When math is needed, use readable plain-text formulas such as `a_cm = (5/7) g sin(theta)` instead of LaTeX delimiters like $, \\(...\\), or \\[...\\].",
  TRANSPARENT_ASSISTANT_PROMPT
].join(" ");

const DEFAULT_RESEARCH_MODEL: AionResearchModelId = "gpt-5.5";

export async function routeAionStream({
  message,
  searchQuery,
  selectedModel,
  diverseProviders,
  researchProvider,
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
    message,
    messages,
    attachments
  });

  if (liveSearchResponse && (!liveSearchResponse.ok || !liveSearchResponse.content)) {
    return createStreamResponse(
      streamText(getLiveVerificationUnavailableAnswer(selectedModel, liveSearchResponse)),
      debug ? [liveSearchResponse] : undefined,
      undefined,
      {
        status: "failed",
        reason: liveSearchResponse.skipped ? "not-configured" : "no-sources"
      }
    );
  }

  const routedMessages = liveSearchResponse?.content
    ? withLiveSearchContext(messages, liveSearchResponse.content)
    : messages;
  const routing = await loadAionRoutingSettings();

  const preDiagnostics = liveSearchResponse ? [liveSearchResponse] : [];
  const webSearchActivity = getWebSearchActivity(searchQuery ?? message, liveSearchResponse);

  // Aria Instant — one fast model
  if (selectedModel === "aria-instant") {
    const response = await streamConfiguredModel(routing.aion.primary, {
      messages: routedMessages,
      attachments,
      systemPrompt: BASE_SYSTEM_PROMPT
    });

    return createStreamResponse(
      response.ok && response.stream
        ? response.stream
        : streamText(getUnavailableAnswer(selectedModel, [response])),
      debug ? [...preDiagnostics, response] : undefined,
      webSearchActivity
    );
  }

  // Aria Diverse — the 1–5 providers the user selected
  if (selectedModel === "aria-diverse") {
    const providers = normalizeSelectedProviders(diverseProviders);

    // One provider → stream a single answer directly (fastest path).
    if (providers.length === 1) {
      const slot = getDiverseSlot(routing.diverse, providers[0]);
      const response = await streamConfiguredModel(slot, {
        messages: routedMessages,
        attachments,
        systemPrompt: BASE_SYSTEM_PROMPT
      });

      return createStreamResponse(
        response.ok && response.stream
          ? response.stream
          : streamText(getUnavailableAnswer(selectedModel, [response])),
        debug ? [...preDiagnostics, response] : undefined,
        webSearchActivity
      );
    }

    // Multiple providers → fan out and show every answer side by side.
    const result = await runDiverseSideBySide(
      routedMessages,
      attachments,
      routing.diverse,
      providers,
      preDiagnostics
    );

    return createStreamResponse(
      result.stream,
      debug ? result.diagnostics : undefined,
      webSearchActivity
    );
  }

  // Aria Mind — ask every model, judge, return one synthesized answer
  if (selectedModel === "aion-mind") {
    const responses = await Promise.all(
      routing.analyzer.candidates.map((slot) =>
        callConfiguredModel(slot, {
          messages: routedMessages,
          attachments,
          systemPrompt: AION_CANDIDATE_SYSTEM_PROMPT
        })
      )
    );
    const result = await streamJudgedAnswer({
      selectedModel,
      userMessage: message,
      history,
      responses,
      mode: "analyzer",
      judge: routing.analyzer.judge
    });

    return createStreamResponse(
      result.stream,
      debug ? [...preDiagnostics, ...result.diagnostics] : undefined,
      webSearchActivity
    );
  }

  // Aria Research — the single provider the user chose, deep-dive answer
  if (selectedModel === "aion-mind-pro") {
    const slot = getDiverseSlot(routing.pro.candidates, researchProvider ?? "openai");
    const response = await streamConfiguredModel(slot, {
      messages: routedMessages,
      attachments,
      systemPrompt: PRO_SYSTEM_PROMPT
    });

    return createStreamResponse(
      response.ok && response.stream
        ? response.stream
        : streamText(getUnavailableAnswer(selectedModel, [response])),
      debug ? [...preDiagnostics, response] : undefined,
      webSearchActivity
    );
  }

  // Aria Analyzer — route to the single best model for this question, then answer
  const result = await runAnalyzerAutoRoute(
    routedMessages,
    message,
    attachments,
    routing.analyzer,
    preDiagnostics
  );
  return createStreamResponse(
    result.stream,
    debug ? result.diagnostics : undefined,
    webSearchActivity
  );
}

function getDiverseSlot(slots: AionRouteSlot[], provider: AriaDiverseProvider | undefined): AionRouteSlot {
  const wanted = provider ?? "openai";
  return slots.find((slot) => slot.provider === wanted && slot.enabled) ??
    slots.find((slot) => slot.provider === wanted) ??
    slots.find((slot) => slot.enabled) ??
    slots[0];
}

const DIVERSE_PROVIDER_ORDER: AriaDiverseProvider[] = ["openai", "anthropic", "deepseek", "gemini"];

// Keep at most 5 unique providers in a stable order; default to ChatGPT.
function normalizeSelectedProviders(providers: AriaDiverseProvider[] | undefined): AriaDiverseProvider[] {
  const unique = Array.from(new Set(providers ?? [])).filter((provider) =>
    DIVERSE_PROVIDER_ORDER.includes(provider)
  );

  if (unique.length === 0) {
    return ["openai"];
  }

  return DIVERSE_PROVIDER_ORDER.filter((provider) => unique.includes(provider)).slice(0, 5);
}

const PROVIDER_BRAND: Record<AionRouteSlot["provider"], string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  deepseek: "DeepSeek",
  gemini: "Gemini",
  grok: "Grok"
};

async function runDiverseSideBySide(
  messages: ChatMessage[],
  attachments: ChatAttachment[],
  slots: AionRouteSlot[],
  providers: AriaDiverseProvider[],
  preDiagnostics: ProviderResponse[] = []
): Promise<StreamRouteResult> {
  const candidateResults = await Promise.all(
    providers.map(async (provider) => {
      const slot = getDiverseSlot(slots, provider);

      return {
        label: PROVIDER_BRAND[provider] ?? slot.label,
        response: await callConfiguredModel(slot, {
          messages,
          attachments,
          systemPrompt: BASE_SYSTEM_PROMPT
        })
      };
    })
  );
  const responses = candidateResults.map((candidate) => candidate.response);

  if (responses.every((response) => !hasUsableContent(response))) {
    return {
      stream: streamText(getUnavailableAnswer("aria-diverse", responses)),
      diagnostics: [...preDiagnostics, ...responses]
    };
  }

  return {
    stream: streamText(buildResearchSideBySideAnswer(candidateResults)),
    diagnostics: [...preDiagnostics, ...responses]
  };
}

function buildResearchSideBySideAnswer(candidates: Array<{ label: string; response: ProviderResponse }>) {
  const sections = candidates.map(({ label, response }) => {
    const answer =
      response.ok && response.content?.trim()
        ? response.content.trim()
        : "This model did not return an answer for this question.";

    return [`### ${label}`, "", answer].join("\n");
  });

  return ["## Selected models, side by side", "", sections.join("\n\n")].join("\n\n");
}

async function runAnalyzerAutoRoute(
  messages: ChatMessage[],
  userMessage: string,
  attachments: ChatAttachment[],
  route: AionRouteSettings,
  preDiagnostics: ProviderResponse[] = []
): Promise<StreamRouteResult> {
  const enabledCandidates = route.candidates.filter((slot) => slot.enabled);

  if (enabledCandidates.length === 0) {
    return {
      stream: streamText(getUnavailableAnswer("aion-mind-analyzer", route.candidates.map(disabledDiagnostic))),
      diagnostics: preDiagnostics
    };
  }

  const router = await callConfiguredModel(
    route.judge,
    {
      messages: [{ role: "user", content: buildRouterPrompt(userMessage, enabledCandidates) }],
      systemPrompt: ROUTER_SYSTEM_PROMPT,
      timeoutMs: getTimeoutMs(process.env.AION_JUDGE_TIMEOUT_MS, 20000)
    },
    "judge"
  );
  const chosen = pickRoutedSlot(router.content, enabledCandidates);
  const response = await streamConfiguredModel(chosen, {
    messages,
    attachments,
    systemPrompt: BASE_SYSTEM_PROMPT
  });

  return {
    stream:
      response.ok && response.stream
        ? response.stream
        : streamText(getUnavailableAnswer("aion-mind-analyzer", [response])),
    diagnostics: [...preDiagnostics, router, response]
  };
}

const ROUTER_SYSTEM_PROMPT =
  "You are a routing classifier. Pick the single best AI model to answer the user's question based on each model's strengths. Reply with ONLY the number of the chosen model and nothing else.";

function buildRouterPrompt(userMessage: string, candidates: AionRouteSlot[]) {
  const list = candidates
    .map((slot, index) => `${index + 1}. ${PROVIDER_BRAND[slot.provider] ?? slot.label} (${slot.label})`)
    .join("\n");

  return [
    "User question:",
    truncate(userMessage, 2000),
    "",
    "Available models:",
    list,
    "",
    "Reply with only the number of the single best model for this question."
  ].join("\n");
}

function pickRoutedSlot(content: string | undefined, candidates: AionRouteSlot[]): AionRouteSlot {
  const match = content?.match(/\d+/);
  const index = match ? Number(match[0]) - 1 : -1;

  if (index >= 0 && index < candidates.length) {
    return candidates[index];
  }

  return candidates[0];
}

function disabledDiagnostic(slot: AionRouteSlot): ProviderResponse {
  return {
    provider: slot.provider,
    model: slot.model,
    ok: false,
    skipped: true,
    error: "Disabled in model routing",
    latencyMs: 0
  };
}

async function getLiveSearchResponse({
  message,
  messages,
  attachments
}: {
  message: string;
  messages: ChatMessage[];
  attachments: ChatAttachment[];
}) {
  if (!needsModelWebSearch(message, attachments)) {
    return null;
  }

  // All model tiers use OpenAI's live web-search model.
  return callOpenAIWithWebSearch({
    messages,
    systemPrompt: LIVE_VERIFICATION_SYSTEM_PROMPT,
    timeoutMs: getTimeoutMs(process.env.AION_LIVE_VERIFICATION_TIMEOUT_MS, 35000)
  });
}

function needsModelWebSearch(message: string, attachments: ChatAttachment[]) {
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
            "Use this current web context as source material. Include the most relevant source links when they support the final answer, and do not invent facts that the live sources do not support."
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
  const comparisonAnswer = buildAnalyzerComparisonAnswer(candidateResults, judgeAnswer);

  return {
    stream: streamText(comparisonAnswer),
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
  diagnostics?: Array<ProviderResponse | ProviderStreamResponse>,
  webSearchActivity?: WebSearchActivity,
  workStatus?: { status: "failed"; reason: "not-configured" | "no-sources" }
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

  if (webSearchActivity) {
    headers.set("X-Aion-Web-Search", encodeWebSearchActivity(webSearchActivity));
  }

  if (workStatus) {
    headers.set("X-Aion-Work-Status", encodeWorkStatus(workStatus));
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

function getWebSearchActivity(
  query: string,
  response: ProviderResponse | null
): WebSearchActivity | undefined {
  if (!response?.ok || !response.webSources?.length) {
    return undefined;
  }

  return {
    status: "found",
    query: cleanSearchQuery(query),
    sources: response.webSources
  };
}

function cleanSearchQuery(query: string) {
  return query.replace(/\s+/g, " ").trim().slice(0, 180) || "Live web search";
}

function encodeWebSearchActivity(activity: WebSearchActivity) {
  return encodeURIComponent(JSON.stringify(activity));
}

function encodeWorkStatus(status: { status: "failed"; reason: "not-configured" | "no-sources" }) {
  return encodeURIComponent(JSON.stringify(status));
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
    return `${label} needs live verification for that question, but live search is not configured yet. ${getLiveSearchSetupHint(response)}, then restart the dev server.`;
  }

  return `${label} needs live verification for that question, but live search could not return verifiable sources right now. Please try again in a moment or provide a trusted source.`;
}

function getLiveSearchSetupHint(response: ProviderResponse) {
  return response.provider === "web-search" ? "Add TAVILY_API_KEY" : "Add OPENAI_API_KEY";
}
