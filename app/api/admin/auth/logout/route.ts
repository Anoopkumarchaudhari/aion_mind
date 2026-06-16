import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { clearAdminSessionCookie, deleteCurrentAdminSession } from "@/services/adminGate";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireAdminUser();
    await deleteCurrentAdminSession();

    const response = NextResponse.json({ ok: true });
    clearAdminSessionCookie(response);

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not lock the admin panel." }, { status: 500 });
  }
}
