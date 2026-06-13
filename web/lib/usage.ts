import { sql, getUserById, type UserRow } from "@/lib/db";

export interface UsageGate {
  allowed: boolean;
  user: UserRow | null;
  remaining: number;
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
 * Server-side gate for the commit API. Loads the user, applies the monthly
 * reset if due, and checks usage against the plan limit. Demo limits are
 * lifetime; paid limits are per calendar month.
 */
export async function enforceAnchorLimit(userId: string): Promise<UsageGate> {
  let user = await getUserById(userId);
  if (!user) return { allowed: false, user: null, remaining: 0 };

  user = await checkAndResetMonthlyUsage(user);

  const remaining = Math.max(0, user.anchor_limit - user.anchors_used_this_month);
  return { allowed: remaining > 0, user, remaining };
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
      document_type, organization_name, file_count
    ) VALUES (
      ${params.userId}, ${params.txHash}, ${params.blockNumber}, ${params.rootHash},
      ${params.documentType}, ${params.organizationName}, ${params.fileCount}
    )
  `;

  return updated.length > 0;
}
