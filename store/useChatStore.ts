"use client";

import { create } from "zustand";
import type {
  AionModelId,
  AionResearchModelId,
  AriaDiverseProvider,
  ChatAttachment,
  DebugDiagnostic,
  MessageAttachment,
  WebSearchActivity,
  WorkLogItem
} from "@/types/aion";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  model?: AionModelId;
  attachments?: MessageAttachment[];
  attachmentContext?: string;
  diagnostics?: DebugDiagnostic[];
  webSearchActivity?: WebSearchActivity;
  workLog?: WorkLogItem[];
};

export type ChatThread = {
  id: string;
  title: string;
  model: AionModelId;
  messages: UiMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  notebook?: string;
};

export type ChatToast = {
  id: string;
  message: string;
  actionLabel?: string;
  action?: "undo-delete";
};

type SendMessageOptions = {
  debug: boolean;
  attachments?: ChatAttachment[];
  selectedModel?: AionModelId;
  researchModel?: AionResearchModelId;
  diverseProviders?: AriaDiverseProvider[];
  researchProvider?: AriaDiverseProvider;
};

type ChatState = {
  threads: ChatThread[];
  activeThreadId: string;
  selectedModel: AionModelId;
  tempMode: boolean;
  tempThread: ChatThread;
  lastPersistedThreadId: string;
  isLoading: boolean;
  hydrated: boolean;
  toast: ChatToast | null;
  notebooks: string[];
  hydrate: () => Promise<void>;
  createOrFocusNewChat: (model?: AionModelId) => string;
  selectThread: (threadId: string) => void;
  setSelectedModel: (model: AionModelId) => void;
  toggleTempMode: () => void;
  sendMessage: (content: string, options: SendMessageOptions) => Promise<void>;
  stopGeneration: () => void;
  shareThread: (threadId: string) => Promise<void>;
  togglePin: (threadId: string) => Promise<void>;
  renameThread: (threadId: string, title: string) => Promise<void>;
  addToNotebook: (threadId: string, notebook: string) => void;
  createNotebook: (name: string) => void;
  deleteThread: (threadId: string) => Promise<void>;
  undoDelete: () => void;
  clearToast: () => void;
};

const STORAGE_KEY = "aion-mind-chats";
const TEMP_CHAT_ID = "aion-temp-chat";
const DEFAULT_NOTEBOOKS = ["Research", "Ideas", "Tasks"];
const STREAM_RENDER_INTERVAL_MS = 18;
const STREAM_MIN_NATURAL_BREAK_INDEX = 5;
const MAX_WORK_LOG_ITEMS = 4;
const RESEARCH_STEP_DELAY_MS = 3000;
const CLIENT_WEB_SEARCH_INTENT_PATTERN =
  /\b(?:web search|search the web|google|look up|browse|internet|online|sources?|citations?|cite|research)\b/i;
const CLIENT_LIVE_FACT_PATTERN =
  /\b(?:current|currently|latest|today|tonight|now|recent|updated|live|breaking|this week|this month|this year|price|weather|forecast|score|schedule|election|result|law|rule|regulation|release|version|ceo|president|prime minister|chief minister|stock|crypto)\b/i;
const CLIENT_POLITICAL_CM_PATTERN =
  /\b(?:cm\s+of|(?:state|bihar|delhi|uttar pradesh|madhya pradesh|maharashtra|karnataka|tamil nadu|west bengal|punjab|rajasthan|gujarat|kerala|odisha|andhra pradesh|telangana|uttarakhand|jharkhand|haryana|assam|goa|manipur|tripura|sikkim|meghalaya|nagaland|mizoram|arunachal pradesh|chhattisgarh)\s+cm)\b/i;
const CLIENT_QUESTION_PATTERN =
  /\b(?:who|what|when|where|which|is|are|was|were|did|does|do|has|have|can you tell|give me|show me)\b/i;
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let lastDeletedThread: ChatThread | null = null;
let activeAbortController: AbortController | null = null;
let activeStreamSmoother: AssistantStreamSmoother | null = null;
let activeResearchWorkLogFlow: ResearchWorkLogFlow | null = null;
let hydratePromise: Promise<void> | null = null;

const initialThread = createThread("aria-instant");

