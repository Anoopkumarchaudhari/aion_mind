"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  Film,
  HelpCircle,
  Keyboard,
  LogOut,
  MoreVertical,
  NotebookTabs,
  Palette,
  Pin,
  Plus,
  Search,
  Settings
} from "lucide-react";
import { AionLogo } from "@/components/AionLogo";
import { ChatRowMenu } from "@/components/ChatRowMenu";
import { RenameInline } from "@/components/RenameInline";
import type { AionModelId } from "@/types/aion";
import type { Notebook } from "@/types/workspace";

type SidebarThread = {
  id: string;
  title: string;
  model: AionModelId;
  pinned?: boolean;
  notebook?: string;
};

type SidebarProps = {
  threads: SidebarThread[];
  activeThreadId: string;
  isOpen: boolean;
  isCollapsed: boolean;
  tempMode: boolean;
  notebooks: string[];
  notebookItems?: Notebook[];
  onClose: () => void;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  onSelectThread: (thread: SidebarThread) => void;
  onShareThread: (threadId: string) => void | Promise<void>;
  onTogglePin: (threadId: string) => void | Promise<void>;
  onRenameThread: (threadId: string, title: string) => void | Promise<void>;
  onAddToNotebook: (threadId: string, notebook: string) => void;
  onCreateNotebook: (name: string) => void;
  onDeleteThread: (threadId: string) => void | Promise<void>;
  onOpenSearch?: () => void;
  onCreateNotebookDialog?: () => void;
  onSelectNotebook?: (id: string) => void;
  onRenameNotebook?: (id: string, title: string) => void;
  onChangeNotebookEmoji?: (id: string, emoji: string) => void;
  onDuplicateNotebook?: (id: string) => void;
  onDeleteNotebook?: (id: string) => void;
  onOpenShortcuts?: () => void;
};

const VIDEO_VISIT_KEY = "aion-mind-videos-first-visit";
const NEW_PILL_MS = 7 * 24 * 60 * 60 * 1000;
const ACCOUNT_NAME = "Anoop Kumar";
const ACCOUNT_PLAN = "Pro";
const ACCOUNT_AVATAR_SRC = "/profile_avtar.png";

