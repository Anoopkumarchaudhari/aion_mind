import { NextResponse } from "next/server";
import { AuthError, createSession, loginUser, setSessionCookie } from "@/services/auth";

export const runtime = "nodejs";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const user = await loginUser(
      typeof body.email === "string" ? body.email : "",
      typeof body.password === "string" ? body.password : ""
    );
    const response = NextResponse.json({ user });

    setSessionCookie(response, await createSession(user.id));
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
