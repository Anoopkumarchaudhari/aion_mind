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

export type VideoJobStatus = "queued" | "processing" | "succeeded" | "failed";

export type VideoJob = {
  id: string;
  prompt: string;
  style: VideoStyle;
  duration: number;
  status: VideoJobStatus;
  outputUrl?: string;
  thumbnailUrl?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};
