"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { useNotebookStore } from "@/store/useNotebookStore";

export function NotebooksPageContent() {
  const notebooks = useNotebookStore((state) => state.notebooks);
  const renameNotebook = useNotebookStore((state) => state.renameNotebook);
  const duplicateNotebook = useNotebookStore((state) => state.duplicateNotebook);
  const deleteNotebook = useNotebookStore((state) => state.deleteNotebook);

  return (
    <AppFrame title="Notebooks">
      <section className="route-content">
        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Knowledge spaces</p>
            <h2>Notebooks</h2>
          </div>
          <button className="primary-button" type="button" onClick={() => window.dispatchEvent(new Event("aion:new-notebook"))}>
            New notebook
          </button>
        </div>
        <div className="notebook-grid">
          {notebooks.map((notebook) => (
            <article className="notebook-card" key={notebook.id}>
              <Link href={`/notebooks/${notebook.id}`} className="notebook-card-link">
                <div className="notebook-cover" style={{ backgroundColor: notebook.color }}>
                  {notebook.emoji}
                </div>
                <h3>{notebook.title}</h3>
                <p>{notebook.items.length} items</p>
                <time>{formatDistanceToNow(notebook.updatedAt, { addSuffix: true })}</time>
              </Link>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="artifact-menu-trigger" type="button" aria-label={`Notebook actions for ${notebook.title}`}>
                    <MoreVertical size={16} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="chat-menu-content" align="end" sideOffset={8}>
                    <DropdownMenu.Item
                      className="chat-menu-item"
                      onSelect={() => {
                        const title = window.prompt("Rename notebook", notebook.title)?.trim();

                        if (title) {
                          renameNotebook(notebook.id, title);
                        }
                      }}
                    >
                      <Pencil size={16} />
                      Rename
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="chat-menu-item" onSelect={() => duplicateNotebook(notebook.id)}>
                      <Copy size={16} />
                      Duplicate
                    </DropdownMenu.Item>
                    <div className="chat-menu-separator" />
                    <DropdownMenu.Item className="chat-menu-item is-danger" onSelect={() => deleteNotebook(notebook.id)}>
                      <Trash2 size={16} />
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </article>
          ))}
        </div>
      </section>
    </AppFrame>
  );
}
