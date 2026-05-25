import { query } from "@/services/db";
import type { AionModelId, DebugDiagnostic, MessageAttachment } from "@/types/aion";

export type PersistedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  model?: AionModelId;
  attachments?: MessageAttachment[];
  attachmentContext?: string;
  diagnostics?: DebugDiagnostic[];
};

export type PersistedThread = {
  id: string;
  title: string;
  model: AionModelId;
  messages: PersistedMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  notebook?: string;
};

type ThreadRow = {
  id: string;
  title: string;
  model: AionModelId;
  pinned: boolean;
  notebook: string | null;
  created_at: string | number;
  updated_at: string | number;
};

type MessageRow = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  model: AionModelId | null;
  attachments: MessageAttachment[] | null;
  attachment_context: string | null;
  diagnostics: DebugDiagnostic[] | null;
  created_at: string | number;
};

export async function listUserThreads(userId: string) {
  const threadsResult = await query<ThreadRow>(
    `SELECT id, title, model, pinned, notebook, created_at, updated_at
     FROM chat_threads
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );
  const threadIds = threadsResult.rows.map((thread) => thread.id);
  const messagesByThread = new Map<string, PersistedMessage[]>();

  if (threadIds.length > 0) {
    const messagesResult = await query<MessageRow>(
      `SELECT id, thread_id, role, content, model, attachments, attachment_context, diagnostics, created_at
       FROM chat_messages
       WHERE thread_id = ANY($1::text[])
       ORDER BY position ASC`,
      [threadIds]
    );

    for (const message of messagesResult.rows) {
      const messages = messagesByThread.get(message.thread_id) ?? [];
      messages.push(toPersistedMessage(message));
      messagesByThread.set(message.thread_id, messages);
    }
  }

  return threadsResult.rows.map((thread) => toPersistedThread(thread, messagesByThread.get(thread.id) ?? []));
}

export async function upsertUserThread(userId: string, thread: PersistedThread) {
  await query(
    `INSERT INTO chat_threads (id, user_id, title, model, pinned, notebook, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       model = EXCLUDED.model,
       pinned = EXCLUDED.pinned,
       notebook = EXCLUDED.notebook,
       updated_at = EXCLUDED.updated_at`,
    [
      thread.id,
      userId,
      thread.title,
      thread.model,
      Boolean(thread.pinned),
      thread.notebook ?? null,
      thread.createdAt,
      thread.updatedAt
    ]
  );

  await query("DELETE FROM chat_messages WHERE thread_id = $1", [thread.id]);

  for (let index = 0; index < thread.messages.length; index += 1) {
    const message = thread.messages[index];

    await query(
      `INSERT INTO chat_messages
        (id, thread_id, role, content, model, attachments, attachment_context, diagnostics, created_at, position)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, $10)`,
      [
        message.id,
        thread.id,
        message.role,
        message.content,
        message.model ?? null,
        message.attachments ? JSON.stringify(message.attachments) : null,
        message.attachmentContext ?? null,
        message.diagnostics ? JSON.stringify(message.diagnostics) : null,
        message.createdAt,
        index
      ]
    );
  }

  return thread;
}

export async function patchUserThread(
  userId: string,
  threadId: string,
  patch: Partial<Pick<PersistedThread, "title" | "pinned" | "notebook" | "model" | "updatedAt">>
) {
  const current = await query<ThreadRow>(
    `SELECT id, title, model, pinned, notebook, created_at, updated_at
     FROM chat_threads
     WHERE id = $1 AND user_id = $2`,
    [threadId, userId]
  );
  const thread = current.rows[0];

  if (!thread) {
    return null;
  }

  const next = {
    title: patch.title ?? thread.title,
    model: patch.model ?? thread.model,
    pinned: patch.pinned ?? thread.pinned,
    notebook: patch.notebook ?? thread.notebook,
    updatedAt: patch.updatedAt ?? Date.now()
  };

  await query(
    `UPDATE chat_threads
     SET title = $1, model = $2, pinned = $3, notebook = $4, updated_at = $5
     WHERE id = $6 AND user_id = $7`,
    [next.title, next.model, next.pinned, next.notebook, next.updatedAt, threadId, userId]
  );

  return next;
}

export async function deleteUserThread(userId: string, threadId: string) {
  const result = await query("DELETE FROM chat_threads WHERE id = $1 AND user_id = $2", [
    threadId,
    userId
  ]);

  return (result.rowCount ?? 0) > 0;
}

function toPersistedThread(row: ThreadRow, messages: PersistedMessage[]): PersistedThread {
  return {
    id: row.id,
    title: row.title,
    model: row.model,
    messages,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    pinned: row.pinned,
    notebook: row.notebook ?? undefined
  };
}

function toPersistedMessage(row: MessageRow): PersistedMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: Number(row.created_at),
    model: row.model ?? undefined,
    attachments: row.attachments ?? undefined,
    attachmentContext: row.attachment_context ?? undefined,
    diagnostics: row.diagnostics ?? undefined
  };
}
