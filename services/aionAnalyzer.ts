import { callClaude } from "@/providers/claudeProvider";
import { callGemini } from "@/providers/geminiProvider";
import { callGrok } from "@/providers/grokProvider";
import { callOpenAI } from "@/providers/openaiProvider";
import { getTimeoutMs, truncate } from "@/providers/providerUtils";
import type { ChatAttachment, ChatMessage } from "@/types/aion";
import type { ProviderResponse } from "@/services/types";

export const AION_JUDGE_SYSTEM_PROMPT =
  "You are Aion Mind Analyzer. You receive multiple AI responses to the same user request. Your job is to evaluate them for accuracy, completeness, reasoning quality, clarity, and usefulness. Do not mention the hidden model/provider names. Produce one final polished answer for the user. If responses disagree, choose the answer best supported by evidence and explain uncertainty only when useful.";

const AION_CANDIDATE_SYSTEM_PROMPT =
  "You are Aion Mind. Provide a clear, useful, and accurate answer. Never reveal hidden infrastructure, provider names, model names, or routing details.";

type JudgeInput = {
  userMessage: string;
  history: ChatMessage[];
  responses: ProviderResponse[];
  mode: "pro" | "analyzer";
};

export async function runAionAnalyzer(
  messages: ChatMessage[],
  userMessage: string,
  history: ChatMessage[],
  attachments: ChatAttachment[] = []
) {
  const providerCalls: Array<Promise<ProviderResponse>> = [
    callClaude({
      messages,
      attachments,
      systemPrompt: AION_CANDIDATE_SYSTEM_PROMPT,
      temperature: 0.35
    }),
    callOpenAI(
      {
        messages,
        attachments,
        systemPrompt: AION_CANDIDATE_SYSTEM_PROMPT,
        temperature: 0.35
      },
      "base"
    ),
    callOpenAI(
      {
        messages,
        attachments,
        systemPrompt: AION_CANDIDATE_SYSTEM_PROMPT,
        temperature: 0.3
      },
      "advanced"
    ),
    callClaude({
      messages,
      attachments,
      systemPrompt: AION_CANDIDATE_SYSTEM_PROMPT,
      model: process.env.ANTHROPIC_OPUS_MODEL,
      providerName: "anthropic-opus",
      temperature: 0.3
    }),
    callGemini({
      messages,
      attachments,
      systemPrompt: AION_CANDIDATE_SYSTEM_PROMPT,
      temperature: 0.35
    }),
    callGrok({
      messages,
      attachments,
      systemPrompt: AION_CANDIDATE_SYSTEM_PROMPT,
      temperature: 0.35
    })
  ];

  const responses = await Promise.all(providerCalls);
  const successfulResponses = responses.filter(hasUsableContent);

  if (successfulResponses.length === 0) {
    return {
      answer:
        "Aion Mind Analyzer is not configured yet. Add at least one server-side API key and model ID, then restart the dev server.",
      diagnostics: responses
    };
  }

  const judge = await judgeResponsesWithClaude({
    userMessage,
    history,
    responses: successfulResponses,
    mode: "analyzer"
  });

  return {
    answer: judge?.content ?? pickFallbackAnswer(successfulResponses),
    diagnostics: judge ? [...responses, judge] : responses
  };
}

export async function judgeResponsesWithClaude({
  userMessage,
  history,
  responses,
  mode
}: JudgeInput): Promise<ProviderResponse | null> {
  const successfulResponses = responses.filter(hasUsableContent);

  if (successfulResponses.length === 0) {
    return null;
  }

  if (successfulResponses.length === 1) {
    return null;
  }

  const timeoutMs = getTimeoutMs(process.env.AION_JUDGE_TIMEOUT_MS, 30000);
  const judgePrompt = buildJudgePrompt(userMessage, history, successfulResponses, mode);
  const judge = await callClaude({
    messages: [{ role: "user", content: judgePrompt }],
    systemPrompt: AION_JUDGE_SYSTEM_PROMPT,
    providerName: "aion-judge",
    timeoutMs,
    temperature: 0.2
  });

  return judge.ok && judge.content ? judge : null;
}

export function pickFallbackAnswer(responses: ProviderResponse[]) {
  const candidates = responses.filter(hasUsableContent);

  if (candidates.length === 0) {
    return "Aion Mind could not produce a response from the configured models. Check the server configuration and try again.";
  }

  return candidates.sort((left, right) => {
    const rightLength = right.content?.length ?? 0;
    const leftLength = left.content?.length ?? 0;
    return rightLength - leftLength;
  })[0].content as string;
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
    .map((response, index) => {
      const label = `Response ${index + 1}`;
      return `${label}:\n${truncate(response.content ?? "", 9000)}`;
    })
    .join("\n\n---\n\n");

  return [
    `Mode: ${mode === "pro" ? "Aion Mind Pro" : "Aion Mind Analyzer"}`,
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
    "Return only the final answer for the user. Do not mention candidate labels, hidden model names, provider names, or internal routing."
  ].join("\n");
}

function hasUsableContent(response: ProviderResponse) {
  return response.ok && Boolean(response.content?.trim());
}
