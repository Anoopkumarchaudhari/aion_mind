import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { listUserThreads, upsertUserThread, type PersistedThread } from "@/services/chatPersistence";
import { isAionModelId } from "@/types/aion";
import type { AttachmentKind, MessageAttachment } from "@/types/aion";

export const runtime = "nodejs";

const MAX_ATTACHMENT_PREVIEW_DATA_LENGTH = 750000;
const SUPPORTED_PREVIEW_PREFIX = /^data:image\/(?:png|jpe?g|webp|heic|heif);base64,/i;

type SaveChatBody = {
  thread?: unknown;
};

export async function GET() {
  try {
    const user = await requireCurrentUser();
    return NextResponse.json({ threads: await listUserThreads(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let body: SaveChatBody;

  try {
    body = (await request.json()) as SaveChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const thread = normalizeThread(body.thread);

  if (!thread) {
    return NextResponse.json({ error: "Chat thread is invalid" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUser();
    return NextResponse.json({ thread: await upsertUserThread(user.id, thread) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

function normalizeThread(value: unknown): PersistedThread | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id : "";
  const title = typeof item.title === "string" ? item.title.trim().slice(0, 120) : "";
  const model = isAionModelId(item.model) ? item.model : null;
  const createdAt = typeof item.createdAt === "number" ? item.createdAt : Date.now();
  const updatedAt = typeof item.updatedAt === "number" ? item.updatedAt : Date.now();
  const rawMessages = Array.isArray(item.messages) ? item.messages : [];

  if (!id || !title || !model) {
    return null;
  }

  return {
    id,
    title,
    model,
    createdAt,
    updatedAt,
    pinned: item.pinned === true,
    notebook: typeof item.notebook === "string" ? item.notebook.slice(0, 80) : undefined,
    messages: rawMessages.flatMap((message, index) => {
      if (!message || typeof message !== "object") {
        return [];
      }

      const candidate = message as Record<string, unknown>;
      const messageId = typeof candidate.id === "string" ? candidate.id : "";
      const role = candidate.role === "user" || candidate.role === "assistant" ? candidate.role : null;
      const content = typeof candidate.content === "string" ? candidate.content : "";

      if (!messageId || !role) {
        return [];
      }

      return [
        {
          id: messageId,
          role,
          content,
          createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : createdAt + index,
          model: isAionModelId(candidate.model) ? candidate.model : undefined,
          attachments: Array.isArray(candidate.attachments)
            ? candidate.attachments.slice(0, 5).map(normalizeMessageAttachment)
            : undefined,
          attachmentContext:
            typeof candidate.attachmentContext === "string"
              ? candidate.attachmentContext.slice(0, 12000)
              : undefined,
          diagnostics: Array.isArray(candidate.diagnostics) ? candidate.diagnostics : undefined
        }
      ];
    })
  };
}

function normalizeMessageAttachment(value: unknown): MessageAttachment {
  const attachment = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const kind: AttachmentKind | undefined =
    attachment.kind === "text" || attachment.kind === "image" || attachment.kind === "file"
      ? attachment.kind
      : undefined;
  const previewData =
    typeof attachment.previewData === "string" &&
    attachment.previewData.length <= MAX_ATTACHMENT_PREVIEW_DATA_LENGTH &&
    SUPPORTED_PREVIEW_PREFIX.test(attachment.previewData)
      ? attachment.previewData
      : undefined;
  const previewWidth = normalizePreviewDimension(attachment.previewWidth);
  const previewHeight = normalizePreviewDimension(attachment.previewHeight);

  return {
    id: String(attachment.id ?? ""),
    name: String(attachment.name ?? "attachment"),
    type: String(attachment.type ?? "text/plain"),
    size: Number(attachment.size ?? 0),
    kind,
    mimeType:
      kind === "image" && typeof attachment.mimeType === "string"
        ? attachment.mimeType.trim().slice(0, 120)
        : undefined,
    previewData,
    previewWidth,
    previewHeight
  };
}

function normalizePreviewDimension(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(4096, Math.round(value)))
    : undefined;
}

function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: "Database request failed." }, { status: 500 });
}
