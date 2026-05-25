import { NextResponse } from "next/server";
import { listLibraryItems, saveLibraryItem } from "@/services/serverMemory";
import type { LibraryItem, LibraryItemType } from "@/types/workspace";

type LibraryBody = Partial<LibraryItem>;

const libraryTypes = new Set<LibraryItemType>(["chat", "code", "image", "video", "document"]);

export async function GET() {
  return NextResponse.json({ items: listLibraryItems() });
}

export async function POST(request: Request) {
  let body: LibraryBody;

  try {
    body = (await request.json()) as LibraryBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.type || !libraryTypes.has(body.type)) {
    return NextResponse.json({ error: "Invalid library item type" }, { status: 400 });
  }

  const item: LibraryItem = {
    id: body.id || crypto.randomUUID(),
    type: body.type,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : "Untitled item",
    content: body.content,
    url: body.url,
    sourceChatId: body.sourceChatId,
    sourceMessageId: body.sourceMessageId,
    language: body.language,
    createdAt: typeof body.createdAt === "number" ? body.createdAt : Date.now()
  };

  return NextResponse.json({ item: saveLibraryItem(item) }, { status: 201 });
}
