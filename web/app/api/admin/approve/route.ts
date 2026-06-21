// app/api/admin/approve/route.ts
//
// Manually approves a demo user so they can anchor.
// Protected by ADMIN_SECRET — not exposed publicly.
//
// POST body: { email: string } or { userId: string }
// Returns:   { ok: true, email, approved: true }
//
// Usage (curl):
//   curl -X POST https://verafilecorporation.com/api/admin/approve \
//     -H "x-admin-secret: $ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"email": "user@example.com"}'

import { NextRequest, NextResponse } from "next/server";
import { sql, getUserByEmail, getUserById } from "@/lib/db";
import { sendApprovalEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error("ADMIN_SECRET not configured");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }
  if (req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { email?: string; userId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  if (!body.email && !body.userId) {
    return NextResponse.json({ error: "email or userId required" }, { status: 400 });
  }

  try {
    let updated: { id: string; email: string }[];

    if (body.email) {
      // Normalise and look up
      const user = await getUserByEmail(body.email);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      updated = (await sql`
        UPDATE users
        SET approved = true, updated_at = NOW()
        WHERE id = ${user.id}
        RETURNING id, email
      `) as { id: string; email: string }[];
    } else {
      updated = (await sql`
        UPDATE users
        SET approved = true, updated_at = NOW()
        WHERE id = ${body.userId!}
        RETURNING id, email
      `) as { id: string; email: string }[];
    }

    if (!updated.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log(`[admin] Approved demo user: ${updated[0].email} (${updated[0].id})`);

    // Send approval email non-blocking
    const approvedUser = await getUserById(updated[0].id);
    if (approvedUser) {
      sendApprovalEmail({ to: approvedUser.email, name: approvedUser.name ?? "there" }).catch(err =>
        console.error("[admin] approval email failed:", err.message)
      );
    }

    return NextResponse.json({ ok: true, email: updated[0].email, approved: true });
  } catch (err: any) {
    console.error("[admin] approve failed:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// Also support GET for quick status checks
export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email param required" }, { status: 400 });

  const user = await getUserByEmail(email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    approved: user.approved,
    subscriptionStatus: user.subscription_status,
    anchorsUsed: user.anchors_used_this_month,
    anchorLimit: user.anchor_limit,
  });
}
