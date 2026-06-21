// app/api/admin/users/route.ts
// Returns all users for admin dashboard. ADMIN_SECRET protected.

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await sql`
    SELECT id, email, name, plan, approved, subscription_status,
           anchors_used_this_month, anchor_limit, stripe_customer_id,
           created_at, updated_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 200
  `;

  return NextResponse.json({ users });
}
