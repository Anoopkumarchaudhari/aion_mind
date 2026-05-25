"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import { Bookmark, CheckCircle2, Copy, RotateCcw, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { AionLogo } from "@/components/AionLogo";
import { ConfigAlert } from "@/components/ConfigAlert";
import { useChatStore } from "@/store/useChatStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import type { UiMessage } from "@/store/useChatStore";
import { getAionModelLabel } from "@/types/aion";
import type { AionModelId, DebugDiagnostic, MessageAttachment } from "@/types/aion";

type MessageBubbleProps = {
  message: UiMessage;
  fallbackModel: AionModelId;
  debugEnabled: boolean;
  isStreaming?: boolean;
};

export function MessageBubble({
  message,
  fallbackModel,
  debugEnabled,
  isStreaming = false
}: MessageBubbleProps) {
  const activeThreadId = useChatStore((state) => state.activeThreadId);
  const addLibraryItem = useLibraryStore((state) => state.addItem);

  if (message.role === "user") {
    const hasContent = message.content.trim().length > 0;
    const hasImagePreview = message.attachments?.some((attachment) => getAttachmentPreviewSrc(attachment)) ?? false;
    const hasNonImageAttachments =
      message.attachments?.some((attachment) => !getAttachmentPreviewSrc(attachment)) ?? false;
    const isImageOnly = hasImagePreview && !hasContent && !hasNonImageAttachments;

    return (
      <motion.div
        className="message-row is-user"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="user-message-body">
          <div className={clsx("user-bubble", isImageOnly && "is-image-only")}>
            {message.attachments?.length ? (
              <MessageAttachments attachments={message.attachments} hasFollowingContent={hasContent} />
            ) : null}
            {hasContent ? <div className="user-bubble-content">{message.content}</div> : null}
          </div>
        </div>
      </motion.div>
    );
  }

  const isConfigMessage = isAionConfigMessage(message.content);
  const modelLabel = getAionModelLabel(message.model ?? fallbackModel);
  const responderLabel = debugEnabled ? getResponderLabel(message.diagnostics) : "";
  const displayModelLabel = responderLabel ? `${modelLabel} · ${responderLabel}` : modelLabel;

  return (
    <motion.div
      className="message-row is-ai"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="ai-avatar" aria-hidden="true">
        <AionLogo size={24} decorative />
      </div>
      <div className="ai-message-body">
        <div className="ai-message-meta" aria-label={`Responded by ${displayModelLabel}`}>
          {displayModelLabel}
        </div>
        {isConfigMessage ? (
          <ConfigAlert message={message.content} />
        ) : (
          <MarkdownContent content={message.content} messageId={message.id} sourceChatId={activeThreadId} />
        )}
        {isStreaming ? <span className="streaming-caret message-caret" aria-hidden="true" /> : null}
        {debugEnabled && message.diagnostics?.length ? (
          <DebugPanel diagnostics={message.diagnostics} />
        ) : null}
        <div className="ai-actions" aria-label="Message actions">
          <button
            className="message-action"
            type="button"
            title="Copy"
            aria-label="Copy response"
            onClick={() => void navigator.clipboard?.writeText(message.content)}
          >
            <Copy size={14} />
          </button>
          <button
            className="message-action"
            type="button"
            title="Save to Library"
            aria-label="Save response to Library"
            onClick={() => {
              addLibraryItem({
                type: "chat",
                title: message.content.split(/\s+/).slice(0, 8).join(" ") || "Saved response",
                content: message.content,
                sourceChatId: activeThreadId,
                sourceMessageId: message.id
              });
              toast.success("Saved to Library");
            }}
          >
            <Bookmark size={14} />
          </button>
          <button
            className="message-action"
            type="button"
            title="Regenerate"
            aria-label="Regenerate response"
          >
            <RotateCcw size={14} />
          </button>
          <button className="message-action" type="button" title="Helpful" aria-label="Mark helpful">
            <ThumbsUp size={14} />
          </button>
          <button
            className="message-action"
            type="button"
            title="Not helpful"
            aria-label="Mark not helpful"
          >
            <ThumbsDown size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function LoadingBubble({ model }: { model: AionModelId }) {
  return (
    <motion.div
      className="message-row is-ai"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="ai-avatar" aria-hidden="true">
        <AionLogo size={24} decorative />
      </div>
      <div className="ai-message-body">
        <div className="typing">
          <span>{getAionModelLabel(model)} is thinking</span>
          <span className="typing-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="streaming-caret" aria-hidden="true" />
        </div>
      </div>
    </motion.div>
  );
}

function MarkdownContent({
  content,
  messageId,
  sourceChatId
}: {
  content: string;
  messageId: string;
  sourceChatId: string;
}) {
  const addLibraryItem = useLibraryStore((state) => state.addItem);

  return (
    <div className="markdown prose prose-invert prose-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || "");
            const value = String(children).replace(/\n$/, "");

            if (match) {
              return (
                <div className="code-snippet-shell">
                  <button
                    className="code-save-button"
                    type="button"
                    onClick={() => {
                      addLibraryItem({
                        type: "code",
                        title: `${match[1]} snippet`,
                        content: value,
                        language: match[1],
                        sourceChatId,
                        sourceMessageId: messageId
                      });
                      toast.success("Snippet saved");
                    }}
                  >
                    Save snippet
                  </button>
                  <SyntaxHighlighter
                    language={match[1]}
                    PreTag="div"
                    style={oneDark as Record<string, CSSProperties>}
                    customStyle={{
                      margin: 0,
                      borderRadius: 10,
                      background: "rgba(0, 0, 0, 0.4)",
                      fontSize: "0.86rem"
                    }}
                  >
                    {value}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return <code className={className}>{children}</code>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function DebugPanel({ diagnostics }: { diagnostics: DebugDiagnostic[] }) {
  return (
    <details className="debug-panel">
      <summary>Debug routing</summary>
      <div className="debug-grid">
        {diagnostics.map((diagnostic, index) => (
          <div className="debug-item" key={`${diagnostic.provider}-${index}`}>
            <span className={`status-dot ${diagnostic.ok ? "" : "is-error"}`} />
            <strong>{diagnostic.provider}</strong>
            {diagnostic.model ? <span>{diagnostic.model}</span> : null}
            <span>{diagnostic.skipped ? "skipped" : diagnostic.ok ? "ok" : "error"}</span>
            <span>{diagnostic.latencyMs}ms</span>
            {diagnostic.error ? <span>{diagnostic.error}</span> : null}
            {diagnostic.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          </div>
        ))}
      </div>
    </details>
  );
}

function MessageAttachments({
  attachments,
  hasFollowingContent
}: {
  attachments: MessageAttachment[];
  hasFollowingContent: boolean;
}) {
  const imageAttachments = attachments
    .map((attachment) => ({ attachment, src: getAttachmentPreviewSrc(attachment) }))
    .filter((item) => item.src);
  const fileAttachments = attachments.filter((attachment) => !getAttachmentPreviewSrc(attachment));

  return (
    <div
      className={clsx("message-attachments", !hasFollowingContent && "is-last")}
      aria-label="Attached files"
    >
      {imageAttachments.length > 0 ? (
        <div
          className={clsx(
            "message-image-attachments",
            imageAttachments.length > 1 && "is-grid"
          )}
        >
          {imageAttachments.map(({ attachment, src }) => (
            <div className="message-image-attachment" key={attachment.id}>
              <img src={src} alt={attachment.name} />
            </div>
          ))}
        </div>
      ) : null}
      {fileAttachments.map((attachment) => (
        <div className="message-attachment" key={attachment.id}>
          <span className="message-attachment-name">{attachment.name}</span>
          <span className="message-attachment-meta">{formatBytes(attachment.size)}</span>
        </div>
      ))}
    </div>
  );
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

function getAttachmentPreviewSrc(attachment: MessageAttachment) {
  if (attachment.kind !== "image" || !attachment.previewData) {
    return "";
  }

  return /^data:image\/(?:png|jpe?g|webp|heic|heif);base64,/i.test(attachment.previewData)
    ? attachment.previewData
    : "";
}

function isAionConfigMessage(content: string) {
  return /^Aion Mind(?: Pro| Analyzer)? is not configured yet\. Add (?:the required|at least one) server-side API key and model ID, then restart the dev server\./i.test(
    content.trim()
  );
}

function getResponderLabel(diagnostics?: DebugDiagnostic[]) {
  const successful = diagnostics?.filter((diagnostic) => diagnostic.ok);
  const responder = successful?.[successful.length - 1];

  if (!responder) {
    return "";
  }

  return responder.model ? `${responder.provider} / ${responder.model}` : responder.provider;
}
