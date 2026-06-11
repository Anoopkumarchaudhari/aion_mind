"use client";

import clsx from "clsx";
import { useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  Copy,
  ExternalLink,
  RotateCcw,
  Search,
  ThumbsDown,
  ThumbsUp,
  XCircle
} from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { AionLogo } from "@/components/AionLogo";
import { ConfigAlert } from "@/components/ConfigAlert";
import { useChatStore } from "@/store/useChatStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import type { UiMessage } from "@/store/useChatStore";
import { getAionModelLabel } from "@/types/aion";
import type {
  AionModelId,
  DebugDiagnostic,
  MessageAttachment,
  WebSearchActivity,
  WorkLogItem
} from "@/types/aion";

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
  const displayModelLabel = responderLabel ? `${modelLabel} / ${responderLabel}` : modelLabel;

  return (
    <motion.div
      className="message-row is-ai"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="ai-message-body">
        <div className="ai-message-meta" aria-label={`Responded by ${displayModelLabel}`}>
          {displayModelLabel}
        </div>
        {isConfigMessage ? (
          <ConfigAlert message={message.content} />
        ) : (
          <>
            {message.workLog?.length ? <WorkLogPanel items={message.workLog} title={modelLabel} /> : null}
            {message.webSearchActivity ? <WebSearchActivityPanel activity={message.webSearchActivity} /> : null}
            <MarkdownContent content={message.content} />
          </>
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
      <div className="ai-message-body">
        <div className="typing">
          <span>{getAionModelLabel(model)} is preparing a response</span>
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

function WorkLogPanel({ items, title }: { items: WorkLogItem[]; title: string }) {
  const hasError = items.some((item) => item.status === "error");
  const hasActive = items.some((item) => item.status === "active");
  const statusLabel = hasError ? "Failed" : hasActive ? "In progress" : "Done";

  return (
    <details className="work-log-panel" open>
      <summary>
        <span className="work-log-brand">
          <AionLogo size={18} decorative />
          <span>{title}</span>
        </span>
        <span className={clsx("work-log-status", hasError && "is-error")}>{statusLabel}</span>
      </summary>
      <div className="work-log-list">
        {items.map((item) => (
          <div
            className={clsx(
              "work-log-item",
              item.status === "active" && "is-active",
              item.status === "error" && "is-error"
            )}
            key={item.id}
          >
            <span aria-hidden="true" />
            <div className="work-log-copy">
              <p>{item.label}</p>
              {item.detail ? <small>{item.detail}</small> : null}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function WebSearchActivityPanel({ activity }: { activity: WebSearchActivity }) {
  const sources = activity.sources ?? [];
  const hasSources = sources.length > 0;

  return (
    <details className="web-search-activity" open>
      <summary>
        <span className="web-search-icon" aria-hidden="true">
          {activity.status === "found" ? <CheckCircle2 size={15} /> : <Search size={15} />}
        </span>
        <span className="web-search-title">
          {activity.status === "found" ? `Found ${sources.length} source${sources.length === 1 ? "" : "s"}` : "Searching the web"}
        </span>
        <span className="web-search-query">{activity.query}</span>
      </summary>
      <div className="web-search-results">
        {hasSources ? (
          sources.map((source) => (
            <a className="web-search-result" href={source.url} target="_blank" rel="noreferrer" key={source.url}>
              <span>{source.title}</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ))
        ) : (
          <>
            <span className="web-search-placeholder">Finding current sources</span>
            <span className="web-search-placeholder">Verifying details</span>
          </>
        )}
      </div>
    </details>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown markdown-output">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || "");
            const value = String(children).replace(/\n$/, "");

            if (match || value.includes("\n")) {
              return <CodeSnippetBlock code={value} language={match?.[1] ?? "text"} />;
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

function CodeSnippetBlock({
  code,
  language
}: {
  code: string;
  language: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied code");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy code");
    }
  }

  return (
    <div className="code-snippet-shell">
      <button
        className={clsx("code-copy-button", copied && "is-copied")}
        type="button"
        title={copied ? "Copied" : "Copy"}
        aria-label={copied ? "Code copied" : "Copy code"}
        onClick={() => void copySnippet()}
      >
        {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
      </button>
      <div className="code-snippet-header">
        <span>{formatLanguageLabel(language)}</span>
      </div>
      <pre className="code-snippet-body">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

function formatLanguageLabel(language: string) {
  const normalized = language.trim().toLowerCase();

  if (!normalized || normalized === "text") {
    return "text";
  }

  const labels: Record<string, string> = {
    bash: "bash",
    js: "javascript",
    jsx: "jsx",
    ps1: "powershell",
    py: "python",
    sh: "shell",
    ts: "typescript",
    tsx: "tsx"
  };

  return labels[normalized] ?? normalized;
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
  return /^(?:Aion|Aria)(?: Mind| Research| Analyzer)? is not configured yet\. Add (?:the required|at least one) server-side API key and model ID, then restart the dev server\./i.test(
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
