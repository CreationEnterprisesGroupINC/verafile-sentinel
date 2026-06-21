// app/api/commit/[jobId]/status/route.ts
//
// Client polls this every 3 seconds after POST /api/commit returns { jobId }.
// Returns the current job state from Redis.
//
// Responses:
//   pending    — job is queued, worker hasn't started
//   processing — worker has picked up the job, tx submitted
//   confirmed  — tx confirmed, proof available in response
//   failed     — worker exhausted retries, error_detail available
//   dead       — in DLQ, requires manual intervention

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getJobRecord } from "@/lib/queue";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  if (!jobId || !/^[a-f0-9]{32}$/.test(jobId)) {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }

  const job = await getJobRecord(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Ownership check — users can only poll their own jobs
  if (job.payload.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Shape the response based on status
  const base = {
    jobId: job.jobId,
    status: job.status,
    enqueuedAt: job.enqueuedAt,
    updatedAt: job.updatedAt,
  };

  if (job.status === "confirmed" && job.proof) {
    return NextResponse.json({ ...base, proof: job.proof });
  }

  if (job.status === "failed" || job.status === "dead") {
    return NextResponse.json({
      ...base,
      errorDetail: job.errorDetail,
      retryCount: job.retryCount ?? 0,
    });
  }

  return NextResponse.json(base);
}
