"use client";

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { AppFrame } from "@/components/AppFrame";
import { sortThreads, useChatStore } from "@/store/useChatStore";

export function SearchPageContent() {
  const threads = useChatStore((state) => state.threads);
  const sortedThreads = useMemo(() => sortThreads(threads), [threads]);

  return (
    <AppFrame title="Search">
      <section className="route-content">
        <div className="page-hero compact">
          <p className="eyebrow">Command palette</p>
          <h2>Find any conversation</h2>
          <p>Use search to jump into chats by title, answer text, or prompt history.</p>
          <button className="primary-button" type="button" onClick={() => window.dispatchEvent(new Event("aion:open-search"))}>
            Open search
          </button>
        </div>
        <div className="list-panel">
          {sortedThreads.map((thread) => (
            <a className="list-row" href={`/chat/${thread.id}`} key={thread.id}>
              <div>
                <strong>{thread.title}</strong>
                <span>{thread.messages[0]?.content.slice(0, 120) || "Empty chat"}</span>
              </div>
              <time>{formatDistanceToNow(thread.updatedAt, { addSuffix: true })}</time>
            </a>
          ))}
        </div>
      </section>
    </AppFrame>
  );
}
