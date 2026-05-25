import { NextResponse } from "next/server";
import { listNotebooks, saveNotebook } from "@/services/serverMemory";
import type { Notebook } from "@/types/workspace";

type NotebookBody = Partial<Notebook>;

export async function GET() {
  return NextResponse.json({ notebooks: listNotebooks() });
}

export async function POST(request: Request) {
  let body: NotebookBody;

  try {
    body = (await request.json()) as NotebookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const timestamp = Date.now();
  const notebook: Notebook = {
    id: body.id || crypto.randomUUID(),
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : "Untitled notebook",
    emoji: typeof body.emoji === "string" && body.emoji.trim() ? body.emoji.trim().slice(0, 4) : "📓",
    color: typeof body.color === "string" && body.color.trim() ? body.color.trim().slice(0, 24) : "#10b981",
    items: Array.isArray(body.items) ? body.items : [],
    createdAt: typeof body.createdAt === "number" ? body.createdAt : timestamp,
    updatedAt: typeof body.updatedAt === "number" ? body.updatedAt : timestamp
  };

  return NextResponse.json({ notebook: saveNotebook(notebook) }, { status: 201 });
}
