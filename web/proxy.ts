// proxy.ts
//
// Next.js edge middleware (must be named proxy.ts in this project).
// Handles auth protection and subscription lapse gating.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/commit/:path*",
    "/verify/:path*",
    "/billing-issue/:path*",
    "/api/commit/:path*",
    "/api/upload/:path*",
    "/api/receipt/:path*",
    "/api/report/:path*",
    "/api/download/:path*",
    "/api/anchors/:path*",
    "/api/stripe/portal/:path*",
    "/api/internal/:path*",
  ],
};

const LOGIN_URL         = "/login";
const BILLING_ISSUE_URL = "/billing-issue";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Internal API routes: secret header only, no JWT
  if (pathname.startsWith("/api/internal/")) {
    const secret = process.env.INTERNAL_SECRET;
    if (!secret || req.headers.get("x-internal-secret") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // All other protected routes: require JWT
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Sign in required." },
        { status: 401 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = LOGIN_URL;
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Subscription lapse check (JWT only — no DB call)
  const subscriptionStatus = (token as any).subscriptionStatus as string | undefined;
  const plan               = (token as any).plan as string | undefined;
  const isPaidPlan         = plan && plan !== "demo";

  if (isPaidPlan && subscriptionStatus && !["active", "trialing"].includes(subscriptionStatus)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "subscription_lapsed",
          message: "Your subscription is inactive. Please update your billing details.",
          billingUrl: "/api/stripe/portal",
        },
        { status: 402 }
      );
    }
    if (!pathname.startsWith(BILLING_ISSUE_URL)) {
      const url = req.nextUrl.clone();
      url.pathname = BILLING_ISSUE_URL;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}
