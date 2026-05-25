"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Notebook, NotebookItem } from "@/types/workspace";

type NotebookInput = {
  title: string;
  emoji?: string;
  color?: string;
};

type NotebookState = {
  notebooks: Notebook[];
  createNotebook: (input: NotebookInput) => string;
  renameNotebook: (id: string, title: string) => void;
  updateNotebookMeta: (id: string, meta: Partial<Pick<Notebook, "emoji" | "color">>) => void;
  duplicateNotebook: (id: string) => string | null;
  deleteNotebook: (id: string) => void;
  addChatToNotebook: (notebookId: string, chatId: string) => void;
  addLibraryItemToNotebook: (notebookId: string, libraryItemId: string) => void;
  addNote: (notebookId: string, title?: string) => string | null;
  updateNote: (notebookId: string, noteId: string, patch: { title?: string; content?: string }) => void;
  removeItem: (notebookId: string, key: string) => void;
  reorderItems: (notebookId: string, orderedKeys: string[]) => void;
};

const now = Date.now();
const starterNotebooks: Notebook[] = [
  {
    id: "notebook-research",
    title: "Research",
    emoji: "📓",
    color: "#10b981",
    items: [],
    createdAt: now - 2,
    updatedAt: now - 2
  },
  {
    id: "notebook-personal",
    title: "Personal",
    emoji: "📓",
    color: "#06b6d4",
    items: [],
    createdAt: now - 1,
    updatedAt: now - 1
  }
];

export const useNotebookStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      notebooks: starterNotebooks,

      createNotebook(input) {
        const notebook = makeNotebook(input);
        set((state) => ({ notebooks: [notebook, ...state.notebooks] }));
        void syncNotebook("POST", notebook);
        return notebook.id;
      },

      renameNotebook(id, title) {
        const cleanTitle = title.trim().slice(0, 80);

        if (!cleanTitle) {
          return;
        }

        patchNotebook(set, id, { title: cleanTitle, updatedAt: Date.now() });
        void syncNotebook("PATCH", { id, title: cleanTitle });
      },

      updateNotebookMeta(id, meta) {
        patchNotebook(set, id, { ...meta, updatedAt: Date.now() });
        void syncNotebook("PATCH", { id, ...meta });
      },

      duplicateNotebook(id) {
        const source = get().notebooks.find((notebook) => notebook.id === id);

        if (!source) {
          return null;
        }

        const timestamp = Date.now();
        const copy: Notebook = {
          ...source,
          id: createClientId("notebook"),
          title: `${source.title} copy`,
          items: source.items.map((item) => ({ ...item })),
          createdAt: timestamp,
          updatedAt: timestamp
        };

        set((state) => ({ notebooks: [copy, ...state.notebooks] }));
        void syncNotebook("POST", copy);
        return copy.id;
      },

      deleteNotebook(id) {
        set((state) => ({ notebooks: state.notebooks.filter((notebook) => notebook.id !== id) }));
        void fetch(`/api/notebooks/${id}`, { method: "DELETE" }).catch(() => undefined);
      },

      addChatToNotebook(notebookId, chatId) {
        patchNotebookItems(set, notebookId, (items) => {
          if (items.some((item) => item.kind === "chat" && item.chatId === chatId)) {
            return items;
          }

          return [...items, { kind: "chat", chatId, order: items.length }];
        });
      },

      addLibraryItemToNotebook(notebookId, libraryItemId) {
        patchNotebookItems(set, notebookId, (items) => {
          if (items.some((item) => item.kind === "library" && item.libraryItemId === libraryItemId)) {
            return items;
          }

          return [...items, { kind: "library", libraryItemId, order: items.length }];
        });
      },

      addNote(notebookId, title = "Untitled note") {
        const noteId = createClientId("note");

        patchNotebookItems(set, notebookId, (items) => [
          ...items,
          {
            kind: "note",
            id: noteId,
            title: title.trim().slice(0, 80) || "Untitled note",
            content: "<p></p>",
            order: items.length
          }
        ]);

        return noteId;
      },

      updateNote(notebookId, noteId, patch) {
        patchNotebookItems(set, notebookId, (items) =>
          items.map((item) =>
            item.kind === "note" && item.id === noteId
              ? {
                  ...item,
                  title: patch.title !== undefined ? patch.title.trim().slice(0, 80) || item.title : item.title,
                  content: patch.content ?? item.content
                }
              : item
          )
        );
      },

      removeItem(notebookId, key) {
        patchNotebookItems(set, notebookId, (items) =>
          items.filter((item) => getNotebookItemKey(item) !== key).map((item, order) => ({ ...item, order }))
        );
      },

      reorderItems(notebookId, orderedKeys) {
        patchNotebookItems(set, notebookId, (items) => {
          const itemMap = new Map(items.map((item) => [getNotebookItemKey(item), item]));
          return orderedKeys
            .map((key) => itemMap.get(key))
            .filter((item): item is NotebookItem => Boolean(item))
            .map((item, order) => ({ ...item, order }));
        });
      }
    }),
    {
      name: "aion-mind-notebooks",
      storage: createJSONStorage(() => localStorage)
    }
  )
);

export function getNotebookItemKey(item: NotebookItem) {
  if (item.kind === "chat") {
    return `chat:${item.chatId}`;
  }

  if (item.kind === "library") {
    return `library:${item.libraryItemId}`;
  }

  return `note:${item.id}`;
}

function makeNotebook(input: NotebookInput): Notebook {
  const timestamp = Date.now();

  return {
    id: createClientId("notebook"),
    title: input.title.trim().slice(0, 80) || "Untitled notebook",
    emoji: input.emoji?.trim().slice(0, 4) || "📓",
    color: input.color || "#10b981",
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createClientId(prefix: string) {
  const randomUUID = globalThis.crypto?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  const randomPart =
    globalThis.crypto?.getRandomValues && typeof globalThis.crypto.getRandomValues === "function"
      ? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2)))
          .map((value) => value.toString(36))
          .join("")
      : Math.random().toString(36).slice(2, 12);

  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

function patchNotebook(
  set: (partial: Partial<NotebookState> | ((state: NotebookState) => Partial<NotebookState>)) => void,
  id: string,
  patch: Partial<Notebook>
) {
  set((state) => ({
    notebooks: state.notebooks.map((notebook) => (notebook.id === id ? { ...notebook, ...patch } : notebook))
  }));
}

function patchNotebookItems(
  set: (partial: Partial<NotebookState> | ((state: NotebookState) => Partial<NotebookState>)) => void,
  notebookId: string,
  updater: (items: NotebookItem[]) => NotebookItem[]
) {
  set((state) => {
    const notebooks = state.notebooks.map((notebook) => {
      if (notebook.id !== notebookId) {
        return notebook;
      }

      const items = updater(notebook.items)
        .map((item, order) => ({ ...item, order }))
        .sort((left, right) => left.order - right.order);

      void syncNotebook("PATCH", { id: notebookId, items });
      return { ...notebook, items, updatedAt: Date.now() };
    });

    return { notebooks };
  });
}

async function syncNotebook(method: "POST" | "PATCH", notebook: Partial<Notebook> & { id?: string }) {
  const url = method === "PATCH" && notebook.id ? `/api/notebooks/${notebook.id}` : "/api/notebooks";

  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notebook)
  }).catch(() => undefined);
}
