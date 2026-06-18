import { NextResponse } from "next/server";
import { buildRelevantMemoryContext, mergeMemoryIntoMessage } from "@/services/aionMemory";
import { getCurrentUser } from "@/services/auth";
import { isAionModelId, isAionResearchModelId, isAriaDiverseProvider } from "@/types/aion";
import type { AriaDiverseProvider, ChatAttachment, ChatMessage } from "@/types/aion";
import { routeAionStream } from "@/services/streamRouter";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 12000;
const MAX_HISTORY_ITEMS = 50;
const MAX_HISTORY_CONTENT_LENGTH = 6000;
const MAX_HISTORY_TOTAL_LENGTH = 30000;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_CONTENT_LENGTH = 12000;
const MAX_ATTACHMENT_TOTAL_LENGTH = 24000;
const MAX_IMAGE_DATA_LENGTH = 7 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif"
]);

type RawChatBody = {
  message?: unknown;
  selectedModel?: unknown;
  researchModel?: unknown;
  diverseProviders?: unknown;
  researchProvider?: unknown;
  model?: unknown;
  history?: unknown;
  attachments?: unknown;
  debug?: unknown;
  ephemeral?: unknown;
  threadId?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: RawChatBody;

  try {
    body = (await request.json()) as RawChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateRequestBody(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const debug =
    process.env.AION_DEBUG === "true" &&
    process.env.NEXT_PUBLIC_AION_DEBUG === "true" &&
    body.debug === true;

  const memoryContext = await buildRelevantMemoryContext({
    userId: user.id,
    message: validation.message,
    history: validation.history,
    attachments: validation.attachments,
    currentThreadId: validation.threadId,
    ephemeral: validation.ephemeral
  });
  const messageWithMemory = mergeMemoryIntoMessage(validation.message, memoryContext);

  return routeAionStream({
    message: withAttachmentContext(messageWithMemory, validation.attachments),
    searchQuery: validation.message,
    selectedModel: validation.selectedModel,
    researchModel: validation.researchModel,
    diverseProviders: validation.diverseProviders,
    researchProvider: validation.researchProvider,
    history: validation.history,
    attachments: validation.attachments,
    debug
  });
}

function validateRequestBody(body: RawChatBody):
  | {
      ok: true;
      message: string;
      selectedModel: NonNullable<RawChatBody["selectedModel"]> & ReturnType<typeof normalizeModel>;
      researchModel?: NonNullable<RawChatBody["researchModel"]> & ReturnType<typeof normalizeResearchModel>;
      diverseProviders?: AriaDiverseProvider[];
      researchProvider?: AriaDiverseProvider;
      history: ChatMessage[];
      attachments: ChatAttachment[];
      ephemeral: boolean;
      threadId?: string;
    }
  | { ok: false; error: string } {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const model = normalizeModel(body.selectedModel ?? body.model);
  const researchModel = normalizeResearchModel(body.researchModel);
  const diverseProviders = normalizeDiverseProviders(body.diverseProviders);
  const researchProvider = normalizeDiverseProvider(body.researchProvider);
  const attachments = normalizeAttachments(body.attachments);

  if (!attachments) {
    return { ok: false, error: "Attachments are invalid" };
  }

  if (!message && attachments.length === 0) {
    return { ok: false, error: "Message is required" };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "Message is too long" };
  }

  if (!model) {
    return { ok: false, error: "Selected model is invalid" };
  }

  const history = normalizeHistory(body.history);
  const ephemeral = body.ephemeral === true;
  const threadId = typeof body.threadId === "string" ? body.threadId.trim().slice(0, 120) : undefined;

  if (!history) {
    return { ok: false, error: "Chat history is invalid" };
  }

  return {
    ok: true,
    message: message || "Please review the attached file(s).",
    selectedModel: model,
    researchModel: model === "aion-mind-pro" ? researchModel ?? "gpt-5.5" : undefined,
    diverseProviders:
      model === "aria-diverse" ? (diverseProviders.length > 0 ? diverseProviders : ["openai"]) : undefined,
    researchProvider: model === "aion-mind-pro" ? researchProvider ?? "openai" : undefined,
    history,
    attachments,
    ephemeral,
    threadId
  };
}

function normalizeModel(value: unknown) {
  return isAionModelId(value) ? value : null;
}

function normalizeResearchModel(value: unknown) {
  return isAionResearchModelId(value) ? value : null;
}

function normalizeDiverseProvider(value: unknown) {
  return isAriaDiverseProvider(value) ? value : null;
}

function normalizeDiverseProviders(value: unknown): AriaDiverseProvider[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<AriaDiverseProvider>();

  for (const item of value) {
    if (isAriaDiverseProvider(item)) {
      seen.add(item);
    }
  }

  // Cap at 5 selections (we only have 4 providers, but keep the guard explicit).
  return Array.from(seen).slice(0, 5);
}

function normalizeHistory(value: unknown): ChatMessage[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_HISTORY_ITEMS) {
    return null;
  }

  const history: ChatMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const role = "role" in item ? item.role : undefined;
    const content = "content" in item ? item.content : undefined;

    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return null;
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      continue;
    }

    history.push({
      role,
      content: trimmedContent.slice(0, MAX_HISTORY_CONTENT_LENGTH)
    });
  }

  return trimHistoryToBudget(history);
}