export function Sidebar({
  threads,
  activeThreadId,
  isOpen,
  isCollapsed,
  tempMode,
  notebooks,
  notebookItems = [],
  onClose,
  onToggleCollapsed,
  onNewChat,
  onSelectThread,
  onShareThread,
  onTogglePin,
  onRenameThread,
  onAddToNotebook,
  onCreateNotebook,
  onDeleteThread,
  onOpenSearch,
  onCreateNotebookDialog,
  onSelectNotebook,
  onRenameNotebook,
  onChangeNotebookEmoji,
  onDuplicateNotebook,
  onDeleteNotebook,
  onOpenShortcuts
}: SidebarProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showVideoNew, setShowVideoNew] = useState(false);
  const [account, setAccount] = useState({ name: ACCOUNT_NAME, plan: ACCOUNT_PLAN });
  const pinnedThreads = useMemo(() => threads.filter((thread) => thread.pinned), [threads]);
  const recentThreads = useMemo(() => threads.filter((thread) => !thread.pinned), [threads]);
  const recentNotebooks = useMemo(
    () => [...notebookItems].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 5),
    [notebookItems]
  );

  useEffect(() => {
    const visited = Number(window.localStorage.getItem(VIDEO_VISIT_KEY) || "0");
    setShowVideoNew(!visited || Date.now() - visited < NEW_PILL_MS);
  }, []);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { name?: string } } | null) => {
        if (data?.user?.name) {
          setAccount({ name: data.user.name, plan: ACCOUNT_PLAN });
        }
      })
      .catch(() => undefined);
  }, []);

  function markVideosVisited() {
    if (!window.localStorage.getItem(VIDEO_VISIT_KEY)) {
      window.localStorage.setItem(VIDEO_VISIT_KEY, String(Date.now()));
    }

    setShowVideoNew(true);
    onClose();
  }

  async function handleSignOut() {
    if (!window.confirm("Sign out of Aion Mind on this device?")) {
      return;
    }

    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("aion-mind"))
      .forEach((key) => window.localStorage.removeItem(key));
    window.location.href = "/login";
  }

  return (
    <>
      {isOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={clsx("sidebar", isOpen && "is-open", isCollapsed && "is-collapsed")}
        aria-label="Chat history"
      >
        <div className="brand-row">
          <AionLogo size={28} />
          <div className="brand-copy">
            <p className="brand-name">Aion Mind</p>
            <p className="brand-status">AI dashboard</p>
          </div>
          <button
            className="square-icon"
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="sidebar-actions">
          <button className="sidebar-action is-primary" type="button" onClick={onNewChat} title="New chat">
            <Plus size={17} />
            <span className="sidebar-action-label">New chat</span>
          </button>
          <button className="sidebar-action" type="button" onClick={onOpenSearch} title="Search chats">
            <Search size={17} />
            <span className="sidebar-action-label">Search chats</span>
            <kbd className="sidebar-kbd">⌘K</kbd>
          </button>
          <Link className="sidebar-action" href="/videos" onClick={markVideosVisited} title="Videos">
            <Film size={17} />
            <span className="sidebar-action-label">Videos</span>
            {showVideoNew ? <span className="new-pill">New</span> : null}
          </Link>
          <Link className="sidebar-action" href="/library" onClick={onClose} title="Library">
            <BookOpen size={17} />
            <span className="sidebar-action-label">Library</span>
          </Link>
        </div>

        <div className="history-section">
          <div className="history-group notebook-group">
            <div className="sidebar-section-label">Notebooks</div>
            <button className="notebook-new-row" type="button" onClick={onCreateNotebookDialog} title="New notebook">
              <Plus size={14} />
              <span>New notebook</span>
            </button>
            {recentNotebooks.map((notebook) => (
              <div className="notebook-row" key={notebook.id}>
                <button className="notebook-link" type="button" onClick={() => onSelectNotebook?.(notebook.id)}>
                  <span className="notebook-emoji" style={{ backgroundColor: notebook.color }}>
                    {notebook.emoji}
                  </span>
                  <span className="history-title-text">{notebook.title}</span>
                </button>
                <NotebookMenu
                  notebook={notebook}
                  onRenameNotebook={onRenameNotebook}
                  onChangeNotebookEmoji={onChangeNotebookEmoji}
                  onDuplicateNotebook={onDuplicateNotebook}
                  onDeleteNotebook={onDeleteNotebook}
                />
              </div>
            ))}
            {notebookItems.length > 5 ? (
              <Link className="show-more-row" href="/notebooks" onClick={onClose}>
                Show all notebooks
              </Link>
            ) : null}
          </div>

          {pinnedThreads.length > 0 ? (
            <ThreadSection
              label="Pinned"
              threads={pinnedThreads}
              activeThreadId={activeThreadId}
              tempMode={tempMode}
              notebooks={notebooks}
              openMenuId={openMenuId}
              renamingId={renamingId}
              onOpenMenuChange={setOpenMenuId}
              onRenameStart={setRenamingId}
              onRenameCancel={() => setRenamingId(null)}
              onSelectThread={onSelectThread}
              onShareThread={onShareThread}
              onTogglePin={onTogglePin}
              onRenameThread={async (threadId, title) => {
                await onRenameThread(threadId, title);
                setRenamingId(null);
              }}
              onAddToNotebook={onAddToNotebook}
              onCreateNotebook={onCreateNotebook}
              onDeleteThread={onDeleteThread}
            />
          ) : null}

          <ThreadSection
            label="Recents"
            threads={recentThreads}
            activeThreadId={activeThreadId}
            tempMode={tempMode}
            notebooks={notebooks}
            openMenuId={openMenuId}
            renamingId={renamingId}
            limit={15}
            onShowMore={onOpenSearch}
            onOpenMenuChange={setOpenMenuId}
            onRenameStart={setRenamingId}
            onRenameCancel={() => setRenamingId(null)}
            onSelectThread={onSelectThread}
            onShareThread={onShareThread}
            onTogglePin={onTogglePin}
            onRenameThread={async (threadId, title) => {
              await onRenameThread(threadId, title);
              setRenamingId(null);
            }}
            onAddToNotebook={onAddToNotebook}
            onCreateNotebook={onCreateNotebook}
            onDeleteThread={onDeleteThread}
          />
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="sidebar-user" type="button" title="Account menu">
              <img className="user-avatar" src={ACCOUNT_AVATAR_SRC} alt="" aria-hidden="true" />
              <span className="sidebar-user-copy">
                <span className="sidebar-user-name">{account.name}</span>
                <span className="sidebar-user-plan">{account.plan}</span>
              </span>
              <Settings className="sidebar-settings" size={15} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="chat-menu-content user-menu-content" side="right" align="end" sideOffset={10}>
              <DropdownMenu.Item className="chat-menu-item" asChild>
                <Link href="/settings">
                  <Settings size={16} />
                  Settings
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="chat-menu-item" onSelect={onOpenShortcuts}>
                <Keyboard size={16} />
                Keyboard shortcuts
              </DropdownMenu.Item>
              <DropdownMenu.Item className="chat-menu-item" asChild>
                <Link href="/settings?tab=help">
                  <HelpCircle size={16} />
                  Help
                </Link>
              </DropdownMenu.Item>
              <div className="chat-menu-separator" />
              <DropdownMenu.Item
                className="chat-menu-item is-danger"
                onSelect={() => void handleSignOut()}
              >
                <LogOut size={16} />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </aside>
    </>
  );
}

type NotebookMenuProps = {
  notebook: Notebook;
  onRenameNotebook?: (id: string, title: string) => void;
  onChangeNotebookEmoji?: (id: string, emoji: string) => void;
  onDuplicateNotebook?: (id: string) => void;
  onDeleteNotebook?: (id: string) => void;
};

