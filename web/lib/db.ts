import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const sql = neon(process.env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Plan = "demo" | "starter" | "professional" | "enterprise";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  anchors_used_this_month: number;
  anchor_limit: number;
  billing_period_start: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnchorRow {
  id: string;
  user_id: string;
  tx_hash: string | null;
  block_number: number | null;
  root_hash: string | null;
  document_type: string | null;
  organization_name: string | null;
  file_count: number | null;
  created_at: string;
}

export const PLAN_LIMITS: Record<Plan, number> = {
  demo: 5, // lifetime cap, never resets
  starter: 50, // per month
  professional: 500, // per month
  enterprise: 10000, // per month
};

// ---------------------------------------------------------------------------
// User queries
// ---------------------------------------------------------------------------

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const rows = (await sql`
    SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1
  `) as UserRow[];
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = (await sql`
    SELECT * FROM users WHERE id = ${id} LIMIT 1
  `) as UserRow[];
  return rows[0] ?? null;
}

export async function createUser(params: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<UserRow> {
  const rows = (await sql`
    INSERT INTO users (email, password_hash, name, plan, anchor_limit, billing_period_start)
    VALUES (${params.email.toLowerCase().trim()}, ${params.passwordHash}, ${params.name}, 'demo', 5, NOW())
    RETURNING *
  `) as UserRow[];
  return rows[0];
}

// ---------------------------------------------------------------------------
// Anchor queries
// ---------------------------------------------------------------------------

export async function getRecentAnchors(
  userId: string,
  limit = 10
): Promise<AnchorRow[]> {
  const rows = (await sql`
    SELECT * FROM anchors
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as AnchorRow[];
  return rows;
}
