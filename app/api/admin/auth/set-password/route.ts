import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { AdminGateError, dispatchAdminLoginCode, hasAdminPassword, setAdminPassword } from "@/services/adminGate";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  password?: unknown;
  confirm?: unknown;
};

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();

    // Only allow first-time setup here; changing an existing password requires
    // re-verifying through the normal password + code flow.
    if (await hasAdminPassword(admin.email)) {
      return NextResponse.json({ error: "An admin password already exists." }, { status: 409 });
    }

    const body = (await request.json()) as Body;
    const password = typeof body.password === "string" ? body.password : "";
    const confirm = typeof body.confirm === "string" ? body.confirm : "";

    if (confirm && password !== confirm) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    await setAdminPassword(admin.email, password);

    try {
      const { delivered } = await dispatchAdminLoginCode(admin.email);
      return NextResponse.json({ ok: true, step: "code", delivered });
    } catch (sendError) {
      console.error("[admin-auth] code dispatch failed:", sendError);

      if (sendError instanceof AdminGateError) {
        return NextResponse.json({ error: sendError.message }, { status: sendError.status });
      }

      const detail = sendError instanceof Error ? sendError.message : "Unknown email error";
      return NextResponse.json(
        { error: `Password saved, but the code email failed to send: ${detail}` },
        { status: 502 }
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AdminGateError || error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("[admin-auth] set-password error:", error);
  return NextResponse.json({ error: "Could not set admin password." }, { status: 500 });
}
