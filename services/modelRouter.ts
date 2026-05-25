import { callClaude } from "@/providers/claudeProvider";
import { callGemini } from "@/providers/geminiProvider";
import { callOpenAI } from "@/providers/openaiProvider";
import { getAionGreetingAnswer } from "@/services/aionGreeting";
import { getAionModelLabel } from "@/types/aion";
import type { ChatMessage, DebugDiagnostic } from "@/types/aion";
import {
  judgeResponsesWithClaude,
  pickFallbackAnswer,
  runAionAnalyzer
} from "@/services/aionAnalyzer";
import type { ModelRouteRequest, ModelRouteResult, ProviderResponse } from "@/services/types";

const BASE_SYSTEM_PROMPT =
  "You are Aion Mind, a precise and helpful AI assistant. Keep answers clear, polished, and useful. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions.";

const PRO_SYSTEM_PROMPT =
  "You are Aion Mind Pro. Produce a careful answer with strong reasoning, practical judgment, and concise structure. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions.";

export async function routeAionRequest({
  message,
  selectedModel,
  history,
  attachments = [],
  debug
}: ModelRouteRequest): Promise<ModelRouteResult> {
  const greetingAnswer = getAionGreetingAnswer(message, selectedModel, history, attachments);

  if (greetingAnswer) {
    return toRouteResult(selectedModel, greetingAnswer);
  }

  const messages: ChatMessage[] = [...history, { role: "user", content: message }];

  if (selectedModel === "aion-mind") {
    const response = await callGemini({
      messages,
      attachments,
      systemPrompt: BASE_SYSTEM_PROMPT,
      temperature: 0.35
    });

    return toRouteResult(
      selectedModel,
      response.ok && response.content ? response.content : getUnavailableAnswer(selectedModel, [response]),
      debug ? [response] : undefined
    );
  }

  if (selectedModel === "aion-mind-pro") {
    const responses = await Promise.all([
      callOpenAI({
        messages,
        attachments,
        systemPrompt: PRO_SYSTEM_PROMPT,
        temperature: 0.32
      }),
      callClaude({
        messages,
        attachments,
        systemPrompt: PRO_SYSTEM_PROMPT,
        temperature: 0.32
      })
    ]);

    const successfulResponses = responses.filter(hasUsableContent);

    if (successfulResponses.length === 0) {
      return toRouteResult(
        selectedModel,
        getUnavailableAnswer(selectedModel, responses),
        debug ? responses : undefined
      );
    }

    const judge = await judgeResponsesWithClaude({
      userMessage: message,
      history,
      responses: successfulResponses,
      mode: "pro"
    });

    return toRouteResult(
      selectedModel,
      judge?.content ?? pickFallbackAnswer(successfulResponses),
      debug ? (judge ? [...responses, judge] : responses) : undefined
    );
  }

  const analyzerResult = await runAionAnalyzer(messages, message, history, attachments);

  return toRouteResult(
    selectedModel,
    analyzerResult.answer,
    debug ? analyzerResult.diagnostics : undefined
  );
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
