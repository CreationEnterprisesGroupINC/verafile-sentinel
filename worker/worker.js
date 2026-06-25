// worker/worker.js
//
// Sentinel commit worker — Railway, single process, replicas = 1.
//
// After on-chain confirmation:
//   1. Generates proof JSON + DoD receipt text
//   2. Stores both to S3 under receipts/{userId}/{jobId}/
//   3. Calls /api/internal/record-anchor with S3 keys
//   4. Sends confirmation email via Resend
//   5. Updates Redis job record to confirmed + full proof
//
// Environment variables:
//   SENTINEL_PRIVATE_KEY
//   SENTINEL_RPC_URL              Base Mainnet RPC
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//   QSTASH_CURRENT_SIGNING_KEY
//   QSTASH_NEXT_SIGNING_KEY
//   S3_BUCKET
//   S3_REGION
//   S3_ENDPOINT                   (R2 only)
//   S3_ACCESS_KEY_ID
//   S3_SECRET_ACCESS_KEY
//   RESEND_API_KEY
//   RESEND_FROM                   e.g. "Verafile Sentinel <receipts@verafilecorporation.com>"
//   APP_URL                       Vercel app URL for internal callbacks
//   INTERNAL_SECRET
//   PORT                          set by Railway

import http from "http";
import { ethers } from "ethers";
import { Redis } from "@upstash/redis";
import { Receiver } from "@upstash/qstash";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resend } from "resend";
import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OCP_CONTRACT    = "0x0473fe648cc3c2a64962df7d2ab0969d4e1d1e22";
const OCP_ABI         = ["function record(bytes32 digest) external"];
const MAX_RETRIES     = 3;
const RETRY_DELAYS_MS = [15_000, 60_000, 300_000];
const GAS_CAP_GWEI    = 250n;
const JOB_TTL         = 90 * 24 * 60 * 60;
const PORT            = parseInt(process.env.PORT ?? "3001");

// ---------------------------------------------------------------------------
// Stripe metered billing
// ---------------------------------------------------------------------------

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
}

