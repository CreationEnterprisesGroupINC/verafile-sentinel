// lib/queue.ts
//
// Job queue types and Redis client shared between the enqueue API route
// and the Railway worker.
//
// Architecture:
//   - Job payloads written to Upstash Redis as JSON strings under key
//     `job:{jobId}` for status polling
//   - QStash delivers the job payload to the Railway worker via HTTP POST
//   - Worker updates job status in Redis on each state transition
//   - Dead-letter entries written to `dlq:{jobId}` after max retries
//
// Environment variables:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//   QSTASH_TOKEN              (publish side — Vercel only)
//   QSTASH_CURRENT_SIGNING_KEY  (verify side — Railway worker only)
//   QSTASH_NEXT_SIGNING_KEY     (verify side — Railway worker only)
//   WORKER_URL                (full URL of the Railway worker endpoint)

import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Redis client (REST-based, works in serverless + Node.js)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

export type JobStatus = "pending" | "processing" | "confirmed" | "failed" | "dead";

export interface CommitJobPayload {
  jobId: string;
  userId: string;
  organizationName: string;
  documentType: string;
  manifest: { path: string; hash: string }[]; // sorted, pre-validated
  salt: string;                                // generated at enqueue time
  rootHashHex: string;                         // sha256(salt|manifest entries)
  rootHash: string;                            // "sha256:" + rootHashHex
  enqueuedAt: string;
}

export interface JobRecord {
  jobId: string;
  status: JobStatus;
  payload: CommitJobPayload;
  // Set on confirmation:
  txHash?: string;
  blockNumber?: number;
  blockTimestamp?: string;
  committerAddress?: string;
  proof?: Record<string, unknown>;
  // Set on failure:
  errorDetail?: string;
  retryCount?: number;
  // Timestamps:
  enqueuedAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Redis key helpers
// ---------------------------------------------------------------------------

export const jobKey = (jobId: string) => `job:${jobId}`;
export const dlqKey = (jobId: string) => `dlq:${jobId}`;

// TTL: keep job records for 90 days (CMMC audit trail)
export const JOB_TTL_SECONDS = 90 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Job record helpers
// ---------------------------------------------------------------------------

export async function getJobRecord(jobId: string): Promise<JobRecord | null> {
  const redis = getRedis();
  const raw = await redis.get<JobRecord>(jobKey(jobId));
  return raw ?? null;
}

export async function setJobRecord(record: JobRecord): Promise<void> {
  const redis = getRedis();
  await redis.set(jobKey(record.jobId), record, { ex: JOB_TTL_SECONDS });
}

export async function updateJobStatus(
  jobId: string,
  update: Partial<JobRecord>
): Promise<void> {
  const redis = getRedis();
  const existing = await redis.get<JobRecord>(jobKey(jobId));
  if (!existing) {
    console.error(`updateJobStatus: job ${jobId} not found in Redis`);
    return;
  }
  const updated: JobRecord = {
    ...existing,
    ...update,
    updatedAt: new Date().toISOString(),
  };
  await redis.set(jobKey(jobId), updated, { ex: JOB_TTL_SECONDS });
}
