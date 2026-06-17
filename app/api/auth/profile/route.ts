import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser, updateUserProfile } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: unknown;
  avatar?: unknown;
};

export async function PATCH(request: Request) {
  try {
    const user = await requireCurrentUser();

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const changes: { name?: string; avatar?: string } = {};
    if (typeof body.name === "string") changes.name = body.name;
    if (typeof body.avatar === "string") changes.avatar = body.avatar;

    const updated = await updateUserProfile(user.id, changes);
    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Profile update failed", error);
    return NextResponse.json({ error: "Could not update your profile." }, { status: 500 });
  }
}
