import { NextResponse } from "next/server";
import { AuthError, createSession, setSessionCookie, signupUser } from "@/services/auth";

export const runtime = "nodejs";
const ACCOUNT_CREATION_DISABLED = false;

type SignupBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  if (ACCOUNT_CREATION_DISABLED) {
    return NextResponse.json({ error: "New account creation is temporarily disabled." }, { status: 403 });
  }

  let body: SignupBody;

  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const user = await signupUser({
      name: typeof body.name === "string" ? body.name : "",
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : ""
    });
    const response = NextResponse.json({ user });

    setSessionCookie(response, await createSession(user.id));
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Signup failed", error);
  return NextResponse.json({ error: "Could not create account." }, { status: 500 });
}
