"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast as sonnerToast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { MessageInput } from "@/components/MessageInput";
import { ModelRoutingDrawer } from "@/components/ModelRoutingDrawer";
import { MessageList } from "@/components/MessageList";
import { ModelPill } from "@/components/ModelPill";
import { StarSky } from "@/components/StarSky";
import { ResearchModelDialog } from "@/components/ResearchModelDialog";
import { ShareLinkToast } from "@/components/ShareLinkToast";
import { Sidebar } from "@/components/Sidebar";
import { TempBanner } from "@/components/TempBanner";
import { TopBar } from "@/components/TopBar";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { fadeThroughVariants, gentleSpring } from "@/lib/motion";
import { getChatCreditCharge, useBillingStore } from "@/store/useBillingStore";
import { sortThreads, useChatStore } from "@/store/useChatStore";
import { useNotebookStore } from "@/store/useNotebookStore";
import type { AionModelId, AionResearchModelId, AriaDiverseProvider, ChatAttachment } from "@/types/aion";

const debugEnabled = process.env.NEXT_PUBLIC_AION_DEBUG === "true";
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENT_CHARS = 12000;
const MAX_TOTAL_ATTACHMENT_CHARS = 24000;
const MAX_IMAGE_PREVIEW_SIDE = 960;
const MAX_IMAGE_PREVIEW_DATA_LENGTH = 750000;

type ChatDashboardProps = {
  initialThreadId?: string;
};

type ImagePreview = {
  previewData?: string;
  width?: number;
  height?: number;
};

