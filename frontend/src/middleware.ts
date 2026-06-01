import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const authSession = request.cookies.get("auth_session");
  const { pathname } = request.nextUrl;

  console.log(`[Middleware] Path: ${pathname}, Method: ${request.method}, Auth: ${!!authSession}`);

  // 1. Allow public access to public endpoints (login, API auth, and static files)
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Allow public access to GET `/api/v1/jobs` (so jobs explore can fetch jobs)
  if (pathname === "/api/v1/jobs" && request.method === "GET") {
    return NextResponse.next();
  }

  // 3. Restrict all other routes if not authenticated
  if (!authSession) {
    // If it's an API route call, return 401 Unauthorized instead of a redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Please log in using Google or GitHub." },
        { status: 401 }
      );
    }

    // Redirect web requests to /login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for Next.js internal folders and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
