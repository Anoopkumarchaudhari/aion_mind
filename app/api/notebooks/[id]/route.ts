import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { deleteNotebook, getNotebook, patchNotebook } from "@/services/serverMemory";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const user = await requireCurrentUser();
    const notebook = await getNotebook(user.id, id);

    if (!notebook) {
      return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
    }

    return NextResponse.json({ notebook });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUser();
    const notebook = await patchNotebook(user.id, id, body);

    if (!notebook) {
      return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
    }

    return NextResponse.json({ notebook, ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const user = await requireCurrentUser();
    return NextResponse.json({ id, deleted: await deleteNotebook(user.id, id) });
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
