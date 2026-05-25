import { isDatabaseConfigured, query } from "@/services/db";
import type { ChatAttachment, ChatMessage } from "@/types/aion";

const MAX_SEARCH_ROWS = 220;
const MAX_TOKENS = 12;
const MAX_CONTEXT_ITEMS = 6;
const MAX_SNIPPET_LENGTH = 900;
const MAX_CONTEXT_LENGTH = 5200;
const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "could",
  "from",
  "have",
  "hello",
  "helo",
  "hey",
  "into",
  "like",
  "need",
  "namaste",
  "please",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "what",
  "when",
  "where",
  "with",
  "would",
  "your"
]);

type MemoryRow = {
  thread_id: string;
  title: string;
  role: "user" | "assistant";
  content: string;
  attachment_context: string | null;
  created_at: string | number;
  updated_at: string | number;
};

type MemoryCandidate = MemoryRow & {
  score: number;
};

export async function buildRelevantMemoryContext({
  userId,
  message,
  history,
  attachments,
  currentThreadId,
  ephemeral
}: {
  userId: string;
  message: string;
  history: ChatMessage[];
  attachments: ChatAttachment[];
  currentThreadId?: string;
  ephemeral: boolean;
}) {
  if (ephemeral || !isDatabaseConfigured()) {
    return "";
  }

  const tokens = getSearchTokens(
    [
      message,
      history.slice(-4).map((item) => item.content).join(" "),
      attachments.map((item) => `${item.name} ${item.content}`).join(" ")
    ].join(" ")
  );

  if (tokens.length === 0) {
    return "";
  }

  try {
    const result = await query<MemoryRow>(
      `SELECT chat_messages.thread_id,
              chat_threads.title,
              chat_messages.role,
              chat_messages.content,
              chat_messages.attachment_context,
              chat_messages.created_at,
              chat_threads.updated_at
       FROM chat_messages
       INNER JOIN chat_threads ON chat_threads.id = chat_messages.thread_id
       WHERE chat_threads.user_id = $1
         AND ($2::text IS NULL OR chat_messages.thread_id <> $2)
         AND length(trim(chat_messages.content)) > 0
       ORDER BY chat_threads.updated_at DESC, chat_messages.created_at DESC
       LIMIT $3`,
      [userId, currentThreadId ?? null, MAX_SEARCH_ROWS]
    );

    const matches = result.rows
      .map((row) => ({ ...row, score: scoreMemory(row, tokens) }))
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score || Number(right.created_at) - Number(left.created_at))
      .slice(0, MAX_CONTEXT_ITEMS);

    return formatMemoryContext(matches);
  } catch {
    return "";
  }
}

export function mergeMemoryIntoMessage(message: string, memoryContext: string) {
  if (!memoryContext) {
    return message;
  }

  return [
    message,
    "",
    "Relevant saved workspace memory:",
    memoryContext,
    "",
    "Use the saved memory only when it helps answer the user's request. Do not mention memory unless the user asks."
  ].join("\n");
}

function scoreMemory(row: MemoryRow, tokens: string[]) {
  const haystack = normalizeSearchText(
    [row.title, row.role, row.content, row.attachment_context ?? ""].join(" ")
  );
  let score = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += token.length > 6 ? 3 : 2;
    }
  }

  if (row.role === "user") {
    score += 1;
  }

  const ageDays = Math.max(0, (Date.now() - Number(row.updated_at)) / 86_400_000);
  return score + Math.max(0, 1.5 - ageDays / 30);
}

function formatMemoryContext(matches: MemoryCandidate[]) {
  let remaining = MAX_CONTEXT_LENGTH;
  const lines: string[] = [];

  for (const match of matches) {
    if (remaining <= 0) {
      break;
    }

    const snippet = truncate(cleanSnippet(match.content), Math.min(MAX_SNIPPET_LENGTH, remaining));
    const line = `- ${match.role} in "${truncate(match.title, 80)}": ${snippet}`;

    lines.push(line);
    remaining -= line.length;
  }

  return lines.join("\n");
}

function getSearchTokens(value: string) {
  const counts = new Map<string, number>();

  for (const token of normalizeSearchText(value).split(/\s+/)) {
    if (token.length < 3 || STOP_WORDS.has(token)) {
      continue;
    }

    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)
    .map(([token]) => token)
    .slice(0, MAX_TOKENS);
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSnippet(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...` : value;
}
