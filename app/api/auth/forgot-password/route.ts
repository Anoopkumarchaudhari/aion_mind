import { NextResponse } from "next/server";
import { AuthError } from "@/services/auth";
import { requestPasswordReset } from "@/services/passwordReset";

export const runtime = "nodejs";

type Body = {
  email?: unknown;
};

export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { email, delivered } = await requestPasswordReset(typeof body.email === "string" ? body.email : "");
    return NextResponse.json({ ok: true, email, delivered });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Password reset request failed", error);

    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Could not send the reset code: ${detail}` }, { status: 502 });
  }
}
