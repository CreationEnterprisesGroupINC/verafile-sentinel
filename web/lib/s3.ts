// lib/s3.ts
//
// Shared S3 client factory. Works with both Cloudflare R2 and AWS S3.
//
// R2 (recommended — no egress fees):
//   S3_BUCKET=your-bucket
//   S3_REGION=auto
//   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
//   S3_ACCESS_KEY_ID=<r2-access-key>
//   S3_SECRET_ACCESS_KEY=<r2-secret>
//
// AWS S3:
//   S3_BUCKET=your-bucket
//   S3_REGION=us-east-1
//   S3_ENDPOINT=   (leave unset)
//   S3_ACCESS_KEY_ID=<iam-access-key>
//   S3_SECRET_ACCESS_KEY=<iam-secret>

import { S3Client } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (_client) return _client;

  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 not configured. Set S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY."
    );
  }

  _client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });

  return _client;
}

export function getS3Bucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET environment variable not set");
  return bucket;
}

// Validates that an s3Key was issued for a specific userId.
// Prevents users from referencing each other's upload paths.
export function assertS3KeyOwner(s3Key: string, userId: string): void {
  const expectedPrefix = `uploads/${userId}/`;
  if (!s3Key.startsWith(expectedPrefix) || s3Key.includes("..") || s3Key.includes("//")) {
    throw new Error("s3Key does not belong to this user");
  }
}
