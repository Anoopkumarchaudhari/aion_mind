import { NextResponse } from "next/server";
import { deleteNotebook, getNotebook, patchNotebook } from "@/services/serverMemory";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const notebook = getNotebook(id);

  if (!notebook) {
    return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
  }

  return NextResponse.json({ notebook });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const notebook = patchNotebook(id, body);

  return NextResponse.json({ notebook, ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  return NextResponse.json({ id, deleted: deleteNotebook(id) });
}