export const useChatStore = create<ChatState>((set, get) => ({
  threads: [initialThread],
  activeThreadId: initialThread.id,
  selectedModel: "aria-instant",
  tempMode: false,
  tempThread: createTempThread("aria-instant"),
  lastPersistedThreadId: initialThread.id,
  isLoading: false,
  hydrated: false,
  toast: null,
  notebooks: DEFAULT_NOTEBOOKS,

  async hydrate() {
    if (get().hydrated) {
      return;
    }

    if (hydratePromise) {
      return hydratePromise;
    }

    hydratePromise = (async () => {
      const localThreads = readThreads();
      const serverThreads = await readServerThreads();
      const threads = serverThreads && serverThreads.length > 0 ? serverThreads : localThreads;
      const dedupedThreads = dedupeDefaultEmptyThreads(threads);
      const nextThreads = dedupedThreads.length > 0 ? sortThreads(dedupedThreads) : [createThread("aria-instant")];
      const activeThread = nextThreads[0];

      persistThreads(nextThreads);

      set({
        threads: nextThreads,
        activeThreadId: activeThread.id,
        selectedModel: activeThread.model,
        lastPersistedThreadId: activeThread.id,
        hydrated: true
      });
    })().finally(() => {
      hydratePromise = null;
    });

    return hydratePromise;
  },

  createOrFocusNewChat(model) {
    const state = get();
    const selectedModel = model ?? state.selectedModel;

    if (state.tempMode) {
      set({
        activeThreadId: TEMP_CHAT_ID,
        selectedModel,
        tempThread: createTempThread(selectedModel)
      });
      return TEMP_CHAT_ID;
    }

    const activeThread = state.threads.find((thread) => thread.id === state.activeThreadId);

    if (activeThread && isDefaultEmptyThread(activeThread)) {
      dispatchAlreadyOnNewChat();
      return activeThread.id;
    }

    const dedupedThreads = dedupeDefaultEmptyThreads(state.threads);
    const existingEmpty = dedupedThreads.find(isDefaultEmptyThread);

    if (existingEmpty) {
      if (dedupedThreads.length !== state.threads.length) {
        persistThreads(dedupedThreads);
      }

      set({
        threads: dedupedThreads,
        activeThreadId: existingEmpty.id,
        selectedModel: existingEmpty.model,
        lastPersistedThreadId: existingEmpty.id,
        tempMode: false,
        tempThread: createTempThread(existingEmpty.model)
      });
      return existingEmpty.id;
    }

    const thread = createThread(selectedModel);
    const threads = sortThreads([thread, ...dedupedThreads]);

    persistThreads(threads);
    set({
      threads,
      activeThreadId: thread.id,
      selectedModel,
      lastPersistedThreadId: thread.id,
      tempMode: false,
      tempThread: createTempThread(selectedModel)
    });
    return thread.id;
  },

  selectThread(threadId) {
    const thread = get().threads.find((item) => item.id === threadId);

    if (!thread) {
      return;
    }

    set({
      activeThreadId: thread.id,
      selectedModel: thread.model,
      lastPersistedThreadId: thread.id,
      tempMode: false,
      tempThread: createTempThread(thread.model)
    });
  },

  setSelectedModel(model) {
    if (get().tempMode) {
      set((state) => ({
        selectedModel: model,
        tempThread: { ...state.tempThread, model, updatedAt: Date.now() }
      }));
      return;
    }

    const threads = get().threads.map((thread) =>
      thread.id === get().activeThreadId ? { ...thread, model, updatedAt: Date.now() } : thread
    );

    persistThreads(threads);
    set({ threads, selectedModel: model });
  },

  toggleTempMode() {
    const state = get();

    if (state.tempMode) {
      const fallback = state.threads.find((thread) => thread.id === state.lastPersistedThreadId) ?? state.threads[0];

      if (fallback) {
        set({
          tempMode: false,
          activeThreadId: fallback.id,
          selectedModel: fallback.model,
          tempThread: createTempThread(fallback.model)
        });
        return;
      }

      const thread = createThread(state.selectedModel);
      persistThreads([thread]);
      set({
        threads: [thread],
        activeThreadId: thread.id,
        selectedModel: thread.model,
        tempMode: false,
        tempThread: createTempThread(thread.model)
      });
      return;
    }

    set({
      tempMode: true,
      lastPersistedThreadId: state.activeThreadId,
      activeThreadId: TEMP_CHAT_ID,
      tempThread: createTempThread(state.selectedModel)
    });
  },

  async sendMessage(
    content,
    { debug, attachments = [], selectedModel: modelOverride, researchModel, diverseProviders, researchProvider }
  ) {
    const trimmed = content.trim();
    const state = get();
    const messageText = trimmed || (attachments.length > 0 ? "Please review the attached file(s)." : "");
    const titleText = trimmed || attachments[0]?.name || messageText;

    if (!messageText || state.isLoading) {
      return;
    }

    const userMessage: UiMessage = {
      id: createId("message"),
      role: "user",
      content: trimmed,
      attachments: toMessageAttachments(attachments),
      attachmentContext: buildAttachmentContext(attachments),
      createdAt: Date.now()
    };

    const tempMode = state.tempMode;
    const targetThread = tempMode
      ? state.tempThread
      : state.threads.find((thread) => thread.id === state.activeThreadId);

    if (!targetThread) {
      return;
    }

    const selectedModel = modelOverride ?? state.selectedModel;
    const useResearchWorkLogFlow = shouldUseAriaResearchWorkFlow(
      messageText,
      selectedModel,
      attachments
    );
    const shouldShowSearchActivity = shouldShowTemporaryWebSearchActivity(
      messageText,
      selectedModel,
      attachments
    );
    const assistantMessage: UiMessage = {
      id: createId("message"),
      role: "assistant",
      content: "",
      model: selectedModel,
      createdAt: Date.now(),
      webSearchActivity: shouldShowSearchActivity && !useResearchWorkLogFlow
        ? {
            status: "searching",
            query: makeSearchQueryLabel(messageText)
          }
        : undefined,
      workLog: createInitialWorkLog(messageText, selectedModel, attachments)
    };
    const targetThreadId = targetThread.id;
    let researchWorkLogFlow: ResearchWorkLogFlow | null = null;

    set({ isLoading: true });
    activeAbortController = new AbortController();

    if (tempMode) {
      set((current) => ({
        tempThread: {
          ...current.tempThread,
          title: current.tempThread.messages.length === 0 ? makeTitle(titleText) : current.tempThread.title,
          model: selectedModel,
          messages: [...current.tempThread.messages, userMessage, assistantMessage],
          updatedAt: Date.now()
        }
      }));
    } else {
      const threads = get().threads.map((thread) =>
        thread.id === targetThreadId
          ? {
              ...thread,
              title: isDefaultEmptyThread(thread) ? makeTitle(titleText) : thread.title,
              model: selectedModel,
              messages: [...thread.messages, userMessage, assistantMessage],
              updatedAt: Date.now()
            }
          : thread
      );

      set({ threads });
    }

    if (useResearchWorkLogFlow) {
      researchWorkLogFlow = startAriaResearchWorkLogFlow({
        set,
        get,
        tempMode,
        threadId: targetThreadId,
        messageId: assistantMessage.id,
        query: makeResearchSearchQueryLabel(messageText)
      });
      activeResearchWorkLogFlow = researchWorkLogFlow;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: activeAbortController.signal,
        body: JSON.stringify({
          message: messageText,
          selectedModel,
          researchModel: selectedModel === "aion-mind-pro" ? researchModel : undefined,
          researchProvider: selectedModel === "aion-mind-pro" ? researchProvider : undefined,
          diverseProviders: selectedModel === "aria-diverse" ? diverseProviders : undefined,
          history: toModelHistory(targetThread.messages),
          attachments: toModelAttachments(attachments),
          debug,
          ephemeral: tempMode,
          threadId: tempMode ? undefined : targetThreadId
        })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      if (!response.body) {
        throw new Error("Aria Mind did not return a response stream.");
      }

      const diagnostics = debug ? readResponseDiagnostics(response) : undefined;

      if (diagnostics?.length) {
        attachAssistantDiagnostics({
          set,
          get,
          tempMode,
          threadId: targetThreadId,
          messageId: assistantMessage.id,
          diagnostics
        });
      }

      const webSearchActivity = readResponseWebSearchActivity(response, messageText);
      const workStatus = readResponseWorkStatus(response);

      if (webSearchActivity && !researchWorkLogFlow) {
        setAssistantWebSearchActivity({
          set,
          get,
          tempMode,
          threadId: targetThreadId,
          messageId: assistantMessage.id,
          activity: webSearchActivity
        });
      }

      if (researchWorkLogFlow) {
        if (workStatus?.status === "failed") {
          await researchWorkLogFlow.showFailure(workStatus.reason);
        } else {
          await researchWorkLogFlow.showPreparing(webSearchActivity);
        }
      } else {
        setAssistantWorkLog({
          set,
          get,
          tempMode,
          threadId: targetThreadId,
          messageId: assistantMessage.id,
          workLog: createStreamingWorkLog({
            hadWebSearch: Boolean(webSearchActivity),
            attemptedWebSearch: shouldShowSearchActivity,
            webSearchFailed: workStatus?.status === "failed",
            hadAttachments: attachments.length > 0
          })
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const streamSmoother = createAssistantStreamSmoother({
        set,
        get,
        tempMode,
        threadId: targetThreadId,
        messageId: assistantMessage.id
      });
      activeStreamSmoother = streamSmoother;
      let streamedContent = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });

        if (!chunk) {
          continue;
        }

        streamedContent += chunk;
        streamSmoother.push(chunk);
      }

      const finalChunk = decoder.decode();

      if (finalChunk) {
        streamedContent += finalChunk;
        streamSmoother.push(finalChunk);
      }

      await streamSmoother.finish();
      activeStreamSmoother = null;
      if (!researchWorkLogFlow) {
        setAssistantWebSearchActivity({
          set,
          get,
          tempMode,
          threadId: targetThreadId,
          messageId: assistantMessage.id,
          activity: undefined
        });
      }
      if (researchWorkLogFlow) {
        if (workStatus?.status !== "failed") {
          researchWorkLogFlow.complete(Boolean(webSearchActivity));
        }
      } else {
        setAssistantWorkLog({
          set,
          get,
          tempMode,
          threadId: targetThreadId,
          messageId: assistantMessage.id,
          workLog:
            workStatus?.status === "failed"
              ? createFailedWorkLog({
                  reason: workStatus.reason,
                  hadAttachments: attachments.length > 0
                })
              : createCompletedWorkLog({
                  hadWebSearch: Boolean(webSearchActivity),
                  hadAttachments: attachments.length > 0
                })
        });
      }

      if (!streamedContent.trim()) {
        replaceAssistantContent({
          set,
          get,
          tempMode,
          threadId: targetThreadId,
          messageId: assistantMessage.id,
          content: "Aria Mind did not return a response."
        });
      }
    } catch (error) {
      activeStreamSmoother?.cancel();
      activeStreamSmoother = null;
      researchWorkLogFlow?.cancel();
      activeResearchWorkLogFlow = null;

      if (isAbortError(error)) {
        removeEmptyAssistantMessage({
          set,
          get,
          tempMode,
          threadId: targetThreadId,
          messageId: assistantMessage.id
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Aria Mind could not process that request.";
      replaceAssistantContent({
        set,
        get,
        tempMode,
        threadId: targetThreadId,
        messageId: assistantMessage.id,
        content: message
      });
    } finally {
      activeAbortController = null;
      activeStreamSmoother = null;
      activeResearchWorkLogFlow = null;

      if (!tempMode) {
        persistThreads(get().threads);
      }

      set({ isLoading: false });
    }
  },

  stopGeneration() {
    activeAbortController?.abort();
    activeStreamSmoother?.cancel();
    activeResearchWorkLogFlow?.cancel();
  },

  async shareThread(threadId) {
    const response = await fetch(`/api/chats/${threadId}/share`, { method: "POST" });
    const data = (await response.json()) as { url?: string };

    if (!response.ok || !data.url || !navigator.clipboard) {
      showToast(set, { message: "Could not copy share link" });
      return;
    }

    await navigator.clipboard.writeText(data.url);
    showToast(set, { message: "Share link copied" });
  },

  async togglePin(threadId) {
    if (get().tempMode && get().activeThreadId === TEMP_CHAT_ID) {
      return;
    }

    const thread = get().threads.find((item) => item.id === threadId);

    if (!thread) {
      return;
    }

    const pinned = !thread.pinned;
    const threads = sortThreads(
      get().threads.map((item) => (item.id === threadId ? { ...item, pinned } : item))
    );

    persistThreads(threads);
    set({ threads });
    await fetch(`/api/chats/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned })
    });
  },

  async renameThread(threadId, title) {
    const cleanTitle = title.trim().slice(0, 80);

    if (!cleanTitle) {
      return;
    }

    const threads = get().threads.map((thread) =>
      thread.id === threadId ? { ...thread, title: cleanTitle, updatedAt: Date.now() } : thread
    );

    persistThreads(threads);
    set({ threads });
    await fetch(`/api/chats/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: cleanTitle })
    });
  },

  addToNotebook(threadId, notebook) {
    const threads = get().threads.map((thread) =>
      thread.id === threadId ? { ...thread, notebook } : thread
    );

    persistThreads(threads);
    set({ threads });
    showToast(set, { message: `Added to ${notebook}` });
  },

  createNotebook(name) {
    const cleanName = name.trim().slice(0, 40);

    if (!cleanName || get().notebooks.includes(cleanName)) {
      return;
    }

    set((state) => ({ notebooks: [...state.notebooks, cleanName] }));
  },

  async deleteThread(threadId) {
    const thread = get().threads.find((item) => item.id === threadId);

    if (!thread) {
      return;
    }

    lastDeletedThread = thread;
    const remaining = get().threads.filter((item) => item.id !== threadId);

    if (remaining.length === 0) {
      const replacement = createThread(get().selectedModel);
      persistThreads([replacement]);
      set({
        threads: [replacement],
        activeThreadId: replacement.id,
        selectedModel: replacement.model,
        lastPersistedThreadId: replacement.id
      });
    } else {
      const sortedThreads = sortThreads(remaining);
      const nextActive =
        get().activeThreadId === threadId
          ? sortedThreads[0]
          : sortedThreads.find((item) => item.id === get().activeThreadId) ?? sortedThreads[0];

      persistThreads(sortedThreads);
      set({
        threads: sortedThreads,
        activeThreadId: nextActive.id,
        selectedModel: nextActive.model,
        lastPersistedThreadId: nextActive.id
      });
    }

    await fetch(`/api/chats/${threadId}`, { method: "DELETE" });
    showToast(set, {
      message: "Chat deleted",
      actionLabel: "Undo",
      action: "undo-delete"
    }, 5000);
  },

  undoDelete() {
    if (!lastDeletedThread) {
      return;
    }

    const restored = lastDeletedThread;
    lastDeletedThread = null;

    if (undoTimer) {
      clearTimeout(undoTimer);
      undoTimer = null;
    }

    const threads = sortThreads([restored, ...get().threads.filter((thread) => thread.id !== restored.id)]);
    persistThreads(threads);
    set({
      threads,
      activeThreadId: restored.id,
      selectedModel: restored.model,
      lastPersistedThreadId: restored.id,
      toast: null
    });
  },

  clearToast() {
    set({ toast: null });
  }
}));

