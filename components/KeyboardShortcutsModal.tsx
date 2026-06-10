"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type KeyboardShortcutsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const shortcuts = [
  ["Cmd/Ctrl + K", "Search chats"],
  ["Cmd/Ctrl + N", "New chat"],
  ["Cmd/Ctrl + B", "Toggle sidebar"],
  ["Cmd/Ctrl + Shift + N", "New notebook"],
  ["Esc", "Close modal"]
];

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-card is-compact">
          <div className="dialog-heading">
            <div>
              <Dialog.Title className="dialog-title">Keyboard shortcuts</Dialog.Title>
              <Dialog.Description className="dialog-description">
                Move around Aria Mind without leaving the keyboard.
              </Dialog.Description>
            </div>
            <Dialog.Close className="dialog-close" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="shortcut-list">
            {shortcuts.map(([keys, label]) => (
              <div className="shortcut-row" key={keys}>
                <span>{label}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
