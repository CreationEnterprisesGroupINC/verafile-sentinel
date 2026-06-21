// app/api/internal/record-anchor/route.ts
//
// Called by Railway worker after successful on-chain commit.
// Updates Neon DB usage counter and anchor history with S3 keys for
// proof JSON and DoD receipt.

import { NextRequest, NextResponse } from "next/server";
import { recordAnchor } from "@/lib/usage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    console.error("INTERNAL_SECRET not configured");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }
  if (req.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    userId: string;
    txHash: string | null;
    blockNumber: number | null;
    rootHash: string | null;
    documentType: string | null;
    organizationName: string | null;
    fileCount: number | null;
    proofKey: string | null;
    receiptKey: string | null;
    jobId: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const incremented = await recordAnchor({
      userId: body.userId,
      txHash: body.txHash,
      blockNumber: body.blockNumber,
      rootHash: body.rootHash,
      documentType: body.documentType,
      organizationName: body.organizationName,
      fileCount: body.fileCount,
      proofKey: body.proofKey,
      receiptKey: body.receiptKey,
      jobId: body.jobId,
    });

    if (!incremented) {
      console.warn(`[record-anchor] Guarded increment failed for user ${body.userId}`);
    }

    return NextResponse.json({ ok: true, incremented });
  } catch (err: any) {
    console.error("[record-anchor] DB write failed:", err);
    return NextResponse.json({ error: "DB write failed" }, { status: 500 });
  }
}
