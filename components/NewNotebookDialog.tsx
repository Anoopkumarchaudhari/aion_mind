"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useNotebookStore } from "@/store/useNotebookStore";

const coverColors = ["#10b981", "#06b6d4", "#f472b6", "#f59e0b", "#8b5cf6"];

type NewNotebookDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewNotebookDialog({ open, onOpenChange }: NewNotebookDialogProps) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("📓");
  const [color, setColor] = useState(coverColors[0]);
  const createNotebook = useNotebookStore((state) => state.createNotebook);

  useEffect(() => {
    if (open) {
      setTitle("");
      setEmoji("📓");
      setColor(coverColors[0]);
    }
  }, [open]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    createNotebook({ title, emoji, color });
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-card">
          <div className="dialog-heading">
            <div>
              <Dialog.Title className="dialog-title">New notebook</Dialog.Title>
              <Dialog.Description className="dialog-description">
                Group chats, notes, and saved artifacts around a topic.
              </Dialog.Description>
            </div>
            <Dialog.Close className="dialog-close" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>

          <form className="dialog-form" onSubmit={handleSubmit}>
            <label className="field-label">
              Name
              <input
                autoFocus
                className="field-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Project research"
              />
            </label>
            <label className="field-label">
              Emoji
              <input
                className="field-input"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value.slice(0, 4))}
                placeholder="📓"
              />
            </label>
            <div className="field-label">
              Cover color
              <div className="color-row">
                {coverColors.map((option) => (
                  <button
                    className={`color-swatch ${option === color ? "is-active" : ""}`}
                    key={option}
                    type="button"
                    style={{ backgroundColor: option }}
                    aria-label={`Use ${option}`}
                    onClick={() => setColor(option)}
                  />
                ))}
              </div>
            </div>
            <div className="dialog-actions">
              <Dialog.Close className="ghost-button" type="button">Cancel</Dialog.Close>
              <button className="primary-button" type="submit" disabled={!title.trim()}>
                Create notebook
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