export function getActiveThread(state: ChatState) {
  return state.tempMode
    ? state.tempThread
    : state.threads.find((thread) => thread.id === state.activeThreadId) ?? state.threads[0];
}

export function sortThreads(threads: ChatThread[]) {
  return [...threads].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return right.createdAt - left.createdAt;
  });
}

function dedupeDefaultEmptyThreads(threads: ChatThread[]) {
  let keptDefaultEmpty = false;

  return sortThreads(threads).filter((thread) => {
    if (!isDefaultEmptyThread(thread)) {
      return true;
    }

    if (keptDefaultEmpty) {
      return false;
    }

    keptDefaultEmpty = true;
    return true;
  });
}

function isDefaultEmptyThread(thread: ChatThread) {
  return thread.messages.length === 0 && thread.title === "New chat";
}

function dispatchAlreadyOnNewChat() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("aion:already-on-new-chat"));
}

function createThread(model: AionModelId): ChatThread {
  const now = Date.now();

  return {
    id: createId("thread"),
    title: "New chat",
    model,
    messages: [],
    createdAt: now,
    updatedAt: now
  };
}

function createTempThread(model: AionModelId): ChatThread {
  const now = Date.now();

  return {
    id: TEMP_CHAT_ID,
    title: "Temporary chat",
    model,
    messages: [],
    createdAt: now,
    updatedAt: now
  };
}

