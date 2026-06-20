import type {
  GeneratedImage,
  LibraryItem,
  LibraryItemType,
  Notebook,
  NotebookItem,
  StoredGeneratedImage,
  VideoJob,
  VideoStyle
} from "@/types/workspace";
import { query } from "@/services/db";
import { persistGeneratedImageFile } from "@/services/generatedImageFiles";

/*
 * User-scoped workspace persistence.
 *
 * Every read and write is keyed by `userId`, and every statement filters on
 * `user_id = $N`, so one account can never see or mutate another account's
 * library items, notebooks, generated images, or video jobs. Data lives in
 * Postgres (not process memory), so it survives restarts and is consistent
 * across multiple server instances.
 */

/* -------------------------------------------------------------------------- */
/* Library                                                                    */
/* -------------------------------------------------------------------------- */

type LibraryRow = {
  id: string;
  type: string;
  title: string;
  content: string | null;
  url: string | null;
  source_chat_id: string | null;
  source_message_id: string | null;
  language: string | null;
  created_at: string | number;
};

export async function listLibraryItems(userId: string): Promise<LibraryItem[]> {
  const result = await query<LibraryRow>(
    `SELECT id, type, title, content, url, source_chat_id, source_message_id, language, created_at
     FROM library_items
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows.map(toLibraryItem);
}

export async function saveLibraryItem(userId: string, item: LibraryItem): Promise<LibraryItem> {
  await query(
    `INSERT INTO library_items
       (id, user_id, type, title, content, url, source_chat_id, source_message_id, language, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       type = EXCLUDED.type,
       title = EXCLUDED.title,
       content = EXCLUDED.content,
       url = EXCLUDED.url,
       source_chat_id = EXCLUDED.source_chat_id,
       source_message_id = EXCLUDED.source_message_id,
       language = EXCLUDED.language
     WHERE library_items.user_id = $2`,
    [
      item.id,
      userId,
      item.type,
      item.title,
      item.content ?? null,
      item.url ?? null,
      item.sourceChatId ?? null,
      item.sourceMessageId ?? null,
      item.language ?? null,
      item.createdAt
    ]
  );

  return item;
}

export async function patchLibraryItem(
  userId: string,
  id: string,
  patch: Partial<LibraryItem>
): Promise<LibraryItem | null> {
  const existing = await query<LibraryRow>(
    `SELECT id, type, title, content, url, source_chat_id, source_message_id, language, created_at
     FROM library_items
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = existing.rows[0];

  if (!row) {
    return null;
  }

  const current = toLibraryItem(row);
  const next: LibraryItem = { ...current, ...patch, id };

  await query(
    `UPDATE library_items
     SET title = $1, content = $2, url = $3, language = $4
     WHERE id = $5 AND user_id = $6`,
    [next.title, next.content ?? null, next.url ?? null, next.language ?? null, id, userId]
  );

  return next;
}

export async function deleteLibraryItem(userId: string, id: string): Promise<boolean> {
  const result = await query("DELETE FROM library_items WHERE id = $1 AND user_id = $2", [id, userId]);
  return (result.rowCount ?? 0) > 0;
}

function toLibraryItem(row: LibraryRow): LibraryItem {
  return {
    id: row.id,
    type: row.type as LibraryItemType,
    title: row.title,
    content: row.content ?? undefined,
    url: row.url ?? undefined,
    sourceChatId: row.source_chat_id ?? undefined,
    sourceMessageId: row.source_message_id ?? undefined,
    language: row.language ?? undefined,
    createdAt: Number(row.created_at)
  };
}

/* -------------------------------------------------------------------------- */
/* Notebooks                                                                  */
/* -------------------------------------------------------------------------- */

type NotebookRow = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  items: NotebookItem[] | null;
  created_at: string | number;
  updated_at: string | number;
};

export async function listNotebooks(userId: string): Promise<Notebook[]> {
  const result = await query<NotebookRow>(
    `SELECT id, title, emoji, color, items, created_at, updated_at
     FROM notebooks
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );

  return result.rows.map(toNotebook);
}

export async function saveNotebook(userId: string, notebook: Notebook): Promise<Notebook> {
  await query(
    `INSERT INTO notebooks (id, user_id, title, emoji, color, items, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       emoji = EXCLUDED.emoji,
       color = EXCLUDED.color,
       items = EXCLUDED.items,
       updated_at = EXCLUDED.updated_at
     WHERE notebooks.user_id = $2`,
    [
      notebook.id,
      userId,
      notebook.title,
      notebook.emoji,
      notebook.color,
      JSON.stringify(notebook.items ?? []),
      notebook.createdAt,
      notebook.updatedAt
    ]
  );

  return notebook;
}

export async function getNotebook(userId: string, id: string): Promise<Notebook | null> {
  const result = await query<NotebookRow>(
    `SELECT id, title, emoji, color, items, created_at, updated_at
     FROM notebooks
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = result.rows[0];

  return row ? toNotebook(row) : null;
}

export async function patchNotebook(
  userId: string,
  id: string,
  patch: Partial<Notebook>
): Promise<Notebook | null> {
  const current = await getNotebook(userId, id);

  if (!current) {
    return null;
  }

  const next: Notebook = { ...current, ...patch, id, updatedAt: Date.now() };

  await query(
    `UPDATE notebooks
     SET title = $1, emoji = $2, color = $3, items = $4::jsonb, updated_at = $5
     WHERE id = $6 AND user_id = $7`,
    [next.title, next.emoji, next.color, JSON.stringify(next.items ?? []), next.updatedAt, id, userId]
  );

  return next;
}

export async function deleteNotebook(userId: string, id: string): Promise<boolean> {
  const result = await query("DELETE FROM notebooks WHERE id = $1 AND user_id = $2", [id, userId]);
  return (result.rowCount ?? 0) > 0;
}

function toNotebook(row: NotebookRow): Notebook {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    color: row.color,
    items: Array.isArray(row.items) ? row.items : [],
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

/* -------------------------------------------------------------------------- */
/* Generated images                                                           */
/* -------------------------------------------------------------------------- */

type GeneratedImageRow = {
  id: string;
  prompt: string;
  provider: string;
  model_key: string;
  model: string;
  aspect_ratio: string;
  size: string;
  quality: string;
  url: string;
  revised_prompt: string | null;
  mime_type: string;
  base64: string | null;
  source_url: string | null;
  created_at: string | number;
};

export async function saveGeneratedImage(
  userId: string,
  image: StoredGeneratedImage
): Promise<GeneratedImage> {
  await query(
    `INSERT INTO generated_images
       (id, user_id, prompt, provider, model_key, model, aspect_ratio, size, quality, url,
        revised_prompt, mime_type, base64, source_url, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (id) DO NOTHING`,
    [
      image.id,
      userId,
      image.prompt,
      image.provider,
      image.modelKey,
      image.model,
      image.aspectRatio,
      image.size,
      image.quality,
      image.url,
      image.revisedPrompt ?? null,
      image.mimeType,
      image.base64 ?? null,
      image.sourceUrl ?? null,
      image.createdAt
    ]
  );

  try {
    persistGeneratedImageFile(image);
  } catch {
    // The base64 copy stored in Postgres is the source of truth for serving.
  }

  return toPublicImage(image);
}

/** Fetch a generated image the user owns, including the bytes needed to serve it. */
export async function getGeneratedImage(
  userId: string,
  id: string
): Promise<StoredGeneratedImage | null> {
  const result = await query<GeneratedImageRow>(
    `SELECT id, prompt, provider, model_key, model, aspect_ratio, size, quality, url,
            revised_prompt, mime_type, base64, source_url, created_at
     FROM generated_images
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    provider: row.provider as StoredGeneratedImage["provider"],
    modelKey: row.model_key as StoredGeneratedImage["modelKey"],
    prompt: row.prompt,
    model: row.model,
    aspectRatio: row.aspect_ratio as StoredGeneratedImage["aspectRatio"],
    size: row.size,
    quality: row.quality as StoredGeneratedImage["quality"],
    url: row.url,
    revisedPrompt: row.revised_prompt ?? undefined,
    mimeType: row.mime_type,
    base64: row.base64 ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    createdAt: Number(row.created_at)
  };
}

function toPublicImage(image: StoredGeneratedImage): GeneratedImage {
  const { base64: _base64, mimeType: _mimeType, sourceUrl: _sourceUrl, ...publicImage } = image;

  return publicImage;
}

/* -------------------------------------------------------------------------- */
/* Video jobs                                                                 */
/* -------------------------------------------------------------------------- */

type VideoJobRow = {
  data: VideoJob;
};

export async function saveVideoJob(userId: string, job: VideoJob): Promise<VideoJob> {
  await query(
    `INSERT INTO video_jobs (id, user_id, data, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       data = EXCLUDED.data,
       updated_at = EXCLUDED.updated_at
     WHERE video_jobs.user_id = $2`,
    [job.id, userId, JSON.stringify(job), job.createdAt, job.updatedAt]
  );

  return job;
}

export async function patchVideoJob(
  userId: string,
  id: string,
  patch: Partial<VideoJob>
): Promise<VideoJob | null> {
  const existing = await getVideoJob(userId, id);

  if (!existing) {
    return null;
  }

  const next: VideoJob = { ...existing, ...patch, id, updatedAt: Date.now() };

  await query(
    `UPDATE video_jobs SET data = $1::jsonb, updated_at = $2 WHERE id = $3 AND user_id = $4`,
    [JSON.stringify(next), next.updatedAt, id, userId]
  );

  return next;
}

export async function getVideoJob(userId: string, id: string): Promise<VideoJob | null> {
  const result = await query<VideoJobRow>(
    "SELECT data FROM video_jobs WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  const row = result.rows[0];

  return row ? row.data : null;
}

/* -------------------------------------------------------------------------- */
/* Thumbnails (pure, stateless)                                               */
/* -------------------------------------------------------------------------- */

export function createVideoThumbnail(prompt: string, style: VideoStyle) {
  return createThumbnail(prompt, style);
}

function createThumbnail(prompt: string, style: VideoStyle) {
  const palette = {
    cinematic: ["#0f172a", "#10b981"],
    animated: ["#111827", "#06b6d4"],
    realistic: ["#171717", "#34d399"],
    abstract: ["#18181b", "#f472b6"]
  } satisfies Record<VideoStyle, [string, string]>;
  const [from, to] = palette[style];
  const title = escapeSvg(prompt.slice(0, 80) || "Aria Mind video");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
      <radialGradient id="r" cx="50%" cy="45%" r="50%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.34)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="960" height="540" fill="url(#g)"/>
    <circle cx="520" cy="250" r="220" fill="url(#r)"/>
    <text x="56" y="84" fill="#ecfeff" font-family="Inter, Arial" font-size="28" font-weight="700">Aria Mind Video</text>
    <text x="56" y="456" fill="#ffffff" font-family="Inter, Arial" font-size="34" font-weight="700">${title}</text>
    <text x="56" y="498" fill="rgba(255,255,255,0.72)" font-family="Inter, Arial" font-size="18">${style}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
