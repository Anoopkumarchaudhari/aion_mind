import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { createThreadShare } from "@/services/chatPersistence";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const user = await requireCurrentUser();
    const token = await createThreadShare(user.id, id);

    if (!token) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const origin = new URL(request.url).origin;

    return NextResponse.json({
      url: `${origin}/share/${encodeURIComponent(id)}-${token}`
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not create share link." }, { status: 500 });
  }
}
