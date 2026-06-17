import { NextResponse } from "next/server";
import { AuthError } from "@/services/auth";
import { resetPassword } from "@/services/passwordReset";

export const runtime = "nodejs";

type Body = {
  email?: unknown;
  code?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const email = typeof body.email === "string" ? body.email : "";
    const code = typeof body.code === "string" ? body.code : "";
    const password = typeof body.password === "string" ? body.password : "";

    await resetPassword(email, code, password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Password reset failed", error);
    return NextResponse.json({ error: "Could not reset your password." }, { status: 500 });
  }
}
