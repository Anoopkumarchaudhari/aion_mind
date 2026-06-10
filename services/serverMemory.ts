import type {
  GeneratedImage,
  LibraryItem,
  Notebook,
  StoredGeneratedImage,
  VideoJob,
  VideoStyle
} from "@/types/workspace";
import { persistGeneratedImageFile } from "@/services/generatedImageFiles";

type MemoryState = {
  library: Map<string, LibraryItem>;
  notebooks: Map<string, Notebook>;
  images: Map<string, StoredGeneratedImage>;
  videos: Map<string, VideoJob>;
};

const globalKey = "__aionMindServerMemory";

const memory: MemoryState =
  (globalThis as unknown as Record<string, MemoryState>)[globalKey] ??
  {
    library: new Map<string, LibraryItem>(),
    notebooks: new Map<string, Notebook>(),
    images: new Map<string, StoredGeneratedImage>(),
    videos: new Map<string, VideoJob>()
  };

(globalThis as unknown as Record<string, MemoryState>)[globalKey] = memory;

export function listLibraryItems() {
  return [...memory.library.values()].sort((left, right) => right.createdAt - left.createdAt);
}

export function saveLibraryItem(item: LibraryItem) {
  memory.library.set(item.id, item);
  return item;
}

export function patchLibraryItem(id: string, patch: Partial<LibraryItem>) {
  const existing = memory.library.get(id);

  if (!existing) {
    return null;
  }

  const next = { ...existing, ...patch, id };
  memory.library.set(id, next);
  return next;
}

export function deleteLibraryItem(id: string) {
  return memory.library.delete(id);
}

export function listNotebooks() {
  return [...memory.notebooks.values()].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function saveNotebook(notebook: Notebook) {
  memory.notebooks.set(notebook.id, notebook);
  return notebook;
}

export function getNotebook(id: string) {
  return memory.notebooks.get(id) ?? null;
}

export function patchNotebook(id: string, patch: Partial<Notebook>) {
  const existing = memory.notebooks.get(id);

  if (!existing) {
    return null;
  }

  const next = { ...existing, ...patch, id, updatedAt: Date.now() };
  memory.notebooks.set(id, next);
  return next;
}

export function deleteNotebook(id: string) {
  return memory.notebooks.delete(id);
}

export function saveGeneratedImage(image: StoredGeneratedImage): GeneratedImage {
  memory.images.set(image.id, image);

  try {
    persistGeneratedImageFile(image);
  } catch {
    // The in-memory copy still works for the current server process.
  }

  return toPublicImage(image);
}

export function getGeneratedImage(id: string) {
  return memory.images.get(id) ?? null;
}

export function createVideoJob(prompt: string, style: VideoStyle, duration: number) {
  const timestamp = Date.now();
  const id = crypto.randomUUID();
  const job: VideoJob = {
    id,
    prompt,
    style,
    duration,
    status: "queued",
    thumbnailUrl: createThumbnail(prompt, style),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  memory.videos.set(id, job);
  return job;
}

export function saveVideoJob(job: VideoJob) {
  memory.videos.set(job.id, job);
  return job;
}

export function patchVideoJob(id: string, patch: Partial<VideoJob>) {
  const existing = memory.videos.get(id);

  if (!existing) {
    return null;
  }

  const next: VideoJob = {
    ...existing,
    ...patch,
    id,
    updatedAt: Date.now()
  };
  memory.videos.set(id, next);
  return next;
}

export function getVideoJob(id: string) {
  return memory.videos.get(id) ?? null;
}

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

function toPublicImage(image: StoredGeneratedImage): GeneratedImage {
  const { base64: _base64, mimeType: _mimeType, sourceUrl: _sourceUrl, ...publicImage } = image;

  return publicImage;
}
