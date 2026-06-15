"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { NewNotebookDialog } from "@/components/NewNotebookDialog";
import { SearchPalette } from "@/components/SearchPalette";
import { useChatStore } from "@/store/useChatStore";

export function GlobalOverlays() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const createOrFocusNewChat = useChatStore((state) => state.createOrFocusNewChat);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const command = event.metaKey || event.ctrlKey;

      if (!command) {
        return;
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }

      if (event.key.toLowerCase() === "n" && event.shiftKey) {
        event.preventDefault();
        setNotebookOpen(true);
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        const id = createOrFocusNewChat();
        router.push(id === "aion-temp-chat" ? "/chat" : `/chat/${id}`);
      }

      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        window.dispatchEvent(new Event("aion:toggle-sidebar"));
      }
    }

    function openSearch() {
      setSearchOpen(true);
    }

    function openNotebook() {
      setNotebookOpen(true);
    }

    function openShortcuts() {
      setShortcutsOpen(true);
    }

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("aion:open-search", openSearch);
    window.addEventListener("aion:new-notebook", openNotebook);
    window.addEventListener("aion:show-shortcuts", openShortcuts);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("aion:open-search", openSearch);
      window.removeEventListener("aion:new-notebook", openNotebook);
      window.removeEventListener("aion:show-shortcuts", openShortcuts);
    };
  }, [createOrFocusNewChat, router]);

  return (
    <>
      <AnimatePresence>
        {searchOpen ? <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} /> : null}
      </AnimatePresence>
      <NewNotebookDialog open={notebookOpen} onOpenChange={setNotebookOpen} />
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Toaster theme="dark" position="bottom-right" richColors />
    </>
  );
}
