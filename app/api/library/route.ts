import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { listLibraryItems, saveLibraryItem } from "@/services/serverMemory";
import type { LibraryItem, LibraryItemType } from "@/types/workspace";

export const runtime = "nodejs";

type LibraryBody = Partial<LibraryItem>;

const libraryTypes = new Set<LibraryItemType>(["chat", "code", "image", "video", "document"]);

export async function GET() {
  try {
    const user = await requireCurrentUser();
    return NextResponse.json({ items: await listLibraryItems(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
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

  try {
    const user = await requireCurrentUser();
    return NextResponse.json({ item: await saveLibraryItem(user.id, item) }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: "Database request failed." }, { status: 500 });
}
