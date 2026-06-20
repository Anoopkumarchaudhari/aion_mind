import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { deleteLibraryItem, patchLibraryItem } from "@/services/serverMemory";

export const runtime = "nodejs";

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

  try {
    const user = await requireCurrentUser();
    const item = await patchLibraryItem(user.id, id, patch);

    if (!item) {
      return NextResponse.json({ error: "Library item not found" }, { status: 404 });
    }

    return NextResponse.json({ item, ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const user = await requireCurrentUser();
    return NextResponse.json({ id, deleted: await deleteLibraryItem(user.id, id) });
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
