import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "aion_session";
const PUBLIC_PATHS = new Set(["/", "/login", "/signup"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isPublicAsset(pathname) || pathname.startsWith("/api/auth") || pathname === "/api/image-sidebar") {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (hasSession && (pathname === "/login" || pathname === "/signup")) {
      return NextResponse.redirect(getSafeRedirectUrl(request));
    }

    return NextResponse.next();
  }

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

function getSafeRedirectUrl(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get("redirect");

  if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
    return new URL(redirect, request.url);
  }

  return new URL("/chat", request.url);
}

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.jpg" ||
    pathname === "/aion-mind-logo.jpg" ||
    pathname === "/profile_avtar.png" ||
    pathname === "/user_icon.png" ||
    pathname === "/The Brain.jpg" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
