import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { AdminGateError, createAdminSession, setAdminSessionCookie, verifyLoginCode } from "@/services/adminGate";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  code?: unknown;
};

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as Body;
    const code = typeof body.code === "string" ? body.code : "";

    const result = await verifyLoginCode(admin.email, code);

    if (!result.ok) {
      return NextResponse.json({ error: result.reason ?? "Invalid code." }, { status: 401 });
    }

    const sessionId = await createAdminSession(admin.id, admin.email);
    const response = NextResponse.json({ ok: true });
    setAdminSessionCookie(response, sessionId);

    return response;
  } catch (error) {
    if (error instanceof AdminGateError || error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not verify code." }, { status: 500 });
  }
}
