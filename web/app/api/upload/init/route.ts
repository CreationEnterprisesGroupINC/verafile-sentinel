// app/api/upload/init/route.ts
//
// Step 1 of the presigned upload flow.
//
// Client sends: { filename, sizeBytes, mimeType }
// Server returns: { uploadUrl, s3Key, expiresAt }
//
// The client then PUTs the file directly to S3 using uploadUrl — Vercel is
// bypassed entirely, so the 4.5MB body limit does not apply.
//
// Environment variables required:
//   S3_BUCKET         — bucket name (R2 or AWS S3)
//   S3_REGION         — e.g. "auto" for R2, "us-east-1" for S3
//   S3_ENDPOINT       — full endpoint URL (required for R2; omit for AWS S3)
//   S3_ACCESS_KEY_ID
//   S3_SECRET_ACCESS_KEY

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB hard cap
const URL_EXPIRY_SECONDS = 15 * 60;       // 15 minutes

// Allowed MIME types — expand as needed, but keep the list explicit.
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/octet-stream", // fallback for unknown binary types
]);

function getS3Client(): S3Client {
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT; // set for R2, leave unset for AWS

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 environment variables not configured");
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint ? { endpoint, forcePathStyle: false } : {}),
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export async function POST(req: NextRequest) {
  // Auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse and validate body
  let filename: string;
  let sizeBytes: number;
  let mimeType: string;

  try {
    const body = await req.json();
    filename = String(body.filename ?? "").trim();
    sizeBytes = Number(body.sizeBytes);
    mimeType = String(body.mimeType ?? "application/octet-stream").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!filename || filename.length > 500) {
    return NextResponse.json({ error: "filename is required (max 500 chars)" }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "sizeBytes must be a positive number" }, { status: 400 });
  }
  if (sizeBytes > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.` },
      { status: 413 }
    );
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    // Accept it anyway but log — don't block legitimate compliance docs
    console.warn(`Unusual MIME type from user ${session.user.id}: ${mimeType}`);
  }

  // Generate a unique, non-guessable S3 key scoped to the user.
  // Format: uploads/{userId}/{random}/{sanitized-filename}
  const randomSuffix = randomBytes(16).toString("hex");
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const s3Key = `uploads/${session.user.id}/${randomSuffix}/${safeFilename}`;

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: "Server storage not configured" }, { status: 500 });
  }

  let uploadUrl: string;
  try {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      // ContentType intentionally OMITTED.
      //
      // R2 presigned PUT from a browser must be a minimal, host-only signed
      // request. Anything beyond `host` in the signed/expected set is a way for
      // the PUT to 403 — and an R2 403 carries no CORS headers, so the browser
      // reports it as "Access-Control-Allow-Origin: Missing Header" rather than
      // the real 403. We therefore sign ONLY host and let the client send a body
      // with no Content-Type. The object lands as application/octet-stream, which
      // is correct here: files are fingerprinted and sealed, never re-served by
      // their content-type.
      //
      // ContentLength, Tagging, and ChecksumAlgorithm are likewise omitted —
      // ContentLength/Tagging add headers the browser cannot set, and the SDK's
      // default CRC32 checksum (suppressed via requestChecksumCalculation:
      // "WHEN_REQUIRED" in getS3Client) would otherwise embed a checksum of an
      // EMPTY body as a signed query param, guaranteeing a body mismatch → 403.
    });
    uploadUrl = await getSignedUrl(client, command, { expiresIn: URL_EXPIRY_SECONDS });
  } catch (err: any) {
    console.error("Failed to generate presigned URL:", err);
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  const expiresAt = new Date(Date.now() + URL_EXPIRY_SECONDS * 1000).toISOString();

  return NextResponse.json({ uploadUrl, s3Key, expiresAt });
}
