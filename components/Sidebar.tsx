"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Film,
  HelpCircle,
  History,
  Image as ImageIcon,
  Keyboard,
  Languages,
  LayoutDashboard,
  LogOut,
  Moon,
  NotebookTabs,
  Pin,
  Podcast,
  Plus,
  Search,
  Settings,
  Sun,
  Volume2
} from "lucide-react";
import { AionLogo } from "@/components/AionLogo";
import { useThemeStore } from "@/store/useThemeStore";
import { getBillingPlan, useBillingStore } from "@/store/useBillingStore";
import { ChatRowMenu } from "@/components/ChatRowMenu";
import { RenameInline } from "@/components/RenameInline";
import { cardItemVariants, gentleSpring, sidebarBackdropVariants } from "@/lib/motion";
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

type AuthMeResponse = {
  user?: {
    name?: string;
  };
} | null;

export function Sidebar({
  threads,
  activeThreadId,
  isOpen,
  isCollapsed,
  tempMode,
  notebooks,
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
  onOpenShortcuts
}: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showVideoNew, setShowVideoNew] = useState(false);
  const [account, setAccount] = useState({ name: ACCOUNT_NAME });
  const planId = useBillingStore((state) => state.planId);
  const planName = getBillingPlan(planId).name;
  const resolvedTheme = useThemeStore((state) => state.resolved);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const pinnedThreads = useMemo(() => threads.filter((thread) => thread.pinned), [threads]);
  const recentThreads = useMemo(() => threads.filter((thread) => !thread.pinned), [threads]);
  const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");
  const displayedActiveThreadId = isChatRoute ? activeThreadId : "";

  useEffect(() => {
    const visited = Number(window.localStorage.getItem(VIDEO_VISIT_KEY) || "0");
    setShowVideoNew(!visited || Date.now() - visited < NEW_PILL_MS);
  }, []);

  useEffect(() => {
    [
      "/images",
      "/videos",
      "/podcast",
      "/translate",
      "/library",
      "/notebooks",
      "/billing",
      "/settings"
    ].forEach((route) => router.prefetch(route));
  }, [router]);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }

        return response.ok ? response.json() : null;
      })
      .then((data: AuthMeResponse) => {
        if (data?.user?.name) {
          setAccount({ name: data.user.name });
        }
      })
      .catch(() => undefined);
  }, [router]);

  function markVideosVisited() {
    if (!window.localStorage.getItem(VIDEO_VISIT_KEY)) {
      window.localStorage.setItem(VIDEO_VISIT_KEY, String(Date.now()));
    }

    setShowVideoNew(true);
    onClose();
  }

  async function handleSignOut() {
    if (!window.confirm("Sign out of Aria Mind on this device?")) {
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
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.button
            className="sidebar-backdrop"
            type="button"
            aria-label="Close sidebar"
            variants={sidebarBackdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
          />
        ) : null}
      </AnimatePresence>

      <motion.aside
        className={clsx("sidebar", isOpen && "is-open", isCollapsed && "is-collapsed")}
        aria-label="Chat history"
        layout="size"
        transition={gentleSpring}
      >
        <div className="brand-row">
          <AionLogo size={28} />
          <div className="brand-copy">
            <p className="brand-name">Aria Mind</p>
            <p className="brand-status">By JB Crownstone</p>
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

        <nav className="sidebar-actions" aria-label="Primary navigation">
          <div className="sidebar-action-group">
            <button className="sidebar-action" type="button" onClick={onOpenSearch} title="Search chat">
              <Search size={17} />
              <span className="sidebar-action-label">Search chat</span>
              <kbd className="sidebar-kbd">Ctrl K</kbd>
            </button>
            <button className="sidebar-action is-primary" type="button" onClick={onNewChat} title="New chat">
              <Plus size={17} />
              <span className="sidebar-action-label">New chat</span>
            </button>
            <button className="sidebar-action" type="button" onClick={onOpenSearch} title="Chat history">
              <History size={17} />
              <span className="sidebar-action-label">Chat history</span>
            </button>
          </div>

          <div className="sidebar-action-group">
            <div className="sidebar-section-label">Generative AI</div>
            <Link
              className={clsx("sidebar-action", isActiveRoute(pathname, "/images") && "is-active")}
              href="/images"
              aria-current={isActiveRoute(pathname, "/images") ? "page" : undefined}
              onClick={onClose}
              title="Image"
            >
              <ImageIcon size={17} />
              <span className="sidebar-action-label">Image</span>
            </Link>
            <Link
              className={clsx("sidebar-action", isActiveRoute(pathname, "/videos") && "is-active")}
              href="/videos"
              aria-current={isActiveRoute(pathname, "/videos") ? "page" : undefined}
              onClick={markVideosVisited}
              title="Video"
            >
              <Film size={17} />
              <span className="sidebar-action-label">Video</span>
              {showVideoNew ? <span className="new-pill">New</span> : null}
            </Link>
            <button className="sidebar-action" type="button" disabled title="Audio coming soon">
              <Volume2 size={17} />
              <span className="sidebar-action-label">Audio</span>
              <span className="new-pill">Soon</span>
            </button>
            <Link
              className={clsx("sidebar-action", isActiveRoute(pathname, "/podcast") && "is-active")}
              href="/podcast"
              aria-current={isActiveRoute(pathname, "/podcast") ? "page" : undefined}
              onClick={onClose}
              title="Podcast"
            >
              <Podcast size={17} />
              <span className="sidebar-action-label">Podcast</span>
            </Link>
            <Link
              className={clsx("sidebar-action", isActiveRoute(pathname, "/translate") && "is-active")}
              href="/translate"
              aria-current={isActiveRoute(pathname, "/translate") ? "page" : undefined}
              onClick={onClose}
              title="Translate"
            >
              <Languages size={17} />
              <span className="sidebar-action-label">Translate</span>
            </Link>
          </div>

          <div className="sidebar-action-group">
            <Link
              className={clsx("sidebar-action", isActiveRoute(pathname, "/library") && "is-active")}
              href="/library"
              aria-current={isActiveRoute(pathname, "/library") ? "page" : undefined}
              onClick={onClose}
              title="Library"
            >
              <BookOpen size={17} />
              <span className="sidebar-action-label">Library</span>
            </Link>
            <Link
              className={clsx("sidebar-action", isActiveRoute(pathname, "/notebooks") && "is-active")}
              href="/notebooks"
              aria-current={isActiveRoute(pathname, "/notebooks") ? "page" : undefined}
              onClick={onClose}
              title="Notebook"
            >
              <NotebookTabs size={17} />
              <span className="sidebar-action-label">Notebook</span>
            </Link>
          </div>

          <div className="sidebar-action-group">
            <div className="sidebar-section-label">Workspace</div>
            <Link
              className={clsx("sidebar-action", isActiveRoute(pathname, "/settings") && "is-active")}
              href="/settings?tab=billing"
              aria-current={isActiveRoute(pathname, "/settings") ? "page" : undefined}
              onClick={onClose}
              title="Billing"
            >
              <CreditCard size={17} />
              <span className="sidebar-action-label">Billing</span>
            </Link>
          </div>
        </nav>

        <div className="history-section">
          {pinnedThreads.length > 0 ? (
            <ThreadSection
              label="Chat history"
              threads={pinnedThreads}
              activeThreadId={displayedActiveThreadId}
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
            label="Recent chat"
            threads={recentThreads}
            activeThreadId={displayedActiveThreadId}
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
              <span className="user-avatar" aria-hidden="true">{getInitials(account.name)}</span>
              <span className="sidebar-user-copy">
                <span className="sidebar-user-name">{account.name}</span>
                <span className="sidebar-user-plan">{planName}</span>
              </span>
              <Settings className="sidebar-settings" size={15} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="chat-menu-content user-menu-content" side="right" align="end" sideOffset={10}>
              <DropdownMenu.Item className="chat-menu-item" asChild>
                <Link href="/settings?tab=dashboard">
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="chat-menu-item" asChild>
                <Link href="/settings">
                  <Settings size={16} />
                  Settings
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="chat-menu-item"
                onSelect={(event) => {
                  event.preventDefault();
                  toggleTheme();
                }}
              >
                {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
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
      </motion.aside>
    </>
  );
}

function isActiveRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
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
                  variants={cardItemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
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
      return "Aria Mind";
    case "aion-mind-pro":
      return "Aria Research";
    case "aion-mind-analyzer":
      return "Aria Analyzer";
  }
}
