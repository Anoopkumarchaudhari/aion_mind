const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export type GoogleProfile = {
  email: string;
  name: string;
  emailVerified: boolean;
};

function env(key: string) {
  return process.env[key]?.trim() ?? "";
}

export function isGoogleOAuthConfigured() {
  return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
}

/** The callback URL Google redirects back to. Override with GOOGLE_REDIRECT_URI. */
export function getGoogleRedirectUri(requestUrl: string) {
  const configured = env("GOOGLE_REDIRECT_URI");

  if (configured) {
    return configured;
  }

  return `${new URL(requestUrl).origin}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account"
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Exchange the auth code for tokens and return the Google account profile. */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    throw new Error("Google token exchange failed.");
  }

  const token = (await tokenResponse.json()) as { access_token?: string };

  if (!token.access_token) {
    throw new Error("Google did not return an access token.");
  }

  const infoResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });

  if (!infoResponse.ok) {
    throw new Error("Could not load the Google profile.");
  }

  const info = (await infoResponse.json()) as {
    email?: string;
    name?: string;
    given_name?: string;
    email_verified?: boolean | string;
  };

  if (!info.email) {
    throw new Error("Google profile did not include an email address.");
  }

  return {
    email: info.email,
    name: info.name ?? info.given_name ?? "",
    emailVerified: info.email_verified === true || info.email_verified === "true"
  };
}
