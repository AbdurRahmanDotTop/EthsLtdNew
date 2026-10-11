import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ethsltd_super_secret_jwt_key_2026_production"
);

const COOKIE_NAME = "ethsltd_auth_token";

interface SessionPayload {
  userId?: string;
  email?: string;
  role?: string;
  uid?: number;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  let session: SessionPayload | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      session = payload as SessionPayload;
    } catch {
      session = null;
    }
  }

  // 1. Admin routes protection: /admin and subroutes
  if (pathname.startsWith("/admin")) {
    if (!session) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      // Forbidden for non-admins, redirect to user dashboard
      return NextResponse.redirect(new URL("/assets", request.url));
    }
  }

  // 2. RM Dashboard protection: /rm/dashboard
  if (pathname.startsWith("/rm/dashboard")) {
    if (!session) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    if (session.role !== "RM" && session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/relationship-managers", request.url));
    }
  }

  // 3. Protected user account and contract/chat routes
  const isProtectedUserRoute =
    pathname.startsWith("/assets") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/security") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/contracts") ||
    pathname.startsWith("/rm/chat");

  if (isProtectedUserRoute) {
    if (!session) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  // 4. Redirect logged-in users away from auth pages
  if (pathname === "/login" || pathname === "/register") {
    if (session) {
      if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (session.role === "RM") {
        return NextResponse.redirect(new URL("/rm/dashboard", request.url));
      }
      return NextResponse.redirect(new URL("/assets", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/assets/:path*",
    "/profile/:path*",
    "/security/:path*",
    "/account/:path*",
    "/contracts/:path*",
    "/rm/:path*",
    "/login",
    "/register",
  ],
};
