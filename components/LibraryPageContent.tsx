"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Code2, Download, FileText, Image, MessageSquare, MoreVertical, Pencil, Trash2, Video } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import {
  hoverLift,
  scrollContainerVariants,
  scrollItemVariants,
  scrollRevealVariants,
  scrollRevealViewport
} from "@/lib/motion";
import { useLibraryStore } from "@/store/useLibraryStore";
import type { LibraryItem, LibraryItemType } from "@/types/workspace";

const filters: Array<"all" | LibraryItemType> = ["all", "chat", "code", "image", "video", "document"];
const scopableTypes: LibraryItemType[] = ["chat", "code", "image", "video", "document"];

export function LibraryPageContent() {
  const searchParams = useSearchParams();
  // When the Library is opened from Studio it carries `?type=image`, scoping the
  // page to a single artifact type. Opened from the main chat sidebar there is
  // no param, so every saved record (chat, image, video, …) is shown.
  const scopeType = useMemo(() => {
    const param = searchParams.get("type") as LibraryItemType | null;
    return param && scopableTypes.includes(param) ? param : null;
  }, [searchParams]);

  const [filter, setFilter] = useState<"all" | LibraryItemType>(scopeType ?? "all");
  const [query, setQuery] = useState("");
  const items = useLibraryStore((state) => state.items);
  const renameItem = useLibraryStore((state) => state.renameItem);
  const removeItem = useLibraryStore((state) => state.removeItem);
  // A scope from the URL is authoritative and can't be switched away from.
  const activeFilter = scopeType ?? filter;
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesFilter = activeFilter === "all" || item.type === activeFilter;
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.content?.toLowerCase().includes(q) ||
        item.url?.toLowerCase().includes(q);

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, items, query]);

  const scopeLabel = scopeType ? scopeType[0].toUpperCase() + scopeType.slice(1) : null;

  return (
    <AppFrame title={scopeLabel ? `${scopeLabel} Library` : "Library"}>
      <section className="route-content">
        <motion.div className="page-toolbar" variants={scrollRevealVariants} initial="hidden" animate="show">
          <div>
            <p className="eyebrow">{scopeLabel ? `Saved ${scopeType}s` : "Saved artifacts"}</p>
            <h2>{scopeLabel ? `${scopeLabel} Library` : "Library"}</h2>
          </div>
          <input
            className="route-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={scopeLabel ? `Search ${scopeType}s...` : "Search library..."}
          />
        </motion.div>
        {scopeType ? null : (
          <motion.div
            className="filter-tabs"
            role="tablist"
            aria-label="Library filters"
            variants={scrollRevealVariants}
            initial="hidden"
            animate="show"
          >
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
          </motion.div>
        )}

        {filteredItems.length === 0 ? (
          <motion.div
            className="empty-panel"
            variants={scrollRevealVariants}
            initial="hidden"
            animate="show"
          >
            <h3>{scopeType ? `No saved ${scopeType}s yet` : "No saved items yet"}</h3>
            <p>
              {scopeType === "image"
                ? "Generate an image in Studio and save it to see it here."
                : "Save AI responses, code snippets, or generated videos and they will appear here."}
            </p>
          </motion.div>
        ) : (
          <motion.div
            className="artifact-grid"
            variants={scrollContainerVariants}
            initial="hidden"
            whileInView="show"
            viewport={scrollRevealViewport}
          >
            {filteredItems.map((item) => (
              <motion.article
                className="artifact-card"
                key={item.id}
                variants={scrollItemVariants}
                whileHover={hoverLift}
              >
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
              </motion.article>
            ))}
          </motion.div>
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

  return (
    <div className="artifact-thumb-wrap">
      <img className="artifact-thumb" src={item.url} alt="" onError={() => setHasError(true)} />
      <button
        className="artifact-thumb-download"
        type="button"
        onClick={() => downloadItem(item)}
        title={`Download ${item.type}`}
        aria-label={`Download ${item.title}`}
      >
        <Download size={15} />
      </button>
    </div>
  );
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

async function downloadItem(item: LibraryItem) {
  // Image/video items download the actual media file; everything else downloads
  // its text content as before.
  if (item.url && (item.type === "image" || item.type === "video")) {
    const ok = await downloadMediaItem(item);

    if (ok) {
      return;
    }
  }

  const content = item.content || item.url || item.title;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${slugifyTitle(item.title)}.txt`;
  anchor.click();
  URL.revokeObjectURL(href);
}

// Fetch the media bytes and trigger a real file download from a blob. A plain
// `<a download>` is ignored for cross-origin URLs, so we go through a blob.
async function downloadMediaItem(item: LibraryItem) {
  if (!item.url) {
    return false;
  }

  try {
    const response = await fetch(item.url);

    if (!response.ok) {
      return false;
    }

    const blob = await response.blob();
    const extension = extensionForBlob(blob.type, item.type);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = `${slugifyTitle(item.title)}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    return false;
  }
}

function extensionForBlob(mimeType: string, type: LibraryItemType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/png") return "png";
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/webm") return "webm";
  return type === "video" ? "mp4" : "png";
}

function slugifyTitle(title: string) {
  return title.replace(/[^\w-]+/g, "-").toLowerCase() || "aion-item";
}
