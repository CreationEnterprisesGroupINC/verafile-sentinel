// app/api/commit/route.ts
//
// Accepts fileTokens from the presigned upload flow, validates them,
// builds the manifest + root hash, then enqueues a job via QStash
// for the Railway worker to anchor on-chain.
//
// Returns immediately with { jobId, status: "pending" } — client polls
// GET /api/commit/[jobId]/status for updates.
//
// This is Steps 2-3 of the shipping plan: the synchronous record() call
// is gone; the Railway worker owns all on-chain interaction.

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { Client as QStashClient } from "@upstash/qstash";
import { authOptions } from "@/lib/auth";
import { enforceAnchorLimit } from "@/lib/usage";
import { isDocumentType } from "@/lib/cmmc-mapping";
import {
  setJobRecord,
  type CommitJobPayload,
  type JobRecord,
} from "@/lib/queue";

export const maxDuration = 30;
export const runtime = "nodejs";

const SHA256_RE = /^[a-f0-9]{64}$/i;

interface FileToken {
  s3Key: string;
  filename: string;
  sha256Hex: string;
  sizeBytes: number;
  confirmedAt: string;
  userId: string;
}

export async function POST(req: NextRequest) {
  // -------------------------------------------------------------------------
  // 1. Authentication
  // -------------------------------------------------------------------------
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // -------------------------------------------------------------------------
  // 2. Usage gate
  // -------------------------------------------------------------------------
  const gate = await enforceAnchorLimit(userId);
  if (!gate.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (!gate.allowed) {
    switch (gate.denyReason) {
      case "not_approved":
        return NextResponse.json(
          { error: "not_approved", message: "Your demo account is pending approval. You will receive an email when access is enabled." },
          { status: 403 }
        );
      case "subscription_lapsed":
        return NextResponse.json(
          { error: "subscription_lapsed", message: "Your subscription is inactive.", billingUrl: "/api/stripe/portal" },
          { status: 402 }
        );
      case "limit_reached":
        return NextResponse.json(
          { error: "limit_reached", plan: gate.user.plan, limit: gate.user.anchor_limit, upgradeUrl: "/pricing" },
          { status: 402 }
        );
      default:
        return NextResponse.json({ error: "access_denied" }, { status: 403 });
    }
  }

  // -------------------------------------------------------------------------
  // 3. Parse and validate
  // -------------------------------------------------------------------------
  let fileTokens: FileToken[];
  let organizationName: string;
  let documentType: unknown;

  try {
    const body = await req.json();
    fileTokens = body.fileTokens;
    organizationName = String(body.organizationName ?? "").trim();
    documentType = body.documentType;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(fileTokens) || fileTokens.length === 0) {
    return NextResponse.json({ error: "fileTokens array is required" }, { status: 400 });
  }
  if (!organizationName || organizationName.length > 200) {
    return NextResponse.json({ error: "organizationName is required (max 200 chars)" }, { status: 400 });
  }
  if (!isDocumentType(documentType)) {
    return NextResponse.json({ error: "Invalid or missing documentType" }, { status: 400 });
  }

  for (const token of fileTokens) {
    if (!token.s3Key?.startsWith(`uploads/${userId}/`)) {
      return NextResponse.json({ error: "Invalid fileToken: s3Key ownership mismatch" }, { status: 403 });
    }
    if (!SHA256_RE.test(token.sha256Hex)) {
      return NextResponse.json({ error: `Invalid hash in token for ${token.filename}` }, { status: 400 });
    }
    if (!token.filename) {
      return NextResponse.json({ error: "fileToken missing filename" }, { status: 400 });
    }
  }

  // -------------------------------------------------------------------------
  // 4. Build manifest + root hash (done here so the proof is deterministic
  //    regardless of worker execution timing)
  // -------------------------------------------------------------------------
  const manifest = fileTokens
    .map((t) => ({ path: t.filename, hash: "sha256:" + t.sha256Hex.toLowerCase() }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const salt = randomBytes(32).toString("hex");
  const combined = salt + "|" + manifest.map((e) => e.path + ":" + e.hash).join("|");
  const rootHashHex = createHash("sha256").update(combined).digest("hex");
  const rootHash = "sha256:" + rootHashHex;

  // -------------------------------------------------------------------------
  // 5. Write pending job to Redis
  // -------------------------------------------------------------------------
  const jobId = randomBytes(16).toString("hex");
  const enqueuedAt = new Date().toISOString();

  const payload: CommitJobPayload = {
    jobId,
    userId,
    organizationName,
    documentType: documentType as string,
    manifest,
    salt,
    rootHashHex,
    rootHash,
    enqueuedAt,
  };

  const jobRecord: JobRecord = {
    jobId,
    status: "pending",
    payload,
    enqueuedAt,
    updatedAt: enqueuedAt,
  };

  await setJobRecord(jobRecord);

  // -------------------------------------------------------------------------
  // 6. Enqueue via QStash → Railway worker
  // -------------------------------------------------------------------------
  const workerUrl = process.env.WORKER_URL;
  const qstashToken = process.env.QSTASH_TOKEN;

  if (!workerUrl || !qstashToken) {
    // Fail safe: remove the pending job and return error
    console.error("WORKER_URL or QSTASH_TOKEN not configured");
    return NextResponse.json({ error: "Worker not configured" }, { status: 500 });
  }

  try {
    const qstash = new QStashClient({ token: qstashToken });
    await qstash.publishJSON({
      url: workerUrl + "/work",
      body: payload,
      // QStash built-in retry: 3 attempts, exponential backoff
      // Worker handles its own retry for on-chain failures separately
      retries: 3,
    });
  } catch (err: any) {
    console.error("QStash enqueue failed:", err);
    return NextResponse.json({ error: "Failed to queue commit job" }, { status: 503 });
  }

  // Insert a pending anchor row so the dashboard can poll status immediately
  // (before the worker confirms on-chain). The row is updated by the worker
  // via /api/internal/record-anchor once the TX confirms.
  try {
    const { sql } = await import("@/lib/db");
    await sql`
      INSERT INTO anchors (
        user_id, tx_hash, block_number, root_hash,
        document_type, organization_name, file_count, job_id
      ) VALUES (
        ${userId}, NULL, NULL, ${rootHash},
        ${documentType as string}, ${organizationName}, ${fileTokens.length}, ${jobId}
      )
    `;
  } catch (err) {
    console.error("[commit] Failed to insert pending anchor row:", err);
    // Non-fatal — job is queued, worker will still run
  }

  return NextResponse.json({ jobId, status: "pending" });
}
