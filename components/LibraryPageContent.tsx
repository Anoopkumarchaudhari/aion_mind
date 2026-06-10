"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { Code2, Download, FileText, Image, MessageSquare, MoreVertical, Pencil, Trash2, Video } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { useLibraryStore } from "@/store/useLibraryStore";
import type { LibraryItem, LibraryItemType } from "@/types/workspace";

const filters: Array<"all" | LibraryItemType> = ["all", "chat", "code", "image", "video", "document"];

export function LibraryPageContent() {
  const [filter, setFilter] = useState<"all" | LibraryItemType>("all");
  const [query, setQuery] = useState("");
  const items = useLibraryStore((state) => state.items);
  const renameItem = useLibraryStore((state) => state.renameItem);
  const removeItem = useLibraryStore((state) => state.removeItem);
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesFilter = filter === "all" || item.type === filter;
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.content?.toLowerCase().includes(q) ||
        item.url?.toLowerCase().includes(q);

      return matchesFilter && matchesQuery;
    });
  }, [filter, items, query]);

  return (
    <AppFrame title="Library">
      <section className="route-content">
        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Saved artifacts</p>
            <h2>Library</h2>
          </div>
          <input
            className="route-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search library..."
          />
        </div>
        <div className="filter-tabs" role="tablist" aria-label="Library filters">
          {filters.map((item) => (
            <button
              className={item === filter ? "is-active" : ""}
              type="button"
              key={item}
              onClick={() => setFilter(item)}
            >
              {item === "all" ? "All" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <div className="empty-panel">
            <h3>No saved items yet</h3>
            <p>Save AI responses, code snippets, or generated videos and they will appear here.</p>
          </div>
        ) : (
          <div className="artifact-grid">
            {filteredItems.map((item) => (
              <article className="artifact-card" key={item.id}>
                <div className="artifact-icon">{getIcon(item.type)}</div>
                <div className="artifact-card-body">
                  <h3>{item.title}</h3>
                  <Preview item={item} />
                </div>
                <div className="artifact-meta">
                  {item.sourceChatId ? <Link href={`/chat/${item.sourceChatId}`}>Source chat</Link> : <span />}
                  <time>{formatDistanceToNow(item.createdAt, { addSuffix: true })}</time>
                </div>
                <LibraryMenu item={item} onRename={renameItem} onRemove={removeItem} />
              </article>
            ))}
          </div>
        )}
      </section>
    </AppFrame>
  );
}

function LibraryMenu({
  item,
  onRename,
  onRemove
}: {
  item: LibraryItem;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="artifact-menu-trigger" type="button" aria-label={`Open menu for ${item.title}`}>
          <MoreVertical size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="chat-menu-content" align="end" sideOffset={8}>
          {item.sourceChatId ? (
            <DropdownMenu.Item className="chat-menu-item" asChild>
              <Link href={`/chat/${item.sourceChatId}`}>
                <MessageSquare size={16} />
                Open in chat
              </Link>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item className="chat-menu-item" onSelect={() => downloadItem(item)}>
            <Download size={16} />
            Download
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="chat-menu-item"
            onSelect={() => {
              const title = window.prompt("Rename library item", item.title)?.trim();

              if (title) {
                onRename(item.id, title);
              }
            }}
          >
            <Pencil size={16} />
            Rename
          </DropdownMenu.Item>
          <div className="chat-menu-separator" />
          <DropdownMenu.Item className="chat-menu-item is-danger" onSelect={() => onRemove(item.id)}>
            <Trash2 size={16} />
            Remove from library
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Preview({ item }: { item: LibraryItem }) {
  if (item.url && (item.type === "image" || item.type === "video")) {
    return <MediaPreview item={item} />;
  }

  return <p>{(item.content || item.url || "Saved item").split("\n").slice(0, 3).join("\n").slice(0, 220)}</p>;
}

function MediaPreview({ item }: { item: LibraryItem }) {
  const [hasError, setHasError] = useState(false);

  if (!item.url || hasError) {
    return (
      <div className="artifact-thumb artifact-thumb-missing">
        {item.type === "video" ? <Video size={18} /> : <Image size={18} />}
        <span>{item.type === "video" ? "Video unavailable" : "Image unavailable"}</span>
      </div>
    );
  }

  return <img className="artifact-thumb" src={item.url} alt="" onError={() => setHasError(true)} />;
}

function getIcon(type: LibraryItemType) {
  switch (type) {
    case "chat":
      return <MessageSquare size={18} />;
    case "code":
      return <Code2 size={18} />;
    case "image":
      return <Image size={18} />;
    case "video":
      return <Video size={18} />;
    case "document":
      return <FileText size={18} />;
  }
}

function downloadItem(item: LibraryItem) {
  const content = item.content || item.url || item.title;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${item.title.replace(/[^\w-]+/g, "-").toLowerCase() || "aion-item"}.txt`;
  anchor.click();
  URL.revokeObjectURL(href);
}
