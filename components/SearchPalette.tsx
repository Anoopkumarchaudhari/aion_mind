"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { formatDistanceToNow } from "date-fns";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { sortThreads, useChatStore, type ChatThread, type UiMessage } from "@/store/useChatStore";

type SearchPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const threads = useChatStore((state) => state.threads);
  const selectThread = useChatStore((state) => state.selectThread);
  const sortedThreads = useMemo(() => sortThreads(threads), [threads]);
  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (normalizedQuery.length < 2) {
      return sortedThreads.slice(0, 8);
    }

    return sortedThreads.filter((thread) => {
      return (
        thread.title.toLowerCase().includes(normalizedQuery) ||
        thread.messages.some((message) => message.content.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [normalizedQuery, sortedThreads]);

  if (!open) {
    return null;
  }

  function openThread(thread: ChatThread) {
    selectThread(thread.id);
    onOpenChange(false);
    setQuery("");
    router.push(`/chat/${thread.id}`);
  }

  return (
    <motion.div
      className="palette-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={() => onOpenChange(false)}
    >
      <Command
        className="search-palette"
        shouldFilter={false}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="palette-input-row">
          <Search size={18} />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search chats..."
            className="palette-input"
          />
          <kbd className="palette-kbd">esc</kbd>
        </div>
        <Command.List className="palette-list">
          <Command.Empty className="palette-empty">
            No chats match "{query}"
          </Command.Empty>
          {results.map((thread) => (
            <Command.Item
              key={thread.id}
              value={thread.id}
              className="palette-item"
              onSelect={() => openThread(thread)}
            >
              <div className="palette-title">
                <Highlight text={thread.title} query={normalizedQuery} />
                <span>{formatDistanceToNow(thread.updatedAt, { addSuffix: true })}</span>
              </div>
              <p className="palette-snippet">
                <Snippet messages={thread.messages} query={normalizedQuery} />
              </p>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </motion.div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (query.length < 2) {
    return <span>{text}</span>;
  }

  const lower = text.toLowerCase();
  const index = lower.indexOf(query);

  if (index === -1) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </span>
  );
}

function Snippet({ messages, query }: { messages: UiMessage[]; query: string }) {
  if (messages.length === 0) {
    return "Empty chat";
  }

  const matchingMessage =
    query.length >= 2
      ? messages.find((message) => message.content.toLowerCase().includes(query))
      : messages[0];

  if (!matchingMessage) {
    return messages[0].content.slice(0, 96);
  }

  if (query.length < 2) {
    return matchingMessage.content.slice(0, 96);
  }

  const lower = matchingMessage.content.toLowerCase();
  const matchIndex = lower.indexOf(query);
  const start = Math.max(0, matchIndex - 30);
  const end = Math.min(matchingMessage.content.length, matchIndex + query.length + 30);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < matchingMessage.content.length ? "..." : "";

  return `${prefix}${matchingMessage.content.slice(start, end)}${suffix}`;
}
