/**
 * Database migration for Verafile Sentinel SaaS layer.
 * Run once: npx tsx scripts/migrate.ts
 * Requires DATABASE_URL in the environment (pull with `vercel env pull .env.local`).
 */
import { neon } from "@neondatabase/serverless";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Run `vercel env pull .env.local` first, then `npx tsx --env-file=.env.local scripts/migrate.ts`.");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log("Creating users table...");
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      plan VARCHAR(50) DEFAULT 'demo',
      stripe_customer_id VARCHAR(255),
      stripe_subscription_id VARCHAR(255),
      subscription_status VARCHAR(50) DEFAULT 'inactive',
      anchors_used_this_month INTEGER DEFAULT 0,
      anchor_limit INTEGER DEFAULT 5,
      billing_period_start TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log("Creating anchors table...");
  await sql`
    CREATE TABLE IF NOT EXISTS anchors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      tx_hash VARCHAR(255),
      block_number INTEGER,
      root_hash VARCHAR(255),
      document_type VARCHAR(100),
      organization_name VARCHAR(255),
      file_count INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log("Creating indexes...");
  await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users (stripe_customer_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_anchors_user_created ON anchors (user_id, created_at DESC)`;

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
