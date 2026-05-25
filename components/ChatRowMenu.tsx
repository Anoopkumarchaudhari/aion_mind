"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "framer-motion";
import {
  MoreVertical,
  NotebookTabs,
  Pencil,
  Pin,
  Share2,
  Trash2
} from "lucide-react";
import { DeleteConfirm } from "@/components/DeleteConfirm";

type ChatRowMenuProps = {
  chatId: string;
  title: string;
  pinned?: boolean;
  disabled?: boolean;
  notebooks: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: () => void;
  onTogglePin: () => void;
  onRename: () => void;
  onAddToNotebook: (notebook: string) => void;
  onCreateNotebook: (name: string) => void;
  onDelete: () => void;
};

export function ChatRowMenu({
  title,
  pinned,
  disabled,
  notebooks,
  open,
  onOpenChange,
  onShare,
  onTogglePin,
  onRename,
  onAddToNotebook,
  onCreateNotebook,
  onDelete
}: ChatRowMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
        <DropdownMenu.Trigger asChild disabled={disabled}>
          <button
            className="history-menu-trigger"
            type="button"
            aria-label={`Open actions for ${title}`}
            title={disabled ? "Not available in temporary chat" : "Chat actions"}
          >
            <MoreVertical size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <AnimatePresence>
            {open ? (
              <DropdownMenu.Content side="right" align="start" sideOffset={12} asChild forceMount>
                <motion.div
                  className="chat-menu-content"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                >
                  <DropdownMenu.Item className="chat-menu-item" onSelect={onShare}>
                    <Share2 size={16} />
                    Share conversation
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="chat-menu-item" onSelect={onTogglePin}>
                    <Pin size={16} />
                    {pinned ? "Unpin" : "Pin"}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="chat-menu-item" onSelect={onRename}>
                    <Pencil size={16} />
                    Rename
                  </DropdownMenu.Item>
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger className="chat-menu-item">
                      <NotebookTabs size={16} />
                      Add to notebook
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.SubContent className="chat-menu-content is-sub" sideOffset={8}>
                        {notebooks.map((notebook) => (
                          <DropdownMenu.Item
                            className="chat-menu-item"
                            key={notebook}
                            onSelect={() => onAddToNotebook(notebook)}
                          >
                            {notebook}
                          </DropdownMenu.Item>
                        ))}
                        <div className="chat-menu-separator" />
                        <DropdownMenu.Item
                          className="chat-menu-item"
                          onSelect={() => {
                            const name = window.prompt("Create notebook")?.trim();

                            if (name) {
                              onCreateNotebook(name);
                              onAddToNotebook(name);
                            }
                          }}
                        >
                          Create new notebook
                        </DropdownMenu.Item>
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Sub>
                  <div className="chat-menu-separator" />
                  <DropdownMenu.Item
                    className="chat-menu-item is-danger"
                    onSelect={(event) => {
                      event.preventDefault();
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 size={16} />
                    Delete
                  </DropdownMenu.Item>
                </motion.div>
              </DropdownMenu.Content>
            ) : null}
          </AnimatePresence>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DeleteConfirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          setDeleteOpen(false);
          onDelete();
        }}
      />
    </>
  );
}
