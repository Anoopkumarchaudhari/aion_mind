import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AuthError, createSession, findOrCreateGoogleUser, setSessionCookie } from "@/services/auth";
import { exchangeGoogleCode, getAppOrigin, getGoogleRedirectUri, isGoogleOAuthConfigured } from "@/services/googleOAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "g_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const origin = getAppOrigin(request.url);

  const fail = (reason: string) => {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", reason);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  };

  if (oauthError || !code || !state) {
    return fail("google_failed");
  }

  if (!isGoogleOAuthConfigured()) {
    return fail("google_unconfigured");
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;

  // CSRF: the state we set must match what Google echoed back.
  if (!savedState || savedState !== state) {
    return fail("google_state");
  }

  try {
    const profile = await exchangeGoogleCode(code, getGoogleRedirectUri(request.url));

    // Only trust a Google email Google itself has verified. Otherwise a sign-in
    // with an unverified email could match — and silently take over — an existing
    // password account, since accounts are linked by email.
    if (!profile.emailVerified) {
      return fail("google_unverified");
    }

    const user = await findOrCreateGoogleUser({ email: profile.email, name: profile.name });
    const sessionId = await createSession(user.id);

    const response = NextResponse.redirect(new URL("/chat", origin));
    setSessionCookie(response, sessionId);
    response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.status === 403 ? "inactive" : "google_failed");
    }

    console.error("Google OAuth callback failed", error);
    return fail("google_failed");
  }
}
