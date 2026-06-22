// app/api/download/route.ts
//
// Generates a presigned S3 GET URL for a stored proof JSON or receipt file.
// Validates that the requesting user owns the file (key must start with
// receipts/{userId}/ or uploads/{userId}/).
//
// GET /api/download?key=receipts/userId/jobId/org-sentinel.proof.json
// Returns: { url: string }  — presigned S3 GET URL, 15 min expiry

import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const URL_EXPIRY_SECONDS = 15 * 60; // 15 minutes

function getS3Client(): S3Client {
  const { S3_REGION: region, S3_ACCESS_KEY_ID: accessKeyId, S3_SECRET_ACCESS_KEY: secretAccessKey, S3_ENDPOINT: endpoint } = process.env;
  if (!region || !accessKeyId || !secretAccessKey) throw new Error("S3 not configured");
  return new S3Client({ region, credentials: { accessKeyId, secretAccessKey }, ...(endpoint ? { endpoint, forcePathStyle: false } : {}) });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const key = req.nextUrl.searchParams.get("key");
  if (!key || key.length > 1000) {
    return NextResponse.json({ error: "key param required" }, { status: 400 });
  }

  // Ownership check: key must belong to this user
  const allowedPrefixes = [`receipts/${userId}/`, `uploads/${userId}/`];
  const owned = allowedPrefixes.some(prefix => key.startsWith(prefix));
  if (!owned || key.includes("..") || key.includes("//")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) return NextResponse.json({ error: "Storage not configured" }, { status: 500 });

  try {
    const client = getS3Client();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: URL_EXPIRY_SECONDS }
    );
    return NextResponse.json({ url, expiresIn: URL_EXPIRY_SECONDS });
  } catch (err: any) {
    console.error("[download] presigned URL failed:", err.message);
    return NextResponse.json({ error: "Could not generate download link" }, { status: 503 });
  }
}