function makeTitle(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 44 ? `${compact.slice(0, 44)}...` : compact || "New chat";
}

function toMessageAttachments(attachments: ChatAttachment[]): MessageAttachment[] | undefined {
  if (attachments.length === 0) {
    return undefined;
  }

  return attachments.map(
    ({ id, name, type, size, kind, mimeType, previewData, previewWidth, previewHeight }) => ({
      id,
      name,
      type,
      size,
      kind,
      mimeType,
      previewData,
      previewWidth,
      previewHeight
    })
  );
}

function toModelAttachments(attachments: ChatAttachment[]): ChatAttachment[] {
  return attachments.map(
    ({ previewData: _previewData, previewWidth: _previewWidth, previewHeight: _previewHeight, ...attachment }) =>
      attachment
  );
}

function toModelHistory(messages: UiMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.attachmentContext
      ? [message.content, message.attachmentContext].filter(Boolean).join("\n\n")
      : message.content
  }));
}

function buildAttachmentContext(attachments: ChatAttachment[]) {
  if (attachments.length === 0) {
    return undefined;
  }

  return [
    "Previously uploaded file content for this user message:",
    "",
    attachments
      .map(
        (attachment, index) =>
          `Attachment ${index + 1}: ${attachment.name} (${attachment.type}, ${formatBytes(
            attachment.size
          )})\n${attachment.content}`
      )
      .join("\n\n---\n\n")
  ].join("\n");
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

function readThreads() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as ChatThread[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((thread) => thread && typeof thread.id === "string").slice(0, 24);
  } catch {
    return [];
  }
}

