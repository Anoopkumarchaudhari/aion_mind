export type LibraryItemType = "chat" | "code" | "image" | "video" | "document";

export type LibraryItem = {
  id: string;
  type: LibraryItemType;
  title: string;
  content?: string;
  url?: string;
  sourceChatId?: string;
  sourceMessageId?: string;
  language?: string;
  createdAt: number;
};

export type ImageAspectRatio = "square" | "portrait" | "landscape";

export type ImageProvider = "openai" | "runware" | "google";

export type ImageModelKey = "default" | "pro";

export type ImageQuality = "auto" | "low" | "medium" | "high";

export type GeneratedImage = {
  id: string;
  provider: ImageProvider;
  modelKey: ImageModelKey;
  prompt: string;
  model: string;
  aspectRatio: ImageAspectRatio;
  size: string;
  quality: ImageQuality;
  url: string;
  revisedPrompt?: string;
  createdAt: number;
};

export type StoredGeneratedImage = GeneratedImage & {
  mimeType: string;
  base64?: string;
  sourceUrl?: string;
};

export type NotebookItem =
  | { kind: "chat"; chatId: string; order: number }
  | { kind: "library"; libraryItemId: string; order: number }
  | { kind: "note"; id: string; title: string; content: string; order: number };

export type Notebook = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  items: NotebookItem[];
  createdAt: number;
  updatedAt: number;
};

export type VideoStyle = "cinematic" | "animated" | "realistic" | "abstract";

export type VideoProvider = "runware" | "google";

export type VideoGenerationMode = "text" | "image";

export type VideoModelKey = "lite" | "default" | "pro";

export type VideoJobStatus = "queued" | "processing" | "succeeded" | "failed";

export type VideoJob = {
  id: string;
  provider?: VideoProvider;
  mode?: VideoGenerationMode;
  modelKey?: VideoModelKey;
  model?: string;
  taskUUID?: string;
  prompt: string;
  style: VideoStyle;
  duration: number;
  resolution?: string;
  status: VideoJobStatus;
  outputUrl?: string;
  thumbnailUrl?: string;
  inputImageUrl?: string;
  progress?: number;
  cost?: number;
  error?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};
