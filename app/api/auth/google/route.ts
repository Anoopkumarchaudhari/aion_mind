import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, getAppOrigin, getGoogleRedirectUri, isGoogleOAuthConfigured } from "@/services/googleOAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "g_oauth_state";

// Start the Google sign-in flow: set a CSRF state cookie and redirect to Google.
export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_unconfigured", getAppOrigin(request.url)));
  }

  const redirectUri = getGoogleRedirectUri(request.url);
  const state = randomBytes(16).toString("hex");

  const response = NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });

  return response;
}
