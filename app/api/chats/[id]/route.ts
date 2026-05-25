import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { deleteUserThread, patchUserThread } from "@/services/chatPersistence";
import { isAionModelId } from "@/types/aion";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type PatchBody = {
  title?: unknown;
  pinned?: unknown;
  notebook?: unknown;
  model?: unknown;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: PatchBody;

  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : undefined;
  const pinned = typeof body.pinned === "boolean" ? body.pinned : undefined;
  const notebook = typeof body.notebook === "string" ? body.notebook.trim().slice(0, 80) : undefined;
  const model = isAionModelId(body.model) ? body.model : undefined;

  try {
    const user = await requireCurrentUser();
    const patch = await patchUserThread(user.id, id, {
      title,
      pinned,
      notebook,
      model,
      updatedAt: Date.now()
    });

    if (!patch) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({
      id,
      ...patch,
      ok: true
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const user = await requireCurrentUser();
    return NextResponse.json({
      id,
      deleted: await deleteUserThread(user.id, id)
    });
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
