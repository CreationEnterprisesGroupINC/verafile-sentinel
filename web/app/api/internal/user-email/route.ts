// app/api/internal/user-email/route.ts
// Returns email, name, and stripe_customer_id for a userId.
// Called by Railway worker for email + metering without direct DB access.

import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret || req.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  return NextResponse.json({
    email: user.email,
    name: user.name,
    stripeCustomerId: user.stripe_customer_id,
    plan: user.plan,
  });
}
