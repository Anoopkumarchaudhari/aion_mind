import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { AdminGateError, dispatchAdminLoginCode, hasAdminPassword, verifyAdminPassword } from "@/services/adminGate";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  password?: unknown;
};

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();

    if (!(await hasAdminPassword(admin.email))) {
      return NextResponse.json({ error: "No admin password is set yet.", step: "set-password" }, { status: 409 });
    }

    const body = (await request.json()) as Body;
    const password = typeof body.password === "string" ? body.password : "";

    if (!(await verifyAdminPassword(admin.email, password))) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    // Password is correct. Sending the code can fail independently (bad SMTP
    // creds, host unreachable) — surface that as its own clear error instead
    // of a generic "could not verify password".
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
        { error: `Password verified, but the code email failed to send: ${detail}` },
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

  console.error("[admin-auth] password verification error:", error);
  return NextResponse.json({ error: "Could not verify password." }, { status: 500 });
}
