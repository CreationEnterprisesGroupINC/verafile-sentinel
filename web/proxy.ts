import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Protects the main app and the anchoring APIs. Unauthenticated page
 * requests redirect to /login; unauthenticated API requests get 401 JSON.
 *
 * Public by omission from the matcher: /login, /register, /pricing, /terms,
 * /api/auth/*, /api/webhooks/*, and all static assets.
 */
export async function proxy(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in required." },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/api/commit/:path*",
    "/api/report/:path*",
    "/api/verify/:path*",
  ],
};
