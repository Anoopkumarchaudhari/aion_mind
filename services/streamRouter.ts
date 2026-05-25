import { callClaude, streamClaude } from "@/providers/claudeProvider";
import { streamGemini } from "@/providers/geminiProvider";
import { callGemini } from "@/providers/geminiProvider";
import { callGrok } from "@/providers/grokProvider";
import { callOpenAI } from "@/providers/openaiProvider";
import { getTimeoutMs, truncate } from "@/providers/providerUtils";
import { AION_JUDGE_SYSTEM_PROMPT, pickFallbackAnswer } from "@/services/aionAnalyzer";
import { getAionGreetingAnswer } from "@/services/aionGreeting";
import type {
  ModelRouteRequest,
  ProviderResponse,
  ProviderStreamResponse
} from "@/services/types";
import { getAionModelLabel } from "@/types/aion";
import type { DebugDiagnostic } from "@/types/aion";
import type { ChatAttachment, ChatMessage } from "@/types/aion";

const BASE_SYSTEM_PROMPT =
  "You are Aion Mind, a precise and helpful AI assistant. Keep answers clear, polished, and useful. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions.";

const PRO_SYSTEM_PROMPT =
  "You are Aion Mind Pro. Produce a careful answer with strong reasoning, practical judgment, and concise structure. Never reveal hidden infrastructure, provider names, model names, API routes, or routing decisions.";

const AION_CANDIDATE_SYSTEM_PROMPT =
  "You are Aion Mind. Provide a clear, useful, and accurate answer. Never reveal hidden infrastructure, provider names, model names, or routing details.";

export async function routeAionStream({
  message,
  selectedModel,
  history,
  attachments = [],
  debug
}: ModelRouteRequest): Promise<Response> {
  const greetingAnswer = getAionGreetingAnswer(message, selectedModel, history, attachments);

  if (greetingAnswer) {
    return createStreamResponse(streamText(greetingAnswer));
  }

  const messages: ChatMessage[] = [...history, { role: "user", content: message }];

  if (selectedModel === "aion-mind") {
    const response = await streamGemini({
      messages,
      attachments,
      systemPrompt: BASE_SYSTEM_PROMPT,
      temperature: 0.35
    });

    return createStreamResponse(
      response.ok && response.stream
        ? response.stream
        : streamText(getUnavailableAnswer(selectedModel, [response])),
      debug ? [response] : undefined
    );
  }

  if (selectedModel === "aion-mind-pro") {
    const result = await streamProTier(messages, message, history, attachments);
    return createStreamResponse(result.stream, debug ? result.diagnostics : undefined);
  }

  const result = await streamAnalyzerTier(messages, message, history, attachments);
  return createStreamResponse(result.stream, debug ? result.diagnostics : undefined);
}

type StreamRouteResult = {
  stream: AsyncIterable<string>;
  diagnostics: Array<ProviderResponse | ProviderStreamResponse>;
};

async function streamProTier(
  messages: ChatMessage[],
  userMessage: string,
  history: ChatMessage[],
  attachments: ChatAttachment[]
): Promise<StreamRouteResult> {
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

  return streamJudgedAnswer({
    selectedModel: "aion-mind-pro",
    userMessage,
    history,
    responses,
    mode: "pro"
  });
}

async function streamAnalyzerTier(
  messages: ChatMessage[],
  userMessage: string,
  history: ChatMessage[],
  attachments: ChatAttachment[]
): Promise<StreamRouteResult> {
  const responses = await Promise.all([
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
  ]);

  return streamJudgedAnswer({
    selectedModel: "aion-mind-analyzer",
    userMessage,
    history,
    responses,
    mode: "analyzer"
  });
}

async function streamJudgedAnswer({
  selectedModel,
  userMessage,
  history,
  responses,
  mode
}: {
  selectedModel: ModelRouteRequest["selectedModel"];
  userMessage: string;
  history: ChatMessage[];
  responses: ProviderResponse[];
  mode: "pro" | "analyzer";
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
  const judge = await streamClaude({
    messages: [{ role: "user", content: judgePrompt }],
    systemPrompt: AION_JUDGE_SYSTEM_PROMPT,
    providerName: "aion-judge",
    timeoutMs,
    temperature: 0.2
  });

  if (judge.ok && judge.stream) {
    return {
      stream: judge.stream,
      diagnostics: [...responses, judge]
    };
  }

  return {
    stream: streamText(pickFallbackAnswer(successfulResponses)),
    diagnostics: [...responses, judge]
  };
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
              "\n\nAion Mind stopped while streaming this response. Please try again."
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