async function readServerThreads(): Promise<ChatThread[] | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const response = await fetch("/api/chats", { cache: "no-store" });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { threads?: unknown };

    if (!Array.isArray(data.threads)) {
      return null;
    }

    return data.threads.filter(isChatThread).slice(0, 24);
  } catch {
    return null;
  }
}

function persistThreads(threads: ChatThread[]) {
  if (typeof window === "undefined") {
    return;
  }

  const nextThreads = sortThreads(threads).slice(0, 24);
  const persistableThreads = stripTransientMessageState(nextThreads);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistableThreads));
  } catch {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stripAttachmentPreviews(persistableThreads)));
    } catch {
      // Local persistence is best effort; server sync below still keeps the thread when signed in.
    }
  }

  void syncThreadsToServer(persistableThreads);
}

function stripTransientMessageState(threads: ChatThread[]) {
  return threads.map((thread) => ({
    ...thread,
    messages: thread.messages.map(stripTransientMessageFields)
  }));
}

function stripTransientMessageFields(message: UiMessage): UiMessage {
  const webSearchActivity =
    message.webSearchActivity?.status === "found" ? message.webSearchActivity : undefined;
  const workLog =
    message.workLog?.length && message.workLog.every((item) => item.status !== "active")
      ? message.workLog
      : undefined;

  return {
    ...message,
    webSearchActivity,
    workLog
  };
}

function stripAttachmentPreviews(threads: ChatThread[]) {
  return threads.map((thread) => ({
    ...thread,
    messages: thread.messages.map((message) => ({
      ...message,
      attachments: message.attachments?.map(
        ({ previewData: _previewData, previewWidth: _previewWidth, previewHeight: _previewHeight, ...attachment }) =>
          attachment
      )
    }))
  }));
}

async function syncThreadsToServer(threads: ChatThread[]) {
  await Promise.all(
    threads.map((thread) =>
      fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread })
      }).catch(() => undefined)
    )
  );
}

function isChatThread(value: unknown): value is ChatThread {
  if (!value || typeof value !== "object") {
    return false;
  }

  const thread = value as Record<string, unknown>;

  return (
    typeof thread.id === "string" &&
    typeof thread.title === "string" &&
    typeof thread.createdAt === "number" &&
    typeof thread.updatedAt === "number" &&
    (thread.model === "aria-instant" ||
      thread.model === "aria-diverse" ||
      thread.model === "aion-mind" ||
      thread.model === "aion-mind-pro" ||
      thread.model === "aion-mind-analyzer") &&
    Array.isArray(thread.messages)
  );
}

function createId(prefix: string) {
  const randomUUID = globalThis.crypto?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  const randomPart =
    globalThis.crypto?.getRandomValues && typeof globalThis.crypto.getRandomValues === "function"
      ? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2)))
          .map((value) => value.toString(36))
          .join("")
      : Math.random().toString(36).slice(2, 12);

  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

type StoreSetter = (
  partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>)
) => void;

type StoreGetter = () => ChatState;

type AssistantStreamSmoother = {
  push: (chunk: string) => void;
  finish: () => Promise<void>;
  cancel: () => void;
};

type ResearchWorkLogFlow = {
  showPreparing: (activity?: WebSearchActivity) => Promise<void>;
  showFailure: (reason: "not-configured" | "no-sources") => Promise<void>;
  complete: (hadWebSearch: boolean) => void;
  cancel: () => void;
};

type AriaResearchWorkLogPhase =
  | "thinking"
  | "read"
  | "searching"
  | "preparing"
  | "done"
  | "failed";

function startAriaResearchWorkLogFlow({
  set,
  get,
  tempMode,
  threadId,
  messageId,
  query
}: {
  set: StoreSetter;
  get: StoreGetter;
  tempMode: boolean;
  threadId: string;
  messageId: string;
  query: string;
}): ResearchWorkLogFlow {
  const startedAt = Date.now();
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let cancelled = false;
  let readShown = false;
  let searchShownAt: number | null = null;

  function setWorkLog(workLog: WorkLogItem[]) {
    if (cancelled) {
      return;
    }

    setAssistantWorkLog({
      set,
      get,
      tempMode,
      threadId,
      messageId,
      workLog
    });
  }

  function setSearchActivity(activity?: WebSearchActivity) {
    if (cancelled) {
      return;
    }

    setAssistantWebSearchActivity({
      set,
      get,
      tempMode,
      threadId,
      messageId,
      activity
    });
  }

  function showReadStep() {
    if (cancelled || readShown) {
      return;
    }

    readShown = true;
    setWorkLog(createAriaResearchWorkLog("read", query));
  }

  function showSearchStep() {
    if (cancelled || searchShownAt !== null) {
      return;
    }

    showReadStep();
    searchShownAt = Date.now();
    setWorkLog(createAriaResearchWorkLog("searching", query));
    setSearchActivity({
      status: "searching",
      query
    });
  }

  timers.push(setTimeout(showReadStep, RESEARCH_STEP_DELAY_MS));
  timers.push(setTimeout(showSearchStep, RESEARCH_STEP_DELAY_MS * 2));

  async function ensureSearchQueryWasVisible() {
    await waitUntilTimestamp(startedAt + RESEARCH_STEP_DELAY_MS);
    showReadStep();
    await waitUntilTimestamp(startedAt + RESEARCH_STEP_DELAY_MS * 2);
    showSearchStep();
    await waitUntilTimestamp(startedAt + RESEARCH_STEP_DELAY_MS * 3);
  }

  return {
    async showPreparing(activity) {
      await ensureSearchQueryWasVisible();

      if (cancelled) {
        return;
      }

      if (activity) {
        setSearchActivity(activity);
      }

      setWorkLog(createAriaResearchWorkLog("preparing", query));
      await waitUntilTimestamp(startedAt + RESEARCH_STEP_DELAY_MS * 4);
    },
    async showFailure(reason) {
      await ensureSearchQueryWasVisible();

      if (cancelled) {
        return;
      }

      setWorkLog(createAriaResearchWorkLog("failed", query, reason));
    },
    complete(hadWebSearch) {
      if (cancelled) {
        return;
      }

      setWorkLog(createAriaResearchWorkLog(hadWebSearch ? "done" : "failed", query));
      clearResearchWorkLogTimers(timers);
    },
    cancel() {
      cancelled = true;
      clearResearchWorkLogTimers(timers);
    }
  };
}

