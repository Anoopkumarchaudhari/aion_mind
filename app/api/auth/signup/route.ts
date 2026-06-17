import { NextResponse } from "next/server";
import { AuthError } from "@/services/auth";
import { requestSignupCode } from "@/services/signupVerification";
import { getFeatureFlags } from "@/services/adminSettings";

export const runtime = "nodejs";

type SignupBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  const featureFlags = await getFeatureFlags();

  if (!featureFlags.signupEnabled) {
    return NextResponse.json({ error: "New account creation is temporarily disabled." }, { status: 403 });
  }

  let body: SignupBody;

  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { email, delivered } = await requestSignupCode({
      name: typeof body.name === "string" ? body.name : "",
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : ""
    });

    // Account is NOT created yet — the user must verify the emailed code first.
    return NextResponse.json({ step: "verify", email, delivered });
  } catch (error) {
    return authErrorResponse(error);
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Signup request failed", error);

  const detail = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json(
    { error: `Could not send the verification email: ${detail}` },
    { status: 502 }
  );
}
