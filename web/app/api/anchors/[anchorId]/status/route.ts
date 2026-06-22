// app/api/anchors/[anchorId]/status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getJobRecord } from "@/lib/queue";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ anchorId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { anchorId } = await params;
  if (!anchorId) return NextResponse.json({ error: "anchorId required" }, { status: 400 });

  const rows = (await sql`
    SELECT id, user_id, tx_hash, job_id FROM anchors
    WHERE id = ${anchorId}
    LIMIT 1
  `) as { id: string; user_id: string; tx_hash: string | null; job_id: string | null }[];

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const anchor = rows[0];

  if (anchor.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (anchor.tx_hash) {
    return NextResponse.json({ status: "confirmed", txHash: anchor.tx_hash });
  }

  if (!anchor.job_id) {
    return NextResponse.json({ status: "pending" });
  }

  const job = await getJobRecord(anchor.job_id);
  if (!job) {
    return NextResponse.json({ status: "pending" });
  }

  return NextResponse.json({
    status: job.status,
    txHash: job.txHash ?? null,
    errorDetail: job.errorDetail ?? null,
  });
}
