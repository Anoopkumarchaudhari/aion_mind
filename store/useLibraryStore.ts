"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LibraryItem, LibraryItemType } from "@/types/workspace";

type LibraryInput = {
  type: LibraryItemType;
  title: string;
  content?: string;
  url?: string;
  sourceChatId?: string;
  sourceMessageId?: string;
  language?: string;
};

type LibraryState = {
  items: LibraryItem[];
  addItem: (item: LibraryInput) => string;
  renameItem: (id: string, title: string) => void;
  removeItem: (id: string) => void;
  clearLibrary: () => void;
};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem(item) {
        const cleanTitle = item.title.trim().slice(0, 80) || "Untitled item";
        const saved: LibraryItem = {
          id: createClientId("library"),
          type: item.type,
          title: cleanTitle,
          content: item.content,
          url: item.url,
          sourceChatId: item.sourceChatId,
          sourceMessageId: item.sourceMessageId,
          language: item.language,
          createdAt: Date.now()
        };

        set((state) => ({ items: [saved, ...state.items] }));
        void syncLibrary("POST", saved);
        return saved.id;
      },

      renameItem(id, title) {
        const cleanTitle = title.trim().slice(0, 80);

        if (!cleanTitle) {
          return;
        }

        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, title: cleanTitle } : item))
        }));
        void syncLibrary("PATCH", { id, title: cleanTitle });
      },

      removeItem(id) {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
        void fetch(`/api/library/${id}`, { method: "DELETE" }).catch(() => undefined);
      },

      clearLibrary() {
        get().items.forEach((item) => void fetch(`/api/library/${item.id}`, { method: "DELETE" }));
        set({ items: [] });
      }
    }),
    {
      name: "aion-mind-library",
      storage: createJSONStorage(() => localStorage)
    }
  )
);

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

async function syncLibrary(method: "POST" | "PATCH", item: Partial<LibraryItem> & { id?: string }) {
  const url = method === "PATCH" && item.id ? `/api/library/${item.id}` : "/api/library";

  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  }).catch(() => undefined);
}