function NotebookMenu({
  notebook,
  onRenameNotebook,
  onChangeNotebookEmoji,
  onDuplicateNotebook,
  onDeleteNotebook
}: NotebookMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="history-menu-trigger is-visible" type="button" aria-label={`Notebook actions for ${notebook.title}`}>
          <MoreVertical size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="chat-menu-content" side="right" align="start" sideOffset={12}>
          <DropdownMenu.Item
            className="chat-menu-item"
            onSelect={() => {
              const title = window.prompt("Rename notebook", notebook.title)?.trim();

              if (title) {
                onRenameNotebook?.(notebook.id, title);
              }
            }}
          >
            <NotebookTabs size={16} />
            Rename
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="chat-menu-item"
            onSelect={() => {
              const emoji = window.prompt("Notebook emoji", notebook.emoji)?.trim();

              if (emoji) {
                onChangeNotebookEmoji?.(notebook.id, emoji);
              }
            }}
          >
            <Palette size={16} />
            Change emoji
          </DropdownMenu.Item>
          <DropdownMenu.Item className="chat-menu-item" onSelect={() => onDuplicateNotebook?.(notebook.id)}>
            <Copy size={16} />
            Duplicate
          </DropdownMenu.Item>
          <div className="chat-menu-separator" />
          <DropdownMenu.Item
            className="chat-menu-item is-danger"
            onSelect={() => {
              if (window.confirm(`Delete "${notebook.title}"?`)) {
                onDeleteNotebook?.(notebook.id);
              }
            }}
          >
            <MoreVertical size={16} />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type ThreadSectionProps = {
  label: string;
  threads: SidebarThread[];
  activeThreadId: string;
  tempMode: boolean;
  notebooks: string[];
  openMenuId: string | null;
  renamingId: string | null;
  limit?: number;
  onShowMore?: () => void;
  onOpenMenuChange: (threadId: string | null) => void;
  onRenameStart: (threadId: string) => void;
  onRenameCancel: () => void;
  onSelectThread: (thread: SidebarThread) => void;
  onShareThread: (threadId: string) => void | Promise<void>;
  onTogglePin: (threadId: string) => void | Promise<void>;
  onRenameThread: (threadId: string, title: string) => void | Promise<void>;
  onAddToNotebook: (threadId: string, notebook: string) => void;
  onCreateNotebook: (name: string) => void;
  onDeleteThread: (threadId: string) => void | Promise<void>;
};

function ThreadSection({
  label,
  threads,
  activeThreadId,
  tempMode,
  notebooks,
  openMenuId,
  renamingId,
  limit,
  onShowMore,
  onOpenMenuChange,
  onRenameStart,
  onRenameCancel,
  onSelectThread,
  onShareThread,
  onTogglePin,
  onRenameThread,
  onAddToNotebook,
  onCreateNotebook,
  onDeleteThread
}: ThreadSectionProps) {
  const visibleThreads = limit ? threads.slice(0, limit) : threads;

  return (
    <div className="history-group thread-history-group">
      <div className="sidebar-section-label">{label}</div>
      <div className="history-list">
        {visibleThreads.length === 0 ? (
          <div className="empty-history">No chats yet.</div>
        ) : (
          <AnimatePresence initial={false}>
            {visibleThreads.map((thread) => {
              const menuDisabled = tempMode && thread.id === activeThreadId;
              const isRenaming = renamingId === thread.id;

              return (
                <motion.div
                  className={clsx(
                    "history-item",
                    thread.id === activeThreadId && "is-active",
                    openMenuId === thread.id && "is-menu-open"
                  )}
                  key={thread.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  title={`${thread.title} - ${getDisplayModelLabel(thread.model)}`}
                >
                  {isRenaming ? (
                    <RenameInline
                      title={thread.title}
                      onCancel={onRenameCancel}
                      onSave={(title) => onRenameThread(thread.id, title)}
                    />
                  ) : (
                    <button
                      className="history-button"
                      type="button"
                      onClick={() => onSelectThread(thread)}
                    >
                      <span className="history-title">
                        {thread.pinned ? <Pin className="history-pin" size={12} /> : null}
                        <span className="history-title-text">{thread.title}</span>
                      </span>
                    </button>
                  )}

                  <ChatRowMenu
                    chatId={thread.id}
                    title={thread.title}
                    pinned={thread.pinned}
                    disabled={menuDisabled}
                    notebooks={notebooks}
                    open={openMenuId === thread.id}
                    onOpenChange={(open) => onOpenMenuChange(open ? thread.id : null)}
                    onShare={() => onShareThread(thread.id)}
                    onTogglePin={() => onTogglePin(thread.id)}
                    onRename={() => onRenameStart(thread.id)}
                    onAddToNotebook={(notebook) => onAddToNotebook(thread.id, notebook)}
                    onCreateNotebook={onCreateNotebook}
                    onDelete={() => onDeleteThread(thread.id)}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        {limit && threads.length > limit ? (
          <button className="show-more-row" type="button" onClick={onShowMore}>
            Show more
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getDisplayModelLabel(model: AionModelId) {
  switch (model) {
    case "aion-mind":
      return "Aion Mind";
    case "aion-mind-pro":
      return "Aion Mind Pro";
    case "aion-mind-analyzer":
      return "Aion Mind Analyser";
  }
}