function clearResearchWorkLogTimers(timers: Array<ReturnType<typeof setTimeout>>) {
  while (timers.length > 0) {
    const timer = timers.pop();

    if (timer) {
      clearTimeout(timer);
    }
  }
}

function waitUntilTimestamp(timestamp: number) {
  return waitForMs(timestamp - Date.now());
}

function waitForMs(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function createAssistantStreamSmoother({
  set,
  get,
  tempMode,
  threadId,
  messageId
}: {
  set: StoreSetter;
  get: StoreGetter;
  tempMode: boolean;
  threadId: string;
  messageId: string;
}): AssistantStreamSmoother {
  let buffer = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let finishResolve: (() => void) | null = null;
  let cancelled = false;

  function resolveFinish() {
    if (!finishResolve) {
      return;
    }

    const resolve = finishResolve;
    finishResolve = null;
    resolve();
  }

  function scheduleFlush() {
    if (cancelled || timer) {
      return;
    }

    timer = setTimeout(flush, STREAM_RENDER_INTERVAL_MS);
  }

  function flush() {
    timer = null;

    if (cancelled) {
      resolveFinish();
      return;
    }

    if (buffer) {
      const chunk = takeSmoothStreamChunk(buffer);
      buffer = buffer.slice(chunk.length);
      appendAssistantChunk({
        set,
        get,
        tempMode,
        threadId,
        messageId,
        chunk
      });
    }

    if (buffer) {
      scheduleFlush();
      return;
    }

    resolveFinish();
  }

  return {
    push(chunk) {
      if (cancelled || !chunk) {
        return;
      }

      buffer += chunk;
      scheduleFlush();
    },
    finish() {
      if (!buffer && !timer) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        finishResolve = resolve;
        scheduleFlush();
      });
    },
    cancel() {
      cancelled = true;
      buffer = "";

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      resolveFinish();
    }
  };
}

function takeSmoothStreamChunk(buffer: string) {
  const limit = Math.min(buffer.length, getSmoothStreamChunkLength(buffer.length));

  if (buffer.length <= limit) {
    return buffer;
  }

  const candidate = buffer.slice(0, limit);
  const naturalBreakIndex = Math.max(
    candidate.lastIndexOf("\n"),
    candidate.lastIndexOf(" "),
    candidate.lastIndexOf("\t")
  );

  if (naturalBreakIndex >= STREAM_MIN_NATURAL_BREAK_INDEX) {
    return buffer.slice(0, naturalBreakIndex + 1);
  }

  return candidate;
}

function getSmoothStreamChunkLength(bufferLength: number) {
  if (bufferLength > 1600) {
    return 96;
  }

  if (bufferLength > 800) {
    return 64;
  }

  if (bufferLength > 320) {
    return 40;
  }

  if (bufferLength > 120) {
    return 24;
  }

  return 10;
}

function appendAssistantChunk({
  set,
  tempMode,
  threadId,
  messageId,
  chunk
}: {
  set: StoreSetter;
  get: StoreGetter;
  tempMode: boolean;
  threadId: string;
  messageId: string;
  chunk: string;
}) {
  updateAssistantMessage({
    set,
    tempMode,
    threadId,
    messageId,
    update: (message) => ({ ...message, content: `${message.content}${chunk}` })
  });
}

function replaceAssistantContent({
  set,
  tempMode,
  threadId,
  messageId,
  content
}: {
  set: StoreSetter;
  get: StoreGetter;
  tempMode: boolean;
  threadId: string;
  messageId: string;
  content: string;
}) {
  updateAssistantMessage({
    set,
    tempMode,
    threadId,
    messageId,
    update: (message) => ({ ...message, content, webSearchActivity: undefined, workLog: undefined })
  });
}

function setAssistantWebSearchActivity({
  set,
  tempMode,
  threadId,
  messageId,
  activity
}: {
  set: StoreSetter;
  get: StoreGetter;
  tempMode: boolean;
  threadId: string;
  messageId: string;
  activity?: WebSearchActivity;
}) {
  updateAssistantMessage({
    set,
    tempMode,
    threadId,
    messageId,
    update: (message) => ({ ...message, webSearchActivity: activity })
  });
}

function setAssistantWorkLog({
  set,
  tempMode,
  threadId,
  messageId,
  workLog
}: {
  set: StoreSetter;
  get: StoreGetter;
  tempMode: boolean;
  threadId: string;
  messageId: string;
  workLog?: WorkLogItem[];
}) {
  updateAssistantMessage({
    set,
    tempMode,
    threadId,
    messageId,
    update: (message) => ({ ...message, workLog })
  });
}

function createInitialWorkLog(
  message: string,
  selectedModel: AionModelId,
  attachments: ChatAttachment[]
): WorkLogItem[] {
  if (shouldUseAriaResearchWorkFlow(message, selectedModel, attachments)) {
    return createAriaResearchWorkLog("thinking", makeResearchSearchQueryLabel(message));
  }

  const items: WorkLogItem[] = [
    {
      id: "read-request",
      label: "Read your request",
      status: "done"
    }
  ];

  if (attachments.length > 0) {
    items.push({
      id: "review-attachments",
      label: `Reviewing ${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`,
      status: "active"
    });
  } else if (shouldShowTemporaryWebSearchActivity(message, selectedModel, attachments)) {
    items.push({
      id: "web-search",
      label: "Checking current web context",
      status: "active"
    });
  } else {
    items.push({
      id: "prepare-answer",
      label: "Preparing a clear answer",
      status: "active"
    });
  }

  return items.slice(0, MAX_WORK_LOG_ITEMS);
}

