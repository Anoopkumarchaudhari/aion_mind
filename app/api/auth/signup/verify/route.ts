import { NextResponse } from "next/server";
import { AuthError, createSession, setSessionCookie } from "@/services/auth";
import { confirmSignup } from "@/services/signupVerification";

export const runtime = "nodejs";

type Body = {
  email?: unknown;
  code?: unknown;
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

    const user = await confirmSignup(email, code);
    const response = NextResponse.json({ ok: true, user });

    setSessionCookie(response, await createSession(user.id));
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Signup verification failed", error);
    return NextResponse.json({ error: "Could not verify your account." }, { status: 500 });
  }
}
