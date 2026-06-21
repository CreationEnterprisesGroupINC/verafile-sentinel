// app/api/anchors/[anchorId]/status/route.ts
//
// Returns the current job status for an anchor that hasn't confirmed yet.
// The anchor DB row stores the jobId (added to schema in this step).
// Falls back gracefully if jobId is not set (legacy rows).
//
// GET /api/anchors/[anchorId]/status
// Returns: { status: JobPhase, txHash?: string, errorDetail?: string }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getJobRecord } from "@/lib/queue";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { anchorId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { anchorId } = params;
  if (!anchorId) return NextResponse.json({ error: "anchorId required" }, { status: 400 });

  // Fetch anchor row — verify ownership
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

  // Already confirmed on-chain
  if (anchor.tx_hash) {
    return NextResponse.json({ status: "confirmed", txHash: anchor.tx_hash });
  }

  // No jobId — either a legacy row or something went wrong at enqueue
  if (!anchor.job_id) {
    return NextResponse.json({ status: "pending" });
  }

  // Look up job in Redis
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
