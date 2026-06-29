"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { pageShellVariants } from "@/lib/motion";
import { sortThreads, useChatStore } from "@/store/useChatStore";
import { useNotebookStore } from "@/store/useNotebookStore";
import { useBillingStore } from "@/store/useBillingStore";

type AppFrameProps = {
  children: ReactNode;
  title?: string;
  sidebar?: (props: AppFrameSidebarProps) => ReactNode;
};

export type AppFrameSidebarProps = {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
};

export function AppFrame({ children, title, sidebar }: AppFrameProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "route";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const rawThreads = useChatStore((state) => state.threads);
  const activeThreadId = useChatStore((state) => state.activeThreadId);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const tempMode = useChatStore((state) => state.tempMode);
  const createOrFocusNewChat = useChatStore((state) => state.createOrFocusNewChat);
  const selectThread = useChatStore((state) => state.selectThread);
  const shareThread = useChatStore((state) => state.shareThread);
  const togglePin = useChatStore((state) => state.togglePin);
  const renameThread = useChatStore((state) => state.renameThread);
  const addThreadNotebookLabel = useChatStore((state) => state.addToNotebook);
  const createThreadNotebookLabel = useChatStore((state) => state.createNotebook);
  const deleteThread = useChatStore((state) => state.deleteThread);
  const notebooks = useNotebookStore((state) => state.notebooks);
  const createNotebook = useNotebookStore((state) => state.createNotebook);
  const renameNotebook = useNotebookStore((state) => state.renameNotebook);
  const updateNotebookMeta = useNotebookStore((state) => state.updateNotebookMeta);
  const duplicateNotebook = useNotebookStore((state) => state.duplicateNotebook);
  const deleteNotebook = useNotebookStore((state) => state.deleteNotebook);
  const addChatToNotebook = useNotebookStore((state) => state.addChatToNotebook);
  const threads = useMemo(() => sortThreads(rawThreads), [rawThreads]);

  useEffect(() => {
    void useBillingStore.getState().loadAccount();

    function toggleSidebar() {
      setSidebarCollapsed((value) => !value);
    }

    window.addEventListener("aion:toggle-sidebar", toggleSidebar);
    return () => window.removeEventListener("aion:toggle-sidebar", toggleSidebar);
  }, []);

  function handleNewChat() {
    const id = createOrFocusNewChat(selectedModel);
    setSidebarOpen(false);
    router.push(id === "aion-temp-chat" ? "/chat" : `/chat/${id}`);
  }

  function handleSelectThread(thread: { id: string }) {
    selectThread(thread.id);
    setSidebarOpen(false);
    router.push(`/chat/${thread.id}`);
  }

  function handleAddToNotebook(threadId: string, notebookTitle: string) {
    const existing = notebooks.find((notebook) => notebook.title === notebookTitle);
    const notebookId = existing?.id ?? createNotebook({ title: notebookTitle });

    addThreadNotebookLabel(threadId, notebookTitle);
    addChatToNotebook(notebookId, threadId);
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      {sidebar ? (
        sidebar({
          isOpen: sidebarOpen,
          isCollapsed: sidebarCollapsed,
          onClose: () => setSidebarOpen(false),
          onToggleCollapsed: () => setSidebarCollapsed((value) => !value)
        })
      ) : (
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          tempMode={tempMode}
          notebooks={notebooks.map((notebook) => notebook.title)}
          notebookItems={notebooks}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          onNewChat={handleNewChat}
          onSelectThread={handleSelectThread}
          onShareThread={shareThread}
          onTogglePin={togglePin}
          onRenameThread={renameThread}
          onAddToNotebook={handleAddToNotebook}
          onCreateNotebook={(name) => {
            createThreadNotebookLabel(name);
            createNotebook({ title: name });
          }}
          onDeleteThread={deleteThread}
          onOpenSearch={() => window.dispatchEvent(new Event("aion:open-search"))}
          onCreateNotebookDialog={() => window.dispatchEvent(new Event("aion:new-notebook"))}
          onSelectNotebook={(id) => router.push(`/notebooks/${id}`)}
          onRenameNotebook={renameNotebook}
          onChangeNotebookEmoji={(id, emoji) => updateNotebookMeta(id, { emoji })}
          onDuplicateNotebook={duplicateNotebook}
          onDeleteNotebook={deleteNotebook}
          onOpenShortcuts={() => window.dispatchEvent(new Event("aion:show-shortcuts"))}
        />
      )}
      <main className="main-panel route-panel">
        <header className="route-header">
          <button
            className="mobile-menu"
            type="button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          {title ? <h1>{title}</h1> : <span />}
          <div className="route-header-utils">
            <NotificationBell />
            <ThemeToggleButton className="route-header-theme" />
          </div>
        </header>
        <AnimatePresence mode="wait">
          <motion.div
            className="route-motion-shell"
            key={pathname}
            variants={pageShellVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
