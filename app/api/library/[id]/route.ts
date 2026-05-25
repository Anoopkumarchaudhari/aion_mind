import { NextResponse } from "next/server";
import { deleteLibraryItem, patchLibraryItem } from "@/services/serverMemory";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = {
    title: typeof body.title === "string" ? body.title.trim().slice(0, 80) : undefined
  };
  const item = patchLibraryItem(id, patch);

  return NextResponse.json({ item, ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  return NextResponse.json({ id, deleted: deleteLibraryItem(id) });
}
