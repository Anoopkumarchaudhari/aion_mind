"use client";

import clsx from "clsx";
import type { ClipboardEvent, DragEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, Image as ImageIcon, Mic, Paperclip, Plus, Square, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import TextareaAutosize from "react-textarea-autosize";
import type { ChatAttachment } from "@/types/aion";

type MessageInputProps = {
  value: string;
  disabled: boolean;
  tempMode: boolean;
  attachments: ChatAttachment[];
  isReadingFiles: boolean;
  attachmentError?: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onSubmit: (event?: FormEvent) => void;
  onStop: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: { transcript?: string } | undefined;
};

type SpeechRecognitionEventLike = Event & {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike | undefined;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onstart: (() => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function MessageInput({
  value,
  disabled,
  tempMode,
  attachments,
  isReadingFiles,
  attachmentError,
  inputRef,
  onChange,
  onSubmit,
  onStop,
  onKeyDown,
  onAttachFiles,
  onRemoveAttachment
}: MessageInputProps) {
  const [pulse, setPulse] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseTextRef = useRef("");
  const canSend = value.trim().length > 0 || attachments.length > 0;
  const composerError = attachmentError ?? voiceError;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function handleAlreadyOnNewChat() {
      if (timeout) {
        clearTimeout(timeout);
      }

      setPulse(true);
      timeout = setTimeout(() => setPulse(false), 600);
    }

    window.addEventListener("aion:already-on-new-chat", handleAlreadyOnNewChat);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      window.removeEventListener("aion:already-on-new-chat", handleAlreadyOnNewChat);
    };
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (disabled && isListening) {
      recognitionRef.current?.stop();
    }
  }, [disabled, isListening]);

  function attachFiles(files: FileList | File[]) {
    const list = Array.from(files);

    if (list.length > 0) {
      onAttachFiles(list);
    }
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>) {
    if (disabled) {
      return;
    }

    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!disabled && event.dataTransfer.files.length > 0) {
      attachFiles(event.dataTransfer.files);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (disabled || event.clipboardData.files.length === 0) {
      return;
    }

    event.preventDefault();
    attachFiles(event.clipboardData.files);
  }

  function toggleVoiceInput() {
    if (disabled || isReadingFiles) {
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as SpeechRecognitionWindow).SpeechRecognition ??
      (window as SpeechRecognitionWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognitionRef.current = recognition;
    voiceBaseTextRef.current = value.trimEnd();

    recognition.onstart = () => {
      setVoiceError(null);
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      setIsListening(false);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceError("Microphone permission was blocked. Allow microphone access and try again.");
      } else if (event.error === "no-speech") {
        setVoiceError("I did not hear anything. Try speaking again.");
      } else {
        setVoiceError(event.message || "Voice input stopped. Try again.");
      }
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? "";
      }

      const voiceText = transcript.trim();
      const baseText = voiceBaseTextRef.current;
      onChange([baseText, voiceText].filter(Boolean).join(" "));
    };

    try {
      recognition.start();
    } catch {
      setVoiceError("Voice input could not start. Please try again.");
      setIsListening(false);
    }
  }

  return (
    <form
      className={clsx("composer", isDragging && "is-dragging")}
      onSubmit={onSubmit}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={clsx("composer-field", pulse && "is-pulsing", isDragging && "is-dragging")}>
        {attachments.length > 0 ? (
          <div className="composer-attachments" aria-label="Attached files">
            {attachments.map((attachment) => {
              const previewSrc = getAttachmentPreviewSrc(attachment);

              if (previewSrc) {
                return (
                  <div className="composer-image-attachment" key={attachment.id}>
                    <img src={previewSrc} alt={attachment.name} />
                    <button
                      type="button"
                      aria-label={`Remove ${attachment.name}`}
                      title="Remove image"
                      onClick={() => onRemoveAttachment(attachment.id)}
                      disabled={disabled}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              }

              return (
                <div className="composer-attachment" key={attachment.id}>
                  {attachment.kind === "image" ? <ImageIcon size={15} /> : <FileText size={15} />}
                  <span className="composer-attachment-name">{attachment.name}</span>
                  <span className="composer-attachment-size">{formatBytes(attachment.size)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.name}`}
                    title="Remove file"
                    onClick={() => onRemoveAttachment(attachment.id)}
                    disabled={disabled}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="composer-input-row">
          <label
            className={clsx("input-plus", (disabled || isReadingFiles) && "is-disabled")}
            aria-label="Attach files"
            title="Attach files"
            aria-disabled={disabled || isReadingFiles}
          >
            <input
              className="file-input"
              type="file"
              multiple
              disabled={disabled || isReadingFiles}
              onChange={(event) => {
                if (event.currentTarget.files) {
                  attachFiles(event.currentTarget.files);
                }

                event.currentTarget.value = "";
              }}
            />
            {isReadingFiles ? <Paperclip size={17} /> : <Plus size={18} />}
          </label>
          <TextareaAutosize
            ref={inputRef}
            className="composer-textarea"
            value={value}
            minRows={1}
            maxRows={6}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            placeholder="Ask Aion Mind"
            disabled={disabled}
            aria-label="Message"
          />
          <button
            className={clsx("input-plus", (disabled || isReadingFiles) && "is-disabled")}
            type="button"
            onClick={toggleVoiceInput}
            disabled={disabled || isReadingFiles}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
            aria-pressed={isListening}
            title={isListening ? "Stop voice input" : "Start voice input"}
            style={
              isListening
                ? {
                    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
                    color: "var(--accent)"
                  }
                : undefined
            }
          >
            <Mic size={18} />
          </button>
          <button
            className="send-button"
            type={disabled ? "button" : "submit"}
            onClick={disabled ? onStop : undefined}
            disabled={!disabled && (!canSend || isReadingFiles)}
            aria-label={disabled ? "Stop generating" : "Send message"}
            title={disabled ? "Stop generating" : "Send message"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {disabled ? (
                <motion.span
                  key="stop"
                  layoutId="send-icon"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.14 }}
                >
                  <Square size={14} fill="currentColor" />
                </motion.span>
              ) : (
                <motion.span
                  key="arrow"
                  layoutId="send-icon"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.14 }}
                >
                  <ArrowUp size={16} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
      {composerError ? <p className="composer-error">{composerError}</p> : null}
      <p className="composer-disclaimer">
        {tempMode
          ? "Temporary chat. Nothing here will be saved or used to train models."
          : "Aion Mind synthesizes answers from multiple reasoning engines. Verify important info."}
      </p>
    </form>
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

function getAttachmentPreviewSrc(attachment: ChatAttachment) {
  if (attachment.kind !== "image" || !attachment.previewData) {
    return "";
  }

  return /^data:image\/(?:png|jpe?g|webp|heic|heif);base64,/i.test(attachment.previewData)
    ? attachment.previewData
    : "";
}
