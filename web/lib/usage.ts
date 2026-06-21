import { sql, getUserById, type UserRow } from "@/lib/db";

export type GateDenyReason =
  | "user_not_found"
  | "not_approved"       // demo account pending manual approval
  | "subscription_lapsed" // paid plan cancelled or payment failed
  | "limit_reached";     // monthly/lifetime anchor cap hit

export interface UsageGate {
  allowed: boolean;
  user: UserRow | null;
  remaining: number;
  denyReason?: GateDenyReason;
}

/**
 * If the user is on a paid plan and a new calendar month has started since
 * billing_period_start, reset the monthly counter. Demo accounts have a
 * lifetime cap and are never reset.
 *
 * Returns the (possibly updated) user row.
 */
export async function checkAndResetMonthlyUsage(
  user: UserRow
): Promise<UserRow> {
  if (user.plan === "demo") return user;

  const now = new Date();
  const periodStart = user.billing_period_start
    ? new Date(user.billing_period_start)
    : null;

  const isNewMonth =
    !periodStart ||
    periodStart.getUTCFullYear() !== now.getUTCFullYear() ||
    periodStart.getUTCMonth() !== now.getUTCMonth();

  if (!isNewMonth) return user;

  const rows = (await sql`
    UPDATE users
    SET anchors_used_this_month = 0,
        billing_period_start = NOW(),
        updated_at = NOW()
    WHERE id = ${user.id}
    RETURNING *
  `) as UserRow[];

  return rows[0] ?? user;
}

/**
 * Server-side gate for the commit API.
 *
 * Checks in order:
 *   1. User exists
 *   2. Demo users: approved flag must be set (manual vetting)
 *   3. Paid users: subscription_status must be active (not past_due/inactive)
 *   4. Under monthly/lifetime anchor limit
 *
 * Demo limits are lifetime. Paid limits are per calendar month with
 * auto-reset on billing cycle (see checkAndResetMonthlyUsage).
 */
export async function enforceAnchorLimit(userId: string): Promise<UsageGate> {
  let user = await getUserById(userId);
  if (!user) return { allowed: false, user: null, remaining: 0, denyReason: "user_not_found" };

  // Gate 1: demo approval
  if (user.plan === "demo" && !user.approved) {
    return { allowed: false, user, remaining: 0, denyReason: "not_approved" };
  }

  // Gate 2: subscription active for paid plans
  const isPaid = user.plan !== "demo";
  if (isPaid && user.subscription_status !== "active") {
    return { allowed: false, user, remaining: 0, denyReason: "subscription_lapsed" };
  }

  // Gate 3: monthly reset + limit check
  user = await checkAndResetMonthlyUsage(user);
  const remaining = Math.max(0, user.anchor_limit - user.anchors_used_this_month);
  if (remaining === 0) {
    return { allowed: false, user, remaining: 0, denyReason: "limit_reached" };
  }

  return { allowed: true, user, remaining };
}

/**
 * Records a successful anchor: increments the user's counter (guarded
 * against concurrent requests slipping past the limit) and inserts the
 * anchor history row.
 *
 * Returns false if the guarded increment failed (limit was hit between the
 * gate check and the write), in which case the caller already anchored
 * on-chain — log it, but treat the account as at-limit going forward.
 */
export async function recordAnchor(params: {
  userId: string;
  txHash: string | null;
  blockNumber: number | null;
  rootHash: string | null;
  documentType: string | null;
  organizationName: string | null;
  fileCount: number | null;
  proofKey?: string | null;
  receiptKey?: string | null;
  jobId?: string | null;
}): Promise<boolean> {
  // Guarded increment: only succeeds while under the limit, which closes
  // the race window between enforceAnchorLimit and this write.
  const updated = (await sql`
    UPDATE users
    SET anchors_used_this_month = anchors_used_this_month + 1,
        updated_at = NOW()
    WHERE id = ${params.userId}
      AND anchors_used_this_month < anchor_limit
    RETURNING id
  `) as { id: string }[];

  await sql`
    INSERT INTO anchors (
      user_id, tx_hash, block_number, root_hash,
      document_type, organization_name, file_count,
      proof_key, receipt_key, job_id
    ) VALUES (
      ${params.userId}, ${params.txHash}, ${params.blockNumber}, ${params.rootHash},
      ${params.documentType}, ${params.organizationName}, ${params.fileCount},
      ${params.proofKey ?? null}, ${params.receiptKey ?? null}, ${params.jobId ?? null}
    )
  `;

  return updated.length > 0;
}
