import { callClaude, streamClaude } from "@/providers/claudeProvider";
import { callDeepSeek } from "@/providers/deepseekProvider";
import { callGemini, streamGemini } from "@/providers/geminiProvider";
import { callGrok } from "@/providers/grokProvider";
import { callOpenAI, streamOpenAI } from "@/providers/openaiProvider";
import type {
  ProviderCallOptions,
  ProviderName,
  ProviderResponse,
  ProviderStreamResponse
} from "@/services/types";
import type { AionRouteSlot } from "@/types/aionRouting";

type RoutingRole = "candidate" | "judge";

export async function callConfiguredModel(
  slot: AionRouteSlot,
  options: Omit<ProviderCallOptions, "model" | "temperature" | "providerName">,
  role: RoutingRole = "candidate"
): Promise<ProviderResponse> {
  if (!slot.enabled) {
    return disabledResponse(slot, role);
  }

  const callOptions = toProviderOptions(slot, options);

  switch (slot.provider) {
    case "openai":
      return callOpenAI(callOptions, getOpenAIVariant(slot, role));
    case "anthropic":
      return callClaude({
        ...callOptions,
        providerName: getAnthropicProviderName(slot, role)
      });
    case "deepseek":
      return callDeepSeek(callOptions);
    case "gemini":
      return callGemini(callOptions);
    case "grok":
      return callGrok(callOptions);
  }
}

export async function streamConfiguredModel(
  slot: AionRouteSlot,
  options: Omit<ProviderCallOptions, "model" | "temperature" | "providerName">,
  role: RoutingRole = "candidate"
): Promise<ProviderStreamResponse> {
  if (!slot.enabled) {
    return {
      ...disabledResponse(slot, role),
      stream: undefined
    };
  }

  const callOptions = toProviderOptions(slot, options);

  switch (slot.provider) {
    case "openai":
      return streamOpenAI(callOptions, getOpenAIVariant(slot, role));
    case "anthropic":
      return streamClaude({
        ...callOptions,
        providerName: getAnthropicProviderName(slot, role)
      });
    case "deepseek": {
      const response = await callDeepSeek(callOptions);

      return {
        ...response,
        stream: response.ok && response.content ? streamText(response.content) : undefined
      };
    }
    case "gemini":
      return streamGemini(callOptions);
    case "grok": {
      const response = await callGrok(callOptions);

      return {
        ...response,
        stream: response.ok && response.content ? streamText(response.content) : undefined
      };
    }
  }
}

function toProviderOptions(
  slot: AionRouteSlot,
  options: Omit<ProviderCallOptions, "model" | "temperature" | "providerName">
): ProviderCallOptions {
  return {
    ...options,
    model: slot.model || undefined,
    temperature: slot.temperature
  };
}

function getOpenAIVariant(slot: AionRouteSlot, role: RoutingRole) {
  if (role === "judge") {
    return "judge";
  }

  return slot.id.includes("advanced") ? "advanced" : "base";
}

function getAnthropicProviderName(slot: AionRouteSlot, role: RoutingRole): ProviderName {
  if (role === "judge") {
    return "aion-judge";
  }

  return slot.id.includes("opus") ? "anthropic-opus" : "anthropic";
}

function disabledResponse(slot: AionRouteSlot, role: RoutingRole): ProviderResponse {
  return {
    provider: getDiagnosticProviderName(slot, role),
    model: slot.model,
    ok: false,
    skipped: true,
    error: "Disabled in model routing",
    latencyMs: 0
  };
}

function getDiagnosticProviderName(slot: AionRouteSlot, role: RoutingRole): ProviderName {
  if (role === "judge") {
    return "aion-judge";
  }

  switch (slot.provider) {
    case "openai":
      return slot.id.includes("advanced") ? "openai-advanced" : "openai";
    case "anthropic":
      return slot.id.includes("opus") ? "anthropic-opus" : "anthropic";
    case "deepseek":
      return "deepseek";
    case "gemini":
      return "gemini";
    case "grok":
      return "grok";
  }
}

async function* streamText(value: string) {
  yield value;
}