function createAriaResearchWorkLog(
  phase: AriaResearchWorkLogPhase,
  query: string,
  failureReason: "not-configured" | "no-sources" = "no-sources"
): WorkLogItem[] {
  const searchDetail = query ? `Query: ${query}` : undefined;

  if (phase === "failed") {
    return [
      {
        id: "research-thinking",
        label: "Thinking",
        status: "done"
      },
      {
        id: "read-request",
        label: "Read your request",
        status: "done"
      },
      {
        id: "web-search",
        label:
          failureReason === "not-configured"
            ? "Live search is not configured"
            : "Could not verify current web sources",
        detail: searchDetail,
        status: "error"
      }
    ];
  }

  const steps: WorkLogItem[] = [
    {
      id: "research-thinking",
      label: "Thinking",
      status: "done"
    },
    {
      id: "read-request",
      label: "Read your request",
      status: "done"
    },
    {
      id: "web-search",
      label: "Searching the web",
      detail: searchDetail,
      status: "done"
    },
    {
      id: "prepare-answer",
      label: "Preparing final answer",
      status: "done"
    }
  ];

  const activeIndexByPhase: Record<Exclude<AriaResearchWorkLogPhase, "failed">, number> = {
    thinking: 0,
    read: 1,
    searching: 2,
    preparing: 3,
    done: 4
  };
  const activeIndex = activeIndexByPhase[phase];

  if (phase === "done") {
    return steps;
  }

  return steps.slice(0, activeIndex + 1).map((item, index) => ({
    ...item,
    status: index === activeIndex ? "active" : "done"
  }));
}

function createStreamingWorkLog({
  hadWebSearch,
  attemptedWebSearch = false,
  webSearchFailed = false,
  hadAttachments
}: {
  hadWebSearch: boolean;
  attemptedWebSearch?: boolean;
  webSearchFailed?: boolean;
  hadAttachments: boolean;
}): WorkLogItem[] {
  const items: WorkLogItem[] = [
    {
      id: "read-request",
      label: "Read your request",
      status: "done"
    }
  ];

  if (hadAttachments) {
    items.push({
      id: "review-attachments",
      label: "Reviewed attachment context",
      status: "done"
    });
  }

  if (webSearchFailed) {
    items.push({
      id: "web-search",
      label: "Could not verify current web sources",
      status: "error"
    });
  } else if (hadWebSearch) {
    items.push({
      id: "web-search",
      label: "Verified current web sources",
      status: "done"
    });
  } else if (attemptedWebSearch) {
    items.push({
      id: "web-search",
      label: "Checking current web context",
      status: "active"
    });
  } else if (!hadAttachments) {
    items.push({
      id: "prepare-answer",
      label: "Prepared response context",
      status: "done"
    });
  }

  if (!webSearchFailed) {
    items.push({
      id: "draft-answer",
      label: "Drafting the answer",
      status: "active"
    });
  }

  return items.slice(0, MAX_WORK_LOG_ITEMS);
}

function createCompletedWorkLog({
  hadWebSearch,
  hadAttachments
}: {
  hadWebSearch: boolean;
  hadAttachments: boolean;
}): WorkLogItem[] {
  return createStreamingWorkLog({ hadWebSearch, hadAttachments })
    .map((item) => ({ ...item, status: "done" as const }))
    .slice(0, MAX_WORK_LOG_ITEMS);
}

function createFailedWorkLog({
  reason,
  hadAttachments
}: {
  reason: "not-configured" | "no-sources";
  hadAttachments: boolean;
}): WorkLogItem[] {
  const items: WorkLogItem[] = [
    {
      id: "read-request",
      label: "Read your request",
      status: "done"
    }
  ];

  if (hadAttachments) {
    items.push({
      id: "review-attachments",
      label: "Reviewed attachment context",
      status: "done"
    });
  }

  items.push({
    id: "web-search",
    label:
      reason === "not-configured"
        ? "Live search is not configured"
        : "Could not verify current web sources",
    status: "error"
  });

  return items.slice(0, MAX_WORK_LOG_ITEMS);
}

function removeEmptyAssistantMessage({
  set,
  tempMode,
  threadId,
  messageId
}: {
  set: StoreSetter;
  get: StoreGetter;
  tempMode: boolean;
  threadId: string;
  messageId: string;
}) {
  if (tempMode) {
    set((state) => ({
      tempThread: {
        ...state.tempThread,
        messages: state.tempThread.messages.filter(
          (message) => message.id !== messageId || message.content.trim()
        ),
        updatedAt: Date.now()
      }
    }));
    return;
  }

  set((state) => ({
    threads: state.threads.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            messages: thread.messages.filter(
              (message) => message.id !== messageId || message.content.trim()
            ),
            updatedAt: Date.now()
          }
        : thread
    )
  }));
}

function attachAssistantDiagnostics({
  set,
  tempMode,
  threadId,
  messageId,
  diagnostics
}: {
  set: StoreSetter;
  get: StoreGetter;
  tempMode: boolean;
  threadId: string;
  messageId: string;
  diagnostics: DebugDiagnostic[];
}) {
  updateAssistantMessage({
    set,
    tempMode,
    threadId,
    messageId,
    update: (message) => ({ ...message, diagnostics })
  });
}

