"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookOpen, FileText, Library, MessageSquare, Plus, Trash2 } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { getNotebookItemKey, useNotebookStore } from "@/store/useNotebookStore";
import { useChatStore } from "@/store/useChatStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import type { NotebookItem } from "@/types/workspace";

type NotebookDetailContentProps = {
  notebookId: string;
};

export function NotebookDetailContent({ notebookId }: NotebookDetailContentProps) {
  const notebooks = useNotebookStore((state) => state.notebooks);
  const addNote = useNotebookStore((state) => state.addNote);
  const updateNote = useNotebookStore((state) => state.updateNote);
  const removeItem = useNotebookStore((state) => state.removeItem);
  const reorderItems = useNotebookStore((state) => state.reorderItems);
  const notebook = notebooks.find((item) => item.id === notebookId);
  const orderedItems = useMemo(
    () => [...(notebook?.items ?? [])].sort((left, right) => left.order - right.order),
    [notebook?.items]
  );
  const [activeKey, setActiveKey] = useState<string | null>(orderedItems[0] ? getNotebookItemKey(orderedItems[0]) : null);
  const activeItem = orderedItems.find((item) => getNotebookItemKey(item) === activeKey) ?? orderedItems[0];
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!notebook) {
    return (
      <AppFrame title="Notebook">
        <section className="route-content">
          <div className="empty-panel">
            <h3>Notebook not found</h3>
            <Link className="primary-button" href="/notebooks">Back to notebooks</Link>
          </div>
        </section>
      </AppFrame>
    );
  }

  const currentNotebook = notebook;

  function handleNewNote() {
    const noteId = addNote(notebookId, "Untitled note");
    if (noteId) {
      setActiveKey(`note:${noteId}`);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const keys = orderedItems.map(getNotebookItemKey);
    const oldIndex = keys.indexOf(String(active.id));
    const newIndex = keys.indexOf(String(over.id));

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const nextKeys = [...keys];
    const [moved] = nextKeys.splice(oldIndex, 1);
    nextKeys.splice(newIndex, 0, moved);
    reorderItems(notebookId, nextKeys);
  }

  return (
    <AppFrame title={currentNotebook.title}>
      <section className="notebook-workspace">
        <aside className="notebook-left-rail">
          <div className="notebook-title-block">
            <span className="notebook-large-emoji" style={{ backgroundColor: currentNotebook.color }}>
              {currentNotebook.emoji}
            </span>
            <div>
              <h2>{currentNotebook.title}</h2>
              <p>{orderedItems.length} items</p>
            </div>
          </div>
          <button className="notebook-new-row" type="button" onClick={handleNewNote}>
            <Plus size={14} />
            New note
          </button>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedItems.map(getNotebookItemKey)} strategy={verticalListSortingStrategy}>
              <div className="notebook-item-list">
                {orderedItems.map((item) => (
                  <SortableNotebookItem
                    key={getNotebookItemKey(item)}
                    item={item}
                    active={getNotebookItemKey(item) === getNotebookItemKey(activeItem ?? item)}
                    onSelect={() => setActiveKey(getNotebookItemKey(item))}
                    onRemove={() => removeItem(currentNotebook.id, getNotebookItemKey(item))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </aside>
        <main className="notebook-editor-pane">
          {activeItem ? (
            <NotebookItemEditor notebookId={currentNotebook.id} item={activeItem} onUpdateNote={updateNote} />
          ) : (
            <div className="empty-panel">
              <h3>Start this notebook</h3>
              <p>Add a note, attach a chat, or save library items here.</p>
              <button className="primary-button" type="button" onClick={handleNewNote}>
                Add note
              </button>
            </div>
          )}
        </main>
        <aside className="notebook-right-rail">
          <h3>Notebook context</h3>
          <p>Tags</p>
          <div className="tag-row">
            <span>Research</span>
            <span>Aion</span>
          </div>
          <button
            className="primary-button full"
            type="button"
            onClick={() => window.location.assign(`/?notebook=${currentNotebook.id}`)}
          >
            Ask Aion Mind
          </button>
        </aside>
      </section>
    </AppFrame>
  );
}

function SortableNotebookItem({
  item,
  active,
  onSelect,
  onRemove
}: {
  item: NotebookItem;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const key = getNotebookItemKey(item);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: key });

  return (
    <div
      ref={setNodeRef}
      className={`notebook-item-row ${active ? "is-active" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
    >
      <button className="notebook-item-main" type="button" onClick={onSelect} {...listeners}>
        {item.kind === "chat" ? <MessageSquare size={15} /> : item.kind === "library" ? <Library size={15} /> : <FileText size={15} />}
        <span>{getNotebookItemTitle(item)}</span>
      </button>
      <button className="message-action" type="button" aria-label="Remove item" onClick={onRemove}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function NotebookItemEditor({
  notebookId,
  item,
  onUpdateNote
}: {
  notebookId: string;
  item: NotebookItem;
  onUpdateNote: (notebookId: string, noteId: string, patch: { title?: string; content?: string }) => void;
}) {
  const chats = useChatStore((state) => state.threads);
  const library = useLibraryStore((state) => state.items);
  const chat = item.kind === "chat" ? chats.find((thread) => thread.id === item.chatId) : undefined;
  const libraryItem = item.kind === "library" ? library.find((entry) => entry.id === item.libraryItemId) : undefined;
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: "Write notes, decisions, or next steps..."
        })
      ],
      content: item.kind === "note" ? item.content : "",
      immediatelyRender: false,
      onUpdate({ editor: nextEditor }) {
        if (item.kind === "note") {
          onUpdateNote(notebookId, item.id, { content: nextEditor.getHTML() });
        }
      }
    },
    [item.kind === "note" ? item.id : getNotebookItemKey(item)]
  );

  if (item.kind === "chat") {
    return (
      <div className="notebook-preview">
        <BookOpen size={22} />
        <h2>{chat?.title ?? "Chat unavailable"}</h2>
        <p>{chat?.messages.at(-1)?.content ?? "This chat has no messages yet."}</p>
        {chat ? <Link className="primary-button" href={`/chat/${chat.id}`}>Open chat</Link> : null}
      </div>
    );
  }

  if (item.kind === "library") {
    return (
      <div className="notebook-preview">
        <Library size={22} />
        <h2>{libraryItem?.title ?? "Library item unavailable"}</h2>
        <p>{libraryItem?.content ?? libraryItem?.url ?? "No preview available."}</p>
        <Link className="primary-button" href="/library">Open library</Link>
      </div>
    );
  }

  return (
    <div className="note-editor">
      <input
        className="note-title-input"
        value={item.title}
        onChange={(event) => onUpdateNote(notebookId, item.id, { title: event.target.value })}
      />
      <EditorContent editor={editor} className="tiptap-editor" />
    </div>
  );
}

function getNotebookItemTitle(item: NotebookItem) {
  if (item.kind === "chat") {
    return "Chat";
  }

  if (item.kind === "library") {
    return "Library item";
  }

  return item.title;
}
