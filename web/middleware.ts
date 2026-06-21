// middleware.ts
//
// Edge middleware — runs on every request before any route handler.
//
// Responsibilities:
//   1. Redirect unauthenticated users away from protected routes to /login
//   2. Block lapsed (past_due/inactive) paid subscribers from /dashboard
//      and /api/commit with a redirect to /billing-issue
//
// NOTE: Deep usage gating (anchor limits, approved flag) stays in
// enforceAnchorLimit() in lib/usage.ts — that requires a DB read which
// belongs in the route handler, not at the edge.
//
// This middleware reads the NextAuth JWT directly — no DB calls, runs fast.

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const config = {
  matcher: [
    // Protected pages
    "/dashboard/:path*",
    "/commit/:path*",
    "/verify/:path*",
    // Protected API routes
    "/api/commit/:path*",
    "/api/upload/:path*",
    "/api/receipt/:path*",
    "/api/report/:path*",
    "/api/stripe/portal/:path*",
    "/api/download/:path*",
    "/api/anchors/:path*",
    "/api/internal/:path*",
  ],
};

// Routes the lapsed-subscription banner links to
const BILLING_ISSUE_URL = "/billing-issue";
const LOGIN_URL         = "/login";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Internal API routes: secret header only, never JWT ───────────────────
  if (pathname.startsWith("/api/internal/")) {
    const secret = process.env.INTERNAL_SECRET;
    if (!secret || req.headers.get("x-internal-secret") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── All other protected routes: require JWT ───────────────────────────────
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    // API routes return JSON; page routes redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = LOGIN_URL;
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // ── Subscription lapse check (JWT only — no DB) ───────────────────────────
  // The JWT is refreshed on session access and includes subscriptionStatus
  // from the session callback in lib/auth.ts.
  const subscriptionStatus = (token as any).subscriptionStatus as string | undefined;
  const plan               = (token as any).plan as string | undefined;
  const isPaidPlan         = plan && plan !== "demo";

  if (isPaidPlan && subscriptionStatus && !["active", "trialing"].includes(subscriptionStatus)) {
    // Lapsed subscriber trying to use the product
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
    // Page routes: redirect to billing issue page (not /dashboard to avoid loop)
    if (!pathname.startsWith(BILLING_ISSUE_URL)) {
      const url = req.nextUrl.clone();
      url.pathname = BILLING_ISSUE_URL;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}