function normalizeAttachments(value: unknown): ChatAttachment[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) {
    return null;
  }

  const attachments: ChatAttachment[] = [];
  let remaining = MAX_ATTACHMENT_TOTAL_LENGTH;

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const id = "id" in item ? item.id : undefined;
    const name = "name" in item ? item.name : undefined;
    const type = "type" in item ? item.type : undefined;
    const size = "size" in item ? item.size : undefined;
    const content = "content" in item ? item.content : undefined;
    const kind = "kind" in item ? item.kind : undefined;
    const data = "data" in item ? item.data : undefined;
    const mimeType = "mimeType" in item ? item.mimeType : undefined;

    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      typeof type !== "string" ||
      typeof size !== "number" ||
      !Number.isFinite(size) ||
      typeof content !== "string"
    ) {
      return null;
    }

    const cleanKind = kind === "image" || kind === "text" || kind === "file" ? kind : undefined;
    const cleanMimeType =
      typeof mimeType === "string" && mimeType.trim() ? mimeType.trim().slice(0, 120) : type.trim().slice(0, 120);
    const imageData = typeof data === "string" ? data.trim() : undefined;

    if (
      cleanKind === "image" &&
      (!imageData ||
        imageData.length > MAX_IMAGE_DATA_LENGTH ||
        !SUPPORTED_IMAGE_TYPES.has(cleanMimeType))
    ) {
      return null;
    }

    if (remaining <= 0 && cleanKind !== "image") {
      return null;
    }

    const contentBudget =
      cleanKind === "image" ? MAX_ATTACHMENT_CONTENT_LENGTH : Math.min(MAX_ATTACHMENT_CONTENT_LENGTH, remaining);
    const cleanContent = content.trim().slice(0, contentBudget);

    if (!cleanContent) {
      continue;
    }

    attachments.push({
      id: id.slice(0, 80),
      name: name.trim().slice(0, 180) || "attachment",
      type: type.trim().slice(0, 120) || "text/plain",
      size: Math.max(0, Math.floor(size)),
      kind: cleanKind,
      mimeType: cleanKind === "image" ? cleanMimeType : undefined,
      data: cleanKind === "image" ? imageData : undefined,
      content: cleanContent
    });

    remaining -= cleanKind === "image" ? 0 : cleanContent.length;
  }

  return attachments;
}

function withAttachmentContext(message: string, attachments: ChatAttachment[]) {
  if (attachments.length === 0) {
    return message;
  }

  const context = attachments
    .map(
      (attachment, index) =>
        `Attachment ${index + 1}: ${attachment.name} (${attachment.type}, ${formatBytes(
          attachment.size
        )})\n${attachment.content}`
    )
    .join("\n\n---\n\n");

  return [
    message,
    "",
    "Use the following uploaded file content as context. Cite file names when useful.",
    "",
    context
  ].join("\n");
}

function trimHistoryToBudget(history: ChatMessage[]) {
  const trimmed: ChatMessage[] = [];
  let remaining = MAX_HISTORY_TOTAL_LENGTH;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];

    if (remaining <= 0) {
      break;
    }

    const content =
      message.content.length > remaining
        ? message.content.slice(message.content.length - remaining)
        : message.content;

    trimmed.unshift({
      role: message.role,
      content
    });

    remaining -= content.length;
  }

  return trimmed;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