function updateAssistantMessage({
  set,
  tempMode,
  threadId,
  messageId,
  update
}: {
  set: StoreSetter;
  tempMode: boolean;
  threadId: string;
  messageId: string;
  update: (message: UiMessage) => UiMessage;
}) {
  if (tempMode) {
    set((state) => ({
      tempThread: {
        ...state.tempThread,
        messages: state.tempThread.messages.map((message) =>
          message.id === messageId ? update(message) : message
        ),
        updatedAt: Date.now()
      }
    }));
    return;
  }

  set((state) => ({
    threads: state.threads.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            messages: thread.messages.map((message) =>
              message.id === messageId ? update(message) : message
            ),
            updatedAt: Date.now()
          }
        : thread
    )
  }));
}

async function readErrorMessage(response: Response) {
  const fallback = "Aria Mind could not process that request.";

  try {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { error?: string };
      return data.error || fallback;
    }

    return (await response.text()) || fallback;
  } catch {
    return fallback;
  }
}

function readResponseDiagnostics(response: Response): DebugDiagnostic[] | undefined {
  const header = response.headers.get("x-aion-diagnostics");

  if (!header) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(header)) as unknown;

    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const diagnostics = parsed.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const diagnostic = item as Record<string, unknown>;

      if (
        typeof diagnostic.provider !== "string" ||
        typeof diagnostic.ok !== "boolean" ||
        typeof diagnostic.latencyMs !== "number"
      ) {
        return [];
      }

      return [
        {
          provider: diagnostic.provider,
          model: typeof diagnostic.model === "string" ? diagnostic.model : undefined,
          ok: diagnostic.ok,
          skipped: typeof diagnostic.skipped === "boolean" ? diagnostic.skipped : undefined,
          latencyMs: diagnostic.latencyMs,
          error: typeof diagnostic.error === "string" ? diagnostic.error : undefined
        } satisfies DebugDiagnostic
      ];
    });

    return diagnostics.length > 0 ? diagnostics : undefined;
  } catch {
    return undefined;
  }
}

function readResponseWebSearchActivity(
  response: Response,
  fallbackQuery: string
): WebSearchActivity | undefined {
  const header = response.headers.get("x-aion-web-search");

  if (!header) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(header)) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    const activity = parsed as Record<string, unknown>;
    const sources = Array.isArray(activity.sources)
      ? activity.sources.flatMap((source) => {
          if (!source || typeof source !== "object") {
            return [];
          }

          const candidate = source as Record<string, unknown>;

          if (typeof candidate.title !== "string" || typeof candidate.url !== "string") {
            return [];
          }

          return [
            {
              title: candidate.title.slice(0, 140),
              url: candidate.url
            }
          ];
        })
      : [];

    if (sources.length === 0) {
      return undefined;
    }

    return {
      status: "found",
      query:
        typeof activity.query === "string" && activity.query.trim()
          ? makeSearchQueryLabel(activity.query)
          : makeSearchQueryLabel(fallbackQuery),
      sources: sources.slice(0, 6)
    };
  } catch {
    return undefined;
  }
}

function readResponseWorkStatus(response: Response):
  | {
      status: "failed";
      reason: "not-configured" | "no-sources";
    }
  | undefined {
  const header = response.headers.get("x-aion-work-status");

  if (!header) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(header)) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    const value = parsed as Record<string, unknown>;

    if (
      value.status === "failed" &&
      (value.reason === "not-configured" || value.reason === "no-sources")
    ) {
      return {
        status: value.status,
        reason: value.reason
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function shouldShowTemporaryWebSearchActivity(
  message: string,
  selectedModel: AionModelId,
  attachments: ChatAttachment[]
) {
  if (attachments.length > 0) {
    return false;
  }

  const normalized = message.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return false;
  }

  if (selectedModel === "aion-mind-pro" || selectedModel === "aion-mind-analyzer") {
    return (
      CLIENT_WEB_SEARCH_INTENT_PATTERN.test(normalized) ||
      shouldClientUseLiveFactSearch(normalized)
    );
  }

  return CLIENT_WEB_SEARCH_INTENT_PATTERN.test(normalized) || CLIENT_LIVE_FACT_PATTERN.test(normalized);
}

function shouldClientUseLiveFactSearch(normalized: string) {
  const asksQuestion = CLIENT_QUESTION_PATTERN.test(normalized) || normalized.endsWith("?");
  const hasLiveFactHint =
    CLIENT_LIVE_FACT_PATTERN.test(normalized) || CLIENT_POLITICAL_CM_PATTERN.test(normalized);

  return asksQuestion && hasLiveFactHint;
}

function shouldUseAriaResearchWorkFlow(
  message: string,
  selectedModel: AionModelId,
  attachments: ChatAttachment[]
) {
  return (
    (selectedModel === "aion-mind-pro" || selectedModel === "aion-mind-analyzer") &&
    shouldShowTemporaryWebSearchActivity(message, selectedModel, attachments)
  );
}

function makeSearchQueryLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 160) || "Live web search";
}

function makeResearchSearchQueryLabel(value: string) {
  const suffix = ` current as of ${new Date().toISOString().slice(0, 10)}`;
  const maxLength = 380;
  const cleanValue = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const maxBaseLength = maxLength - suffix.length;
  const baseQuery = cleanValue.slice(0, Math.max(0, maxBaseLength)).trim();

  return baseQuery ? `${baseQuery}${suffix}` : "Live web search";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function showToast(
  set: (partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>)) => void,
  toast: Omit<ChatToast, "id">,
  duration = 2400
) {
  if (undoTimer) {
    clearTimeout(undoTimer);
    undoTimer = null;
  }

  set({ toast: { id: createId("toast"), ...toast } });

  undoTimer = setTimeout(() => {
    if (toast.action === "undo-delete") {
      lastDeletedThread = null;
    }

    set({ toast: null });
    undoTimer = null;
  }, duration);
}
