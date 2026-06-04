import { callConfiguredModel } from "@/services/aionModelCalls";
import { loadAionRoutingSettings } from "@/services/aionRoutingConfig";
import { getTimeoutMs, truncate } from "@/providers/providerUtils";
import type { ChatAttachment, ChatMessage } from "@/types/aion";
import type { ProviderResponse } from "@/services/types";
import type { AionRouteSlot } from "@/types/aionRouting";

export const AION_JUDGE_SYSTEM_PROMPT =
  "You are Aion Mind Analyzer. You receive multiple AI responses to the same user request. Your job is to evaluate them for accuracy, completeness, reasoning quality, clarity, and usefulness. Do not mention the hidden model/provider names. Produce one final polished answer for the user. If responses disagree, choose the answer best supported by evidence and explain uncertainty only when useful.";

const AION_CANDIDATE_SYSTEM_PROMPT =
  "You are Aion Mind. Provide a clear, useful, and accurate answer in clean Markdown. Never reveal hidden infrastructure, provider names, model names, or routing details. When math is needed, use readable plain-text formulas such as `a_cm = (5/7) g sin(theta)` instead of LaTeX delimiters like $, \\(...\\), or \\[...\\]. Keep the structure concise: given values, method, final answer.";

type JudgeInput = {
  userMessage: string;
  history: ChatMessage[];
  responses: ProviderResponse[];
  mode: "pro" | "analyzer";
};

export type AnalyzerCandidateResult = {
  label: string;
  response: ProviderResponse;
};

export async function runAionAnalyzer(
  messages: ChatMessage[],
  userMessage: string,
  history: ChatMessage[],
  attachments: ChatAttachment[] = []
) {
  const routing = await loadAionRoutingSettings();
  const candidateResults = await Promise.all(
    routing.analyzer.candidates.map(async (slot) => ({
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
      answer:
        "Aion Mind Analyzer is not configured yet. Add at least one server-side API key and model ID, then restart the dev server.",
      diagnostics: responses
    };
  }

  const judge = await judgeResponsesWithConfiguredModel({
    userMessage,
    history,
    responses: successfulResponses,
    mode: "analyzer",
    judge: routing.analyzer.judge
  });

  return {
    answer: buildAnalyzerComparisonAnswer(
      candidateResults,
      judge?.content ?? pickFallbackAnswer(successfulResponses)
    ),
    diagnostics: judge ? [...responses, judge] : responses
  };
}

export async function judgeResponsesWithConfiguredModel({
  userMessage,
  history,
  responses,
  mode,
  judge
}: JudgeInput & { judge: AionRouteSlot }): Promise<ProviderResponse | null> {
  const successfulResponses = responses.filter(hasUsableContent);

  if (successfulResponses.length === 0) {
    return null;
  }

  if (successfulResponses.length === 1) {
    return null;
  }

  const timeoutMs = getTimeoutMs(process.env.AION_JUDGE_TIMEOUT_MS, 30000);
  const judgePrompt = buildJudgePrompt(userMessage, history, successfulResponses, mode);
  const judgedResponse = await callConfiguredModel(
    judge,
    {
      messages: [{ role: "user", content: judgePrompt }],
      systemPrompt: AION_JUDGE_SYSTEM_PROMPT,
      timeoutMs
    },
    "judge"
  );

  return judgedResponse.ok && judgedResponse.content ? judgedResponse : null;
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

export function buildAnalyzerComparisonAnswer(
  candidates: AnalyzerCandidateResult[],
  judgeAnswer: string
) {
  const candidateSections = candidates.map((candidate) => {
    const answer = candidate.response.ok
      ? candidate.response.content?.trim() || "No answer returned."
      : `No answer returned. ${candidate.response.error ?? "The request failed."}`;

    return [`### ${candidate.label}`, "", normalizeDisplayedAnswer(answer)].join("\n");
  });

  return [
    "## Candidate answers",
    "",
    ...candidateSections,
    "---",
    "## Judge answer",
    "",
    normalizeDisplayedAnswer(judgeAnswer)
  ].join("\n\n");
}

function normalizeDisplayedAnswer(value: string) {
  return value
    .trim()
    .split(/\r?\n/)
    .map(normalizeDisplayedLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeDisplayedLine(line: string) {
  const trimmed = line.trim();
  const mathBlock = trimmed.match(/^\[\s*(.+?)\s*\]$/);

  if (mathBlock && looksLikeMath(mathBlock[1])) {
    return `Formula: \`${normalizeMathText(mathBlock[1])}\``;
  }

  return normalizeMathText(line);
}

function looksLikeMath(value: string) {
  return /\\frac|\\sin|\\theta|_\{|\\text|\\boxed|\\times|\\cdot|=/.test(value);
}

function normalizeMathText(value: string) {
  let output = value
    .replace(/\\\[([\s\S]*?)\\\]/g, "$1")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\$(.*?)\$/g, "$1")
    .replace(/\\boxed\{([^{}]*)\}/g, "$1")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\mathrm\{([^{}]*)\}/g, "$1")
    .replace(/\\left|\\right/g, "");

  for (let index = 0; index < 6; index += 1) {
    output = output.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  }

  return output
    .replace(/([A-Za-z])_\{([^{}]+)\}/g, "$1_$2")
    .replace(/([A-Za-z])_([A-Za-z0-9]+)/g, "$1_$2")
    .replace(/\\sin/g, "sin")
    .replace(/\\theta/g, "theta")
    .replace(/\^\s*\\circ/g, "°")
    .replace(/\\times|\\cdot/g, "x")
    .replace(/\\approx/g, "≈")
    .replace(/\\qquad|\\quad/g, " ")
    .replace(/\\\s/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
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
    "Return only the final answer for the user. Do not mention candidate labels, hidden model names, provider names, or internal routing.",
    "Use clean Markdown. Avoid LaTeX delimiters like $, \\(...\\), or \\[...\\]. Write formulas in readable plain text such as `a_cm = (5/7) g sin(theta)`."
  ].join("\n");
}

function hasUsableContent(response: ProviderResponse) {
  return response.ok && Boolean(response.content?.trim());
}
