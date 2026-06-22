// app/api/upload/confirm/route.ts
//
// Step 2 of the presigned upload flow.
//
// After the client PUTs the file directly to S3, it calls this endpoint with:
//   { s3Key, sha256Hex, filename, sizeBytes }
//
// Server:
//   1. Validates the s3Key belongs to this user (prefix check)
//   2. Validates the sha256Hex format
//   3. Verifies the object actually landed in S3 (HeadObject)
//   4. Returns a fileToken the commit API accepts in place of the raw file
//
// The commit route (Step 3, worker-based) will accept either:
//   - Legacy: raw files in FormData (still works for small files in dev)
//   - New: fileTokens referencing confirmed S3 objects
//
// Environment variables: same as /api/upload/init

import { NextRequest, NextResponse } from "next/server";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const SHA256_RE = /^[a-f0-9]{64}$/i;

function getS3Client(): S3Client {
  const region = process.env.S3_REGION!;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;
  const endpoint = process.env.S3_ENDPOINT;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 environment variables not configured");
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint ? { endpoint, forcePathStyle: false } : {}),
  });
}

export async function POST(req: NextRequest) {
  // Auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Parse body
  let s3Key: string;
  let sha256Hex: string;
  let filename: string;
  let sizeBytes: number;

  try {
    const body = await req.json();
    s3Key = String(body.s3Key ?? "").trim();
    sha256Hex = String(body.sha256Hex ?? "").toLowerCase().trim();
    filename = String(body.filename ?? "").trim();
    sizeBytes = Number(body.sizeBytes);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate s3Key belongs to this user — prefix must be uploads/{userId}/
  const expectedPrefix = `uploads/${userId}/`;
  if (!s3Key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid s3Key" }, { status: 403 });
  }
  if (s3Key.includes("..") || s3Key.includes("//")) {
    return NextResponse.json({ error: "Invalid s3Key" }, { status: 400 });
  }

  // Validate hash format
  if (!SHA256_RE.test(sha256Hex)) {
    return NextResponse.json(
      { error: "sha256Hex must be a 64-character lowercase hex string" },
      { status: 400 }
    );
  }

  if (!filename || filename.length > 500) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: "Server storage not configured" }, { status: 500 });
  }

  // Verify the object landed in S3
  try {
    const client = getS3Client();
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: s3Key }));
  } catch (err: any) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      return NextResponse.json(
        { error: "File not found in storage. Upload may have failed or expired." },
        { status: 404 }
      );
    }
    console.error("HeadObject failed:", err);
    return NextResponse.json({ error: "Storage verification failed" }, { status: 503 });
  }

  // Return a fileToken the commit route will accept.
  // This is a structured object — not a signed JWT, just a plain record.
  // The commit route validates the userId prefix again before trusting it.
  const fileToken = {
    s3Key,
    filename,
    sha256Hex: sha256Hex.toLowerCase(),
    sizeBytes,
    confirmedAt: new Date().toISOString(),
    userId,
  };

  return NextResponse.json({ fileToken });
}