export function ChatDashboard({ initialThreadId }: ChatDashboardProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [routingOpen, setRoutingOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchModel, setResearchModel] = useState<AionResearchModelId>("gpt-5.5");
  const [diverseProviders, setDiverseProviders] = useState<AriaDiverseProvider[]>(["openai"]);
  const [researchProvider, setResearchProvider] = useState<AriaDiverseProvider>("openai");
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [promptEnhanceError, setPromptEnhanceError] = useState("");
  const [promptEnhanceUndo, setPromptEnhanceUndo] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const rawThreads = useChatStore((state) => state.threads);
  const activeThreadId = useChatStore((state) => state.activeThreadId);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const tempMode = useChatStore((state) => state.tempMode);
  const tempThread = useChatStore((state) => state.tempThread);
  const isLoading = useChatStore((state) => state.isLoading);
  const toast = useChatStore((state) => state.toast);
  const createOrFocusNewChat = useChatStore((state) => state.createOrFocusNewChat);
  const selectThread = useChatStore((state) => state.selectThread);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const toggleTempMode = useChatStore((state) => state.toggleTempMode);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stopGeneration = useChatStore((state) => state.stopGeneration);
  const shareThread = useChatStore((state) => state.shareThread);
  const togglePin = useChatStore((state) => state.togglePin);
  const renameThread = useChatStore((state) => state.renameThread);
  const addToNotebook = useChatStore((state) => state.addToNotebook);
  const createNotebook = useChatStore((state) => state.createNotebook);
  const deleteThread = useChatStore((state) => state.deleteThread);
  const undoDelete = useChatStore((state) => state.undoDelete);
  const clearToast = useChatStore((state) => state.clearToast);
  const notebookItems = useNotebookStore((state) => state.notebooks);
  const createWorkspaceNotebook = useNotebookStore((state) => state.createNotebook);
  const renameWorkspaceNotebook = useNotebookStore((state) => state.renameNotebook);
  const updateNotebookMeta = useNotebookStore((state) => state.updateNotebookMeta);
  const duplicateWorkspaceNotebook = useNotebookStore((state) => state.duplicateNotebook);
  const deleteWorkspaceNotebook = useNotebookStore((state) => state.deleteNotebook);
  const addChatToNotebook = useNotebookStore((state) => state.addChatToNotebook);

  const threads = useMemo(() => sortThreads(rawThreads), [rawThreads]);
  const activeThread = useMemo(
    () => (tempMode ? tempThread : rawThreads.find((thread) => thread.id === activeThreadId) ?? rawThreads[0]),
    [activeThreadId, rawThreads, tempMode, tempThread]
  );
  const activeMessages = activeThread?.messages ?? [];
  const hasMessages = activeMessages.length > 0;
  const scrollKey = `${activeThread?.id ?? ""}:${isLoading}:${activeMessages
    .map((message) => `${message.id}:${message.content.length}`)
    .join("|")}`;
  const scrollRef = useAutoScroll(scrollKey);

  useEffect(() => {
    void useChatStore.getState().hydrate();
    void useBillingStore.getState().loadAccount();
  }, []);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }

        return response.ok ? response.json() : null;
      })
      .then((data: { user?: { name?: string } } | null) => {
        if (data?.user?.name) {
          setAccountName(data.user.name);
        }
      })
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    if (initialThreadId && rawThreads.some((thread) => thread.id === initialThreadId)) {
      selectThread(initialThreadId);
    }
  }, [initialThreadId, rawThreads, selectThread]);

  useEffect(() => {
    function toggleSidebar() {
      setSidebarCollapsed((value) => !value);
    }

    window.addEventListener("aion:toggle-sidebar", toggleSidebar);
    return () => window.removeEventListener("aion:toggle-sidebar", toggleSidebar);
  }, []);

  function handleNewChat() {
    const alreadyOnDefaultEmpty =
      !tempMode &&
      activeThread?.id === activeThreadId &&
      activeThread.messages.length === 0 &&
      activeThread.title === "New chat";

    const nextThreadId = createOrFocusNewChat(selectedModel);

    if (!alreadyOnDefaultEmpty || nextThreadId !== activeThreadId) {
      setInput("");
      setPromptEnhanceError("");
      setPromptEnhanceUndo(null);
    }

    setSidebarOpen(false);
    if (nextThreadId !== "aion-temp-chat") {
      router.push(`/chat/${nextThreadId}`);
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleAddToNotebook(threadId: string, notebookTitle: string) {
    const existing = notebookItems.find((notebook) => notebook.title === notebookTitle);
    const notebookId = existing?.id ?? createWorkspaceNotebook({ title: notebookTitle });

    addToNotebook(threadId, notebookTitle);
    addChatToNotebook(notebookId, threadId);
  }

  async function handleSubmit(
    event?: React.FormEvent,
    options: { selectedModel?: AionModelId; researchModel?: AionResearchModelId } = {}
  ) {
    event?.preventDefault();

    const content = input.trim();
    const outgoingAttachments = attachments;
    const requestModel = options.selectedModel ?? selectedModel;
    const creditCharge = getChatCreditCharge(requestModel, {
      attachmentCount: outgoingAttachments.length,
      inputChars: content.length,
      diverseProviders,
      researchProvider
    });

    if ((!content && attachments.length === 0) || isLoading || isReadingFiles) {
      return;
    }

    // Deduct credits server-side (authoritative, per-account, recorded in the
    // ledger). Returns false when the balance is insufficient.
    const charged = await useBillingStore.getState().spendCredits(creditCharge);

    if (!charged) {
      sonnerToast.error(`Need ${creditCharge.credits} credits for ${creditCharge.label}.`);
      router.push("/settings?tab=billing");
      return;
    }

    setInput("");
    setAttachments([]);
    setAttachmentError("");
    setPromptEnhanceError("");
    setPromptEnhanceUndo(null);
    await sendMessage(content, {
      debug: debugEnabled,
      attachments: outgoingAttachments,
      selectedModel: requestModel,
      researchModel: options.researchModel ?? researchModel,
      diverseProviders,
      researchProvider
    });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleResearchModelChange(model: AionResearchModelId) {
    setResearchModel(model);
    setResearchProvider(researchModelToProvider(model));
  }

  function handleUseResearchModel() {
    setSelectedModel("aion-mind-pro");
    setResearchOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleRunResearch() {
    setSelectedModel("aion-mind-pro");
    setResearchOpen(false);
    void handleSubmit(undefined, {
      selectedModel: "aion-mind-pro",
      researchModel
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  function handleInputChange(value: string) {
    setInput(value);
    setPromptEnhanceError("");
    setPromptEnhanceUndo(null);
  }

  function handlePromptSelect(prompt: string) {
    setInput(prompt);
    setPromptEnhanceError("");
    setPromptEnhanceUndo(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleEnhancePrompt() {
    const draft = input.trim();

    if (!draft || isLoading || isReadingFiles || isEnhancingPrompt) {
      return;
    }

    const previousPrompt = input;
    setPromptEnhanceError("");
    setPromptEnhanceUndo(null);
    setIsEnhancingPrompt(true);

    try {
      const response = await fetch("/api/prompt/enhance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: draft,
          selectedModel,
          researchModel: selectedModel === "aion-mind-pro" ? researchModel : undefined,
          attachments: attachments.map((attachment) => ({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            kind: attachment.kind
          }))
        })
      });

      if (!response.ok) {
        throw new Error(await readPromptEnhanceError(response));
      }

      const payload = (await response.json()) as { enhancedPrompt?: unknown };
      const enhancedPrompt =
        typeof payload.enhancedPrompt === "string" ? payload.enhancedPrompt.trim() : "";

      if (!enhancedPrompt) {
        throw new Error("Prompt enhancer returned an empty prompt.");
      }

      setInput(enhancedPrompt);
      setPromptEnhanceUndo(previousPrompt);
    } catch (error) {
      setPromptEnhanceError(
        error instanceof Error ? error.message : "Prompt enhancer could not process that request."
      );
    } finally {
      setIsEnhancingPrompt(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleUndoPromptEnhance() {
    if (promptEnhanceUndo === null) {
      return;
    }

    setInput(promptEnhanceUndo);
    setPromptEnhanceUndo(null);
    setPromptEnhanceError("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleAttachFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setIsReadingFiles(true);
    setAttachmentError("");

    try {
      const remainingSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
      const accepted = files.slice(0, remainingSlots);
      const skipped: string[] = [];
      let remainingChars =
        MAX_TOTAL_ATTACHMENT_CHARS - attachments.reduce((total, item) => total + item.content.length, 0);
      const nextAttachments: ChatAttachment[] = [];

      if (files.length > remainingSlots) {
        skipped.push(`Only ${MAX_ATTACHMENTS} files can be attached at once.`);
      }

      for (const file of accepted) {
        const maxSize = isSupportedImageFile(file) ? MAX_IMAGE_ATTACHMENT_SIZE : MAX_ATTACHMENT_SIZE;

        if (file.size > maxSize) {
          skipped.push(`${file.name} is larger than ${formatBytes(maxSize)}.`);
          continue;
        }

        if (remainingChars <= 0 && !isSupportedImageFile(file)) {
          skipped.push("Attachment text limit reached.");
          break;
        }

        const attachment = await readAttachment(file, remainingChars);

        if (!attachment.content.trim() && attachment.kind !== "image") {
          skipped.push(`${file.name} did not contain readable text.`);
          continue;
        }

        nextAttachments.push(attachment);

        remainingChars -= attachment.kind === "image" ? 0 : attachment.content.length;
      }

      if (nextAttachments.length > 0) {
        setAttachments((current) => [...current, ...nextAttachments].slice(0, MAX_ATTACHMENTS));
      }

      setAttachmentError(skipped.join(" "));
    } finally {
      setIsReadingFiles(false);
    }
  }

  const controls = (
    <>
      <MessageInput
        value={input}
        disabled={isLoading}
        tempMode={tempMode}
        attachments={attachments}
        isReadingFiles={isReadingFiles}
        isEnhancingPrompt={isEnhancingPrompt}
        attachmentError={attachmentError}
        promptEnhanceError={promptEnhanceError}
        canUndoPromptEnhance={promptEnhanceUndo !== null}
        modelControl={
          <ModelPill
            active={selectedModel}
            diverseProviders={diverseProviders}
            researchProvider={researchProvider}
            onChange={setSelectedModel}
            onDiverseProvidersChange={setDiverseProviders}
            onResearchProviderChange={setResearchProvider}
          />
        }
        inputRef={inputRef}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        onStop={stopGeneration}
        onKeyDown={handleKeyDown}
        onEnhancePrompt={handleEnhancePrompt}
        onUndoPromptEnhance={handleUndoPromptEnhance}
        onAttachFiles={(files) => void handleAttachFiles(files)}
        onRemoveAttachment={(id) =>
          setAttachments((current) => current.filter((attachment) => attachment.id !== id))
        }
      />
    </>
  );

  return (
    <div className={`app-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        tempMode={tempMode}
        notebooks={notebookItems.map((notebook) => notebook.title)}
        notebookItems={notebookItems}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onNewChat={handleNewChat}
        onSelectThread={(thread) => {
          selectThread(thread.id);
          setSidebarOpen(false);
          router.push(`/chat/${thread.id}`);
        }}
        onShareThread={shareThread}
        onTogglePin={togglePin}
        onRenameThread={renameThread}
        onAddToNotebook={handleAddToNotebook}
        onCreateNotebook={(name) => {
          createNotebook(name);
          createWorkspaceNotebook({ title: name });
        }}
        onDeleteThread={deleteThread}
        onOpenSearch={() => window.dispatchEvent(new Event("aion:open-search"))}
        onCreateNotebookDialog={() => window.dispatchEvent(new Event("aion:new-notebook"))}
        onSelectNotebook={(id) => router.push(`/notebooks/${id}`)}
        onRenameNotebook={renameWorkspaceNotebook}
        onChangeNotebookEmoji={(id, emoji) => updateNotebookMeta(id, { emoji })}
        onDuplicateNotebook={duplicateWorkspaceNotebook}
        onDeleteNotebook={deleteWorkspaceNotebook}
        onOpenShortcuts={() => window.dispatchEvent(new Event("aion:show-shortcuts"))}
      />

      <main className="main-panel">
        <TempBanner active={tempMode} />
        <TopBar
          tempMode={tempMode}
          onToggleTempMode={toggleTempMode}
          onNewChat={handleNewChat}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
        />

        <section className="chat-stage">
          <StarSky dimmed={hasMessages} />
          <div className="chat-content-layer">
            <AnimatePresence mode="wait">
              {!hasMessages ? (
                <EmptyState
                  key="empty"
                  controls={controls}
                  accountName={accountName}
                  onPromptSelect={handlePromptSelect}
                />
              ) : (
                <motion.div
                  key="messages"
                  className="chat-thread"
                  variants={fadeThroughVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
                  <MessageList
                    messages={activeMessages}
                    isLoading={isLoading}
                    selectedModel={selectedModel}
                    debugEnabled={debugEnabled}
                    scrollRef={scrollRef}
                  />
                  <motion.div className="docked-composer" layout transition={gentleSpring}>
                    {controls}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <ShareLinkToast toast={toast} onUndoDelete={undoDelete} onClose={clearToast} />
      <ModelRoutingDrawer
        open={routingOpen}
        initialTab={getRoutingTab(selectedModel)}
        onOpenChange={setRoutingOpen}
      />
      <ResearchModelDialog
        open={researchOpen}
        selectedModel={researchModel}
        canSubmit={Boolean(input.trim() || attachments.length > 0)}
        disabled={isLoading || isReadingFiles}
        onOpenChange={setResearchOpen}
        onModelChange={handleResearchModelChange}
        onUseModel={handleUseResearchModel}
        onRunResearch={handleRunResearch}
      />
    </div>
  );
}

function researchModelToProvider(model: AionResearchModelId): AriaDiverseProvider {
  switch (model) {
    case "opus-4.8":
      return "anthropic";
    case "deepseek":
      return "deepseek";
    case "gemini-3.1":
      return "gemini";
    case "gpt-5.5":
    default:
      return "openai";
  }
}

function getRoutingTab(model: AionModelId) {
  if (model === "aion-mind-pro") {
    return "pro";
  }

  if (model === "aion-mind" || model === "aion-mind-analyzer") {
    return "analyzer";
  }

  if (model === "aria-diverse") {
    return "diverse";
  }

  return "aion";
}

async function readPromptEnhanceError(response: Response) {
  try {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { error?: unknown };

      if (typeof payload.error === "string" && payload.error.trim()) {
        return payload.error.trim();
      }
    }

    const text = await response.text();
    return text.trim() || "Prompt enhancer could not process that request.";
  } catch {
    return "Prompt enhancer could not process that request.";
  }
}

const SUPPORTED_TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "log",
  "xml",
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "c",
  "cpp",
  "cs",
  "go",
  "rs",
  "rb",
  "php",
  "sql",
  "yaml",
  "yml",
  "toml"
]);

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif"
]);

function isSupportedTextFile(file: File) {
  if (file.type.startsWith("text/")) {
    return true;
  }

  if (
    [
      "application/json",
      "application/xml",
      "application/javascript",
      "application/typescript",
      "application/x-yaml"
    ].includes(file.type)
  ) {
    return true;
  }

  return SUPPORTED_TEXT_EXTENSIONS.has(getFileExtension(file.name));
}

function isSupportedImageFile(file: File) {
  return Boolean(getImageMimeType(file));
}

async function readAttachment(file: File, remainingChars: number): Promise<ChatAttachment> {
  const imageMimeType = getImageMimeType(file);
  const base = {
    id: createAttachmentId(),
    name: file.name,
    type: imageMimeType || file.type || getFileExtensionType(file.name),
    size: file.size
  };

  if (imageMimeType) {
    try {
      const dataUrl = await fileToDataUrl(file);
      const data = getDataUrlPayload(dataUrl);
      const preview = await createImagePreview(dataUrl);

      return {
        ...base,
        kind: "image",
        mimeType: imageMimeType,
        data,
        previewData: preview.previewData,
        previewWidth: preview.width,
        previewHeight: preview.height,
        content: buildImageAttachmentNote(file)
      };
    } catch {
      return {
        ...base,
        kind: "file",
        content: buildBinaryAttachmentNote(file)
      };
    }
  }

  if (!isSupportedTextFile(file)) {
    return {
      ...base,
      kind: "file",
      content: buildBinaryAttachmentNote(file)
    };
  }

  try {
    const rawText = await file.text();
    const normalized = normalizeAttachmentText(rawText);
    const content = normalized.slice(0, Math.min(MAX_ATTACHMENT_CHARS, remainingChars));

    return {
      ...base,
      kind: "text",
      content:
        content.length < normalized.length
          ? `${content}\n\n[File truncated to keep the chat responsive.]`
          : content
    };
  } catch {
    return {
      ...base,
      kind: "file",
      content: buildBinaryAttachmentNote(file)
    };
  }
}

function getImageMimeType(file: File) {
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return file.type;
  }

  switch (getFileExtension(file.name)) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "";
  }
}

function buildImageAttachmentNote(file: File) {
  const fileType = getImageMimeType(file) || file.type || getFileExtensionType(file.name);

  return [
    `[Attached image: ${file.name}]`,
    `Type: ${fileType}`,
    `Size: ${formatBytes(file.size)}`,
    "This image was sent directly to Aria Mind vision. Use it to extract text, describe visible content, and answer the user's question."
  ].join("\n");
}

function buildBinaryAttachmentNote(file: File) {
  const fileType = file.type || getFileExtensionType(file.name);

  return [
    `[Attached file: ${file.name}]`,
    `Type: ${fileType}`,
    `Size: ${formatBytes(file.size)}`,
    "The browser attached this file, but this local chat currently extracts text/code and supported image content only. If this file is a PDF, document, spreadsheet, or other binary file, ask the user for the relevant text or use the filename/type as context."
  ].join("\n");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      if (result.startsWith("data:")) {
        resolve(result);
      } else {
        reject(new Error("Could not read image file."));
      }
    };

    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function getDataUrlPayload(dataUrl: string) {
  const [, base64 = ""] = dataUrl.split(",", 2);

  if (!base64) {
    throw new Error("Could not read image file.");
  }

  return base64;
}

async function createImagePreview(dataUrl: string): Promise<ImagePreview> {
  try {
    const image = await loadImage(dataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const attempts = [
      { maxSide: MAX_IMAGE_PREVIEW_SIDE, quality: 0.86 },
      { maxSide: 760, quality: 0.78 },
      { maxSide: 540, quality: 0.72 }
    ];

    for (const attempt of attempts) {
      const preview = drawImagePreview(image, width, height, attempt.maxSide, attempt.quality);

      if (!preview.previewData || preview.previewData.length <= MAX_IMAGE_PREVIEW_DATA_LENGTH) {
        return preview;
      }
    }

    return { width, height };
  } catch {
    return dataUrl.length <= MAX_IMAGE_PREVIEW_DATA_LENGTH ? { previewData: dataUrl } : {};
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not create image preview."));
    image.src = src;
  });
}

function drawImagePreview(
  image: HTMLImageElement,
  width: number,
  height: number,
  maxSide: number,
  quality: number
): ImagePreview {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const previewWidth = Math.max(1, Math.round(width * scale));
  const previewHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return { width, height };
  }

  canvas.width = previewWidth;
  canvas.height = previewHeight;
  context.drawImage(image, 0, 0, previewWidth, previewHeight);

  return {
    previewData: canvas.toDataURL("image/webp", quality),
    width: previewWidth,
    height: previewHeight
  };
}

function normalizeAttachmentText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
}

function getFileExtensionType(name: string) {
  const extension = getFileExtension(name);
  return extension ? `text/${extension}` : "text/plain";
}

function getFileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function createAttachmentId() {
  const randomUUID = globalThis.crypto?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  return `attachment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
