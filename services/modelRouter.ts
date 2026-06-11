import { callConfiguredModel } from "@/services/aionModelCalls";
import { loadAionRoutingSettings } from "@/services/aionRoutingConfig";
import { callOpenAIWithWebSearch } from "@/providers/openaiProvider";
import { callResearchWebSearch } from "@/providers/webSearchProvider";
import { getTimeoutMs } from "@/providers/providerUtils";
import { getAionGreetingAnswer } from "@/services/aionGreeting";
import { getAionModelLabel, type AionResearchModelId } from "@/types/aion";
import type { ChatMessage, DebugDiagnostic } from "@/types/aion";
import {
  judgeResponsesWithConfiguredModel,
  pickFallbackAnswer,
  runAionAnalyzer
} from "@/services/aionAnalyzer";
import {
  LIVE_VERIFICATION_SYSTEM_PROMPT,
  needsLiveVerification
} from "@/services/liveVerification";
import type { ModelRouteRequest, ModelRouteResult, ProviderResponse } from "@/services/types";
import type { ChatAttachment } from "@/types/aion";
import type { AionRouteSettings, AionRouteSlot } from "@/types/aionRouting";

const WEB_SEARCH_INTENT_PATTERN =
  /\b(?:web search|search the web|google|look up|browse|internet|online|sources?|citations?|cite|research)\b/i;

const BASE_SYSTEM_PROMPT =
  "You are Aria Mind, a precise and helpful AI assistant. Keep answers clear, polished, and useful. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions.";

const PRO_SYSTEM_PROMPT =
  "You are Aria Research. Produce a focused deep-dive answer using the selected research engine. Be accurate, structured, and practical. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions. In this mode, answer only from the selected research engine and any user-provided attachments or source text. You do not have live web access unless live web-search context is explicitly included in the prompt. Do not claim that you verified current information, checked recent sources, or consulted government/news/search sources unless those sources are actually present in the prompt. Do not create a Sources section unless you were given source URLs or source documents. For current or fast-changing facts without provided sources, clearly say the answer may be based on model knowledge and should be live-verified.";

const DEFAULT_RESEARCH_MODEL: AionResearchModelId = "gpt-5.5";

export async function routeAionRequest({
  message,
  selectedModel,
  researchModel,
  history,
  attachments = [],
  debug
}: ModelRouteRequest): Promise<ModelRouteResult> {
  const greetingAnswer = getAionGreetingAnswer(message, selectedModel, history, attachments);

  if (greetingAnswer) {
    return toRouteResult(selectedModel, greetingAnswer);
  }

  const messages: ChatMessage[] = [...history, { role: "user", content: message }];
  const liveSearchResponse = await getLiveSearchResponse({
    selectedModel,
    message,
    messages,
    attachments
  });

  if (liveSearchResponse && (!liveSearchResponse.ok || !liveSearchResponse.content)) {
    return toRouteResult(
      selectedModel,
      getLiveVerificationUnavailableAnswer(selectedModel, liveSearchResponse),
      debug ? [liveSearchResponse] : undefined
    );
  }

  const routedMessages = liveSearchResponse?.content
    ? withLiveSearchContext(messages, liveSearchResponse.content)
    : messages;
  const routing = await loadAionRoutingSettings();

  if (selectedModel === "aion-mind") {
    const response = await callConfiguredModel(routing.aion.primary, {
      messages: routedMessages,
      attachments,
      systemPrompt: BASE_SYSTEM_PROMPT
    });

    return toRouteResult(
      selectedModel,
      response.ok && response.content ? response.content : getUnavailableAnswer(selectedModel, [response]),
      debug ? [response] : undefined
    );
  }

  if (selectedModel === "aion-mind-pro") {
    const response = await callConfiguredModel(getResearchSlot(routing.pro, researchModel ?? DEFAULT_RESEARCH_MODEL), {
      messages: routedMessages,
      attachments,
      systemPrompt: PRO_SYSTEM_PROMPT
    });

    return toRouteResult(
      selectedModel,
      response.ok && response.content ? response.content : getUnavailableAnswer(selectedModel, [response]),
      debug ? [...(liveSearchResponse ? [liveSearchResponse] : []), response] : undefined
    );
  }

  const analyzerResult = await runAionAnalyzer(routedMessages, message, history, attachments);

  return toRouteResult(
    selectedModel,
    analyzerResult.answer,
    debug
      ? [...(liveSearchResponse ? [liveSearchResponse] : []), ...analyzerResult.diagnostics]
      : undefined
  );
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

  if (selectedModel === "aion-mind-pro") {
    return callResearchWebSearch({
      query: message,
      timeoutMs: getTimeoutMs(process.env.AION_LIVE_VERIFICATION_TIMEOUT_MS, 35000)
    });
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
  const normalized = message.replace(/\s+/g, " ").trim();

  if (selectedModel === "aion-mind-pro") {
    return (
      needsLiveVerification(message, attachments) ||
      (attachments.length === 0 && WEB_SEARCH_INTENT_PATTERN.test(normalized))
    );
  }

  if (selectedModel === "aion-mind-analyzer") {
    return true;
  }

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

function toRouteResult(
  selectedModel: ModelRouteRequest["selectedModel"],
  answer: string,
  diagnostics?: ProviderResponse[]
): ModelRouteResult {
  return {
    selectedModel,
    answer,
    diagnostics: diagnostics?.map(toDebugDiagnostic)
  };
}

function toDebugDiagnostic(response: ProviderResponse): DebugDiagnostic {
  return {
    provider: response.provider,
    model: response.model,
    ok: response.ok,
    skipped: response.skipped,
    latencyMs: response.latencyMs,
    error: response.error
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

function hasUsableContent(response: ProviderResponse) {
  return response.ok && Boolean(response.content?.trim());
}

function getUnavailableAnswer(
  selectedModel: ModelRouteRequest["selectedModel"],
  responses: ProviderResponse[]
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