async function reportMeterEvent({ stripeCustomerId, jobId, blockTimestamp }) {
  const meterId = process.env.STRIPE_METER_ID;
  if (!meterId) { console.warn("[metering] STRIPE_METER_ID not set — skipping"); return; }
  if (!stripeCustomerId?.startsWith("cus_")) { console.warn("[metering] No valid customer ID — skipping"); return; }
  try {
    const stripe = getStripe();
    await stripe.billing.meterEvents.create({
      event_name: "sentinel_anchor",
      payload: { stripe_customer_id: stripeCustomerId, value: "1" },
      identifier: jobId, // dedup key — safe to retry
      timestamp: blockTimestamp
        ? Math.floor(new Date(blockTimestamp).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
    });
    console.log(`[metering] Event reported for customer ${stripeCustomerId}`);
  } catch (err) {
    // Non-fatal — never fail an anchor over a metering issue
    console.error(`[metering] Failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Receipt text generator (duplicated from lib/receipt.ts — worker is standalone)
// ---------------------------------------------------------------------------

const ALGO_WIDTH = 9;
const GAP1       = 7;
const HASH_WIDTH = 64;
const GAP2       = 1;

function receiptRow(algo, hash, path) {
  return algo.padEnd(ALGO_WIDTH) + " ".repeat(GAP1) + hash.padEnd(HASH_WIDTH) + " ".repeat(GAP2) + path;
}

const PS_HEADER = receiptRow("Algorithm", "Hash", "Path");
const PS_SEP    = receiptRow("-".repeat(ALGO_WIDTH), "----", "----");

function generateReceiptText({ manifest, organization, documentType, txHash, blockNumber, blockTimestamp, rootHash, chain, contract }) {
  const lines = [];
  lines.push("VERAFILE SENTINEL — CMMC EVIDENCE RECEIPT");
  lines.push("=".repeat(78));
  lines.push(`Organization   : ${organization}`);
  lines.push(`Document type  : ${documentType}`);
  lines.push(`Chain          : ${chain}`);
  lines.push(`Contract       : ${contract}`);
  lines.push(`Transaction    : ${txHash}`);
  lines.push(`Block          : ${blockNumber}`);
  lines.push(`Anchor time    : ${blockTimestamp ?? "—"} UTC`);
  lines.push(`Root hash      : ${rootHash}`);
  lines.push(`Generated      : ${new Date().toISOString()} UTC`);
  lines.push("");
  lines.push("INTEGRITY NOTE: Each file digest below was committed to the blockchain as part");
  lines.push("of the root hash above. Any modification after the anchor timestamp is");
  lines.push("cryptographically detectable. Verification: see sentinel.proof.json.");
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("");
  lines.push(PS_HEADER);
  lines.push(PS_SEP);
  for (const entry of manifest) {
    const rawHex = entry.hash.startsWith("sha256:") ? entry.hash.slice(7).toUpperCase() : entry.hash.toUpperCase();
    const winPath = `C:\\SentinelEvidence\\${entry.path.replace(/\//g, "\\")}`;
    lines.push(receiptRow("SHA256", rawHex, winPath));
  }
  lines.push("");
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("INDEPENDENT VERIFICATION");
  lines.push("=".repeat(78));
  lines.push("");
  lines.push("To verify this receipt independently without Verafile:");
  lines.push("");
  lines.push("  1. Compute the SHA-256 digest of each file listed above.");
  lines.push("  2. Compare each digest to the hash in this receipt.");
  lines.push("  3. Open the sentinel.proof.json file accompanying this receipt.");
  lines.push("  4. Reconstruct the root preimage:");
  lines.push("       {salt}|{filename1}:sha256:{hash1}|{filename2}:sha256:{hash2}|...");
  lines.push("       (entries sorted alphabetically by filename, lowercase hashes)");
  lines.push("  5. SHA-256 the preimage string. Compare to root_hash in the proof.");
  lines.push(`  6. Confirm the root hash on-chain: https://basescan.org/tx/${txHash}`);
  lines.push("");
  lines.push("No Verafile software, account, or cooperation is required.");
  lines.push("=".repeat(78));
  lines.push("Verafile Sentinel | ERC-8281 | damon@ocp-labs.org");
  lines.push("=".repeat(78));
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

function getRedis() {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}

function getS3() {
  const { S3_REGION: region, S3_ACCESS_KEY_ID: accessKeyId, S3_SECRET_ACCESS_KEY: secretAccessKey, S3_ENDPOINT: endpoint } = process.env;
  return new S3Client({ region, credentials: { accessKeyId, secretAccessKey }, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) });
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

// ---------------------------------------------------------------------------
// Redis helpers
// ---------------------------------------------------------------------------

const jobKey = (id) => `job:${id}`;
const dlqKey = (id) => `dlq:${id}`;

async function setJobField(redis, jobId, update) {
  const existing = await redis.get(jobKey(jobId));
  if (!existing) { console.error(`[worker] job ${jobId} not in Redis`); return; }
  await redis.set(jobKey(jobId), { ...existing, ...update, updatedAt: new Date().toISOString() }, { ex: JOB_TTL });
}

// ---------------------------------------------------------------------------
// S3 storage
// ---------------------------------------------------------------------------

async function storeToS3(key, body, contentType) {
  const s3 = getS3();
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

// ---------------------------------------------------------------------------
// On-chain anchor with retry
// ---------------------------------------------------------------------------

async function anchorWithRetry(payload, redis) {
  const { jobId, rootHashHex, rootHash, manifest, salt, organizationName, documentType } = payload;
  const provider = new ethers.JsonRpcProvider(process.env.SENTINEL_RPC_URL);
  const wallet   = new ethers.Wallet(process.env.SENTINEL_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(OCP_CONTRACT, OCP_ABI, wallet);
  let lastError  = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt === 0) await setJobField(redis, jobId, { status: "processing" });

      // Gas cap check
      const feeData     = await provider.getFeeData();
      const gasPriceWei = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
      if (gasPriceWei / 1_000_000_000n > GAS_CAP_GWEI) {
        console.warn(`[worker] [${jobId}] Gas > cap, waiting 5min`);
        await setJobField(redis, jobId, { errorDetail: "Gas price above cap — queued for retry" });
        await sleep(5 * 60 * 1000);
        continue;
      }

      const nonce       = await wallet.getNonce("latest");
      const hashBytes   = "0x" + rootHashHex;
      const estimated   = await contract.record.estimateGas(hashBytes);
      const gasLimit    = (estimated * 120n) / 100n;

      console.log(`[worker] [${jobId}] TX attempt ${attempt + 1}, nonce ${nonce}`);
      const tx      = await contract.record(hashBytes, { nonce, gasLimit });
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) throw new Error(`TX reverted: ${tx.hash}`);

      const block              = await provider.getBlock(receipt.blockNumber);
      const receiptLogPosition = receipt.logs.findIndex(l => l.address.toLowerCase() === OCP_CONTRACT.toLowerCase());
      console.log(`[worker] [${jobId}] Confirmed block ${receipt.blockNumber}`);

      const proof = {
        sentinel_version: "1.1.0",
        proof_type: "ocp-erc8281-v0",
        package: { organization: organizationName, document_type: documentType },
        root_hash: rootHash,
        salt,
        manifest,
        chain: { name: "base-mainnet", chain_id: 8453, contract: OCP_CONTRACT },
        commitment: {
          tx_hash: receipt.hash,
          block_number: receipt.blockNumber,
          block_timestamp: block ? new Date(block.timestamp * 1000).toISOString() : null,
          committer_address: wallet.address,
          receipt_log_position: receiptLogPosition >= 0 ? receiptLogPosition : null,
        },
        erc8281: {
          envelope_version: "sentinel-v0",
          digest: "0x" + rootHashHex,
          hash_function: "sha2-256",
          chain_id: "8453",
          contract: OCP_CONTRACT,
          tx_hash: receipt.hash,
          block_number: String(receipt.blockNumber),
          receipt_log_position: receiptLogPosition >= 0 ? String(receiptLogPosition) : null,
          committer: wallet.address,
          conformance_note: "Anchored via v0 OCP contract. Verify via documented procedure in `verification`.",
        },
        verification: {
          instructions: "Re-hash each file (SHA-256). Sort by filename. Prepend salt with '|'. SHA-256 combined string. Compare to root_hash. Confirm on-chain.",
          independent_verifier: "https://basescan.org/tx/" + receipt.hash,
        },
      };

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockTimestamp: block ? new Date(block.timestamp * 1000).toISOString() : null,
        committerAddress: wallet.address,
        proof,
      };
    } catch (err) {
      lastError = err;
      console.error(`[worker] [${jobId}] Attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[attempt] ?? 300_000;
        await setJobField(redis, jobId, { errorDetail: `Attempt ${attempt + 1} failed: ${err.message}`, retryCount: attempt + 1 });
        await sleep(delay);
      }
    }
  }
  throw lastError ?? new Error("All retry attempts exhausted");
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

async function fetchUserInfo(appUrl, userId) {
  try {
    const res = await fetch(`${appUrl}/api/internal/user-email?userId=${userId}`, {
      headers: { "x-internal-secret": process.env.INTERNAL_SECRET ?? "" },
    });
    if (res.ok) return await res.json(); // { email, name, stripeCustomerId, plan }
    console.error(`[worker] user-email fetch returned ${res.status}`);
  } catch (err) {
    console.error("[worker] Failed to fetch user info:", err.message);
  }
  return null;
}

async function sendConfirmationEmail({ userInfo, userId, organizationName, documentType, txHash, blockNumber, blockTimestamp, appUrl }) {
  if (!process.env.RESEND_API_KEY) { console.warn("[worker] RESEND_API_KEY not set — skipping email"); return; }

  const userEmail = userInfo?.email ?? null;
  if (!userEmail) { console.warn(`[worker] No email for user ${userId} — skipping email`); return; }

  const resend = getResend();
  const from   = process.env.RESEND_FROM ?? "Verafile Sentinel <receipts@verafilecorporation.com>";
  const safeOrg = organizationName.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <div style="background: #1a3a6b; padding: 24px 32px;">
    <p style="color: #fff; font-size: 20px; font-weight: bold; margin: 0;">Verafile Sentinel</p>
    <p style="color: #94b4d4; font-size: 13px; margin: 4px 0 0;">Package Sealed — Evidence Receipt</p>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 15px;">Your compliance package has been permanently anchored to Base Mainnet.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
      <tr><td style="padding: 8px 0; color: #6b7280; width: 140px;">Organization</td><td style="padding: 8px 0; font-weight: bold;">${organizationName}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Document type</td><td style="padding: 8px 0;">${documentType}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Transaction</td><td style="padding: 8px 0; font-family: monospace; font-size: 11px; word-break: break-all;">${txHash}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Block</td><td style="padding: 8px 0; font-family: monospace;">${blockNumber?.toLocaleString()}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Anchor time</td><td style="padding: 8px 0;">${blockTimestamp ?? "—"} UTC</td></tr>
    </table>
    <p style="margin: 24px 0 8px; font-size: 13px; color: #374151;">
      Log in to your Sentinel dashboard to download your CMMC compliance report (PDF) and DoD-format evidence receipt (.txt). Both are stored permanently in your account.
    </p>
    <a href="${appUrl}/dashboard" style="display: inline-block; background: #1a7a3a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold; margin: 16px 0;">View in Dashboard</a>
    <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8;">
      You can independently verify this anchor at any time using only public blockchain data — no Verafile account required. Instructions are included in your evidence receipt.
    </p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="font-size: 11px; color: #94a3b8; margin: 0;">Verafile Sentinel · ERC-8281 Observation Commitment Protocol · <a href="https://verafilecorporation.com" style="color: #1a3a6b;">verafilecorporation.com</a></p>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from,
      to: userEmail,
      subject: `Package sealed — ${organizationName} (block ${blockNumber?.toLocaleString()})`,
      html,
    });
    console.log(`[worker] Email sent to ${userEmail}`);
  } catch (err) {
    console.error("[worker] Resend failed:", err.message);
    // Non-fatal — proof is already on-chain and in Redis
  }
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

async function processJob(payload) {
  const { jobId, userId, organizationName, documentType, manifest, salt, rootHashHex, rootHash } = payload;
  const redis  = getRedis();
  const appUrl = process.env.APP_URL ?? "";

  console.log(`[worker] Processing job ${jobId}`);

  let anchorResult;
  try {
    anchorResult = await anchorWithRetry(payload, redis);
  } catch (err) {
    console.error(`[worker] [${jobId}] All retries exhausted: ${err.message}`);
    const jobRecord = await redis.get(jobKey(jobId));
    if (jobRecord) await redis.set(dlqKey(jobId), { ...jobRecord, status: "dead", errorDetail: err.message, diedAt: new Date().toISOString() }, { ex: JOB_TTL });
    await setJobField(redis, jobId, { status: "dead", errorDetail: err.message, retryCount: MAX_RETRIES });
    console.error(`[worker] [DEAD_LETTER] Job ${jobId} in DLQ — manual intervention required`);
    return;
  }

  const { txHash, blockNumber, blockTimestamp, proof } = anchorResult;

  // Store proof JSON and receipt to S3
  let proofKey   = null;
  let receiptKey = null;

  try {
    const safeOrg   = organizationName.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40);
    proofKey   = `receipts/${userId}/${jobId}/${safeOrg}-sentinel.proof.json`;
    receiptKey = `receipts/${userId}/${jobId}/${safeOrg}-sentinel-receipt.txt`;

    const receiptText = generateReceiptText({
      manifest, organization: organizationName, documentType,
      txHash, blockNumber, blockTimestamp, rootHash,
      chain: "base-mainnet", contract: OCP_CONTRACT,
    });

    await Promise.all([
      storeToS3(proofKey,   JSON.stringify(proof, null, 2), "application/json"),
      storeToS3(receiptKey, receiptText,                    "text/plain"),
    ]);
    console.log(`[worker] [${jobId}] Proof + receipt stored to S3`);
  } catch (err) {
    console.error(`[worker] [${jobId}] S3 storage failed (non-fatal): ${err.message}`);
    proofKey   = null;
    receiptKey = null;
  }

  // DB accounting via internal callback
  try {
    const res = await fetch(`${appUrl}/api/internal/record-anchor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": process.env.INTERNAL_SECRET ?? "" },
      body: JSON.stringify({ userId, txHash, blockNumber, rootHash, documentType, organizationName, fileCount: manifest.length, proofKey, receiptKey, jobId }),
    });
    if (!res.ok) console.error("[worker] record-anchor callback failed:", await res.text());
  } catch (err) {
    console.error("[worker] record-anchor fetch failed:", err.message);
  }

  // Fetch user info once for metering + email. Previously these lines
  // referenced `userInfo`/`userEmail` that were only declared inside
  // sendConfirmationEmail — out of scope here — which threw a ReferenceError
  // after a successful on-chain anchor and left the job stuck in "processing".
  const userInfo = await fetchUserInfo(appUrl, userId);

  // Stripe metered billing — report one anchor event
  await reportMeterEvent({
    stripeCustomerId: userInfo?.stripeCustomerId ?? null,
    jobId,
    blockTimestamp,
  });

  // Email confirmation
  await sendConfirmationEmail({ userInfo, userId, organizationName, documentType, txHash, blockNumber, blockTimestamp, appUrl });

  // Update Redis to confirmed with full proof
  await setJobField(redis, jobId, {
    status: "confirmed",
    txHash, blockNumber, blockTimestamp,
    committerAddress: anchorResult.committerAddress,
    proof,
    errorDetail: null,
  });

  console.log(`[worker] [${jobId}] Done — ${txHash}`);
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => body += c);
    req.on("end",  () => resolve(body));
    req.on("error", reject);
  });
}

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? "",
  nextSigningKey:    process.env.QSTASH_NEXT_SIGNING_KEY    ?? "",
});

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", ts: new Date().toISOString() }));
    return;
  }

  if (req.method === "POST" && req.url === "/work") {
    const rawBody = await readBody(req);
    try {
      await receiver.verify({ signature: req.headers["upstash-signature"] ?? "", body: rawBody });
    } catch {
      console.error("[worker] QStash signature verification failed");
      res.writeHead(401); res.end("Unauthorized");
      return;
    }

    // Ack immediately before processing
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ received: true }));

    let payload;
    try { payload = JSON.parse(rawBody); } catch { console.error("[worker] Bad JSON"); return; }
    processJob(payload).catch(err => console.error("[worker] Unhandled:", err));
    return;
  }

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`[worker] Sentinel worker on port ${PORT}`);
  console.log(`[worker] Contract: ${OCP_CONTRACT}`);
});

process.on("SIGTERM", () => { console.log("[worker] Shutting down"); server.close(() => process.exit(0)); });
