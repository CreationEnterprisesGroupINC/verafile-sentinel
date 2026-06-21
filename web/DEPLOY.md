# Verafile Sentinel — Production Deployment Checklist
# Generated: 2026-06-21
# Steps 1-16 complete. Run this checklist before first paying customer.

## 1. DATABASE MIGRATIONS (Neon — run once)

```sql
-- Run in Neon SQL editor or via psql

-- Step 6: S3 artifact keys
ALTER TABLE anchors ADD COLUMN IF NOT EXISTS proof_key   text;
ALTER TABLE anchors ADD COLUMN IF NOT EXISTS receipt_key text;

-- Step 10: demo approval flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
-- Approve all existing paid users immediately
UPDATE users SET approved = true WHERE plan != 'demo';

-- Step 11: job tracking
ALTER TABLE anchors ADD COLUMN IF NOT EXISTS job_id text;

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name IN ('users', 'anchors')
ORDER BY table_name, ordinal_position;
```

---

## 2. STRIPE SETUP (dashboard + CLI)

### 2a. Create products in Stripe Dashboard
- Contractor (prod_xxx) — $299/mo base plan
- Assessor (prod_xxx)   — $1,500/mo base plan

### 2b. Create flat-fee prices
```bash
# Monthly
stripe prices create --product=prod_CONTRACTOR --currency=usd --unit-amount=29900 \
  --recurring[interval]=month --nickname="Contractor Monthly"

stripe prices create --product=prod_ASSESSOR --currency=usd --unit-amount=150000 \
  --recurring[interval]=month --nickname="Assessor Monthly"

# Annual (billed as one charge)
stripe prices create --product=prod_CONTRACTOR --currency=usd --unit-amount=287200 \
  --recurring[interval]=year --nickname="Contractor Annual"

stripe prices create --product=prod_ASSESSOR --currency=usd --unit-amount=1440000 \
  --recurring[interval]=year --nickname="Assessor Annual"
```

### 2c. Create Billing Meter + metered prices
```bash
bash web/scripts/stripe-meter-setup.sh --live
```

### 2d. Configure Customer Portal
- Dashboard → Billing → Customer portal → Enable
- Allow customers to: update payment method, cancel, switch plans

### 2e. Set webhook endpoint
- Dashboard → Developers → Webhooks → Add endpoint
- URL: https://verafilecorporation.com/api/webhooks/stripe
- Events: checkout.session.completed, customer.subscription.updated,
           customer.subscription.deleted, invoice.payment_succeeded,
           invoice.payment_failed

---

## 3. CLOUDFLARE R2 SETUP (recommended over AWS S3 — no egress fees)

```bash
# In Cloudflare dashboard:
# 1. R2 → Create bucket: sentinel-artifacts
# 2. Manage API tokens → Create token (Object Read/Write on sentinel-artifacts)
# 3. Copy account ID from R2 overview page

# Set CORS on bucket (for presigned PUT from browser):
# Dashboard → sentinel-artifacts → Settings → CORS policy:
[
  {
    "AllowedOrigins": ["https://verafilecorporation.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 4. VERCEL ENVIRONMENT VARIABLES

Set all of these in Vercel Dashboard → Project → Settings → Environment Variables.
Mark sensitive ones as "Sensitive" (encrypted, not shown after save).

### Core
```
DATABASE_URL                      # Neon connection string
NEXTAUTH_SECRET                   # openssl rand -base64 32
NEXTAUTH_URL                      # https://verafilecorporation.com
NEXT_PUBLIC_APP_URL               # https://verafilecorporation.com
```

### S3 / R2
```
S3_BUCKET                         # sentinel-artifacts
S3_REGION                         # auto  (R2) or us-east-1 (AWS)
S3_ENDPOINT                       # https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
```

### Stripe
```
STRIPE_SECRET_KEY                 # sk_live_xxx
STRIPE_WEBHOOK_SECRET             # whsec_xxx (from webhook endpoint page)
STRIPE_METER_ID                   # mtr_xxx (from stripe-meter-setup.sh)
STRIPE_PRICE_CONTRACTOR_MONTHLY   # price_xxx
STRIPE_PRICE_CONTRACTOR_ANNUAL    # price_xxx
STRIPE_PRICE_ASSESSOR_MONTHLY     # price_xxx
STRIPE_PRICE_ASSESSOR_ANNUAL      # price_xxx
STRIPE_PRICE_CONTRACTOR_METER     # price_xxx (metered)
STRIPE_PRICE_ASSESSOR_METER       # price_xxx (metered)
```

### Queue / Worker
```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
QSTASH_TOKEN                      # from Upstash QStash dashboard
WORKER_URL                        # https://sentinel-worker.railway.app
INTERNAL_SECRET                   # openssl rand -base64 32 (same as Railway)
```

### Email
```
RESEND_API_KEY
RESEND_FROM                       # Verafile Sentinel <no-reply@verafilecorporation.com>
ADMIN_EMAIL                       # damon@ocp-labs.org
```

### Admin
```
ADMIN_SECRET                      # openssl rand -base64 32
```

---

## 5. RAILWAY WORKER ENVIRONMENT VARIABLES

```
SENTINEL_PRIVATE_KEY              # signing wallet private key (0x5e4F... wallet)
SENTINEL_RPC_URL                  # Base Mainnet RPC (Alchemy/Infura)
UPSTASH_REDIS_REST_URL            # same as Vercel
UPSTASH_REDIS_REST_TOKEN          # same as Vercel
QSTASH_CURRENT_SIGNING_KEY        # from Upstash QStash dashboard
QSTASH_NEXT_SIGNING_KEY           # from Upstash QStash dashboard
S3_BUCKET                         # same as Vercel
S3_REGION                         # same as Vercel
S3_ENDPOINT                       # same as Vercel
S3_ACCESS_KEY_ID                  # same as Vercel
S3_SECRET_ACCESS_KEY              # same as Vercel
STRIPE_SECRET_KEY                 # same as Vercel
STRIPE_METER_ID                   # same as Vercel
RESEND_API_KEY                    # same as Vercel
RESEND_FROM                       # same as Vercel
APP_URL                           # https://verafilecorporation.com
INTERNAL_SECRET                   # same as Vercel
PORT                              # set automatically by Railway
```

### Railway config
- Replicas: **1** (CRITICAL — nonce safety requires single process)
- Health check: GET /health → 200
- Restart policy: always
- Root directory: worker/

---

## 6. RESEND SETUP

1. Add domain: verafilecorporation.com → DNS records (SPF, DKIM, DMARC)
2. Verify domain (takes ~10 min)
3. Create API key → paste into RESEND_API_KEY

---

## 7. UPSTASH SETUP

1. Create Redis database → copy REST URL + token
2. Create QStash → copy QSTASH_TOKEN
3. QStash signing keys: Dashboard → QStash → Request signing → copy both keys

---

## 8. PRE-LAUNCH SMOKE TEST

Run after all env vars are set and Railway worker is deployed:

```bash
# 1. Register a test demo account
curl -X POST https://verafilecorporation.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","organization":"Test Co","email":"test@example.com","password":"testpass123"}'

# 2. Approve the demo account
curl -X POST https://verafilecorporation.com/api/admin/approve \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 3. Sign in via browser and seal one package
# → Check basescan for the transaction
# → Check S3 for proof JSON and receipt
# → Check confirmation email in inbox

# 4. Verify the receipt format
npx tsx web/scripts/test-receipt-format.ts

# 5. Test Stripe checkout with test card 4242 4242 4242 4242
# → Confirm webhook fires, plan updates in DB
# → Check /admin dashboard shows paid user

# 6. Test payment failed webhook
stripe trigger invoice.payment_failed

# 7. Worker health check
curl https://sentinel-worker.railway.app/health
```

---

## 9. PUSH TO GITHUB

```bash
cd /path/to/verafile-sentinel

# Install new deps
cd web && npm install && cd ..
cd worker && npm install && cd ..

# Review all changes
git diff --stat

# Commit
git add -A
git commit -m "feat: steps 1-16 — S3 upload, worker queue, metered billing, security headers, admin"

# Push — Vercel deploys automatically on push to main
git push origin main

# Deploy worker to Railway
# Railway → Project → Deploy → Connect to GitHub → worker/ directory
```

---

## 10. POST-LAUNCH (first week)

- [ ] Confirm Travis Goldbach gets a demo account + personal approval email
- [ ] Confirm Dana Booker gets a demo account + personal approval email
- [ ] Monitor Railway logs for any DEAD_LETTER entries
- [ ] Monitor Upstash QStash for failed deliveries
- [ ] Check Resend dashboard for email delivery rates
- [ ] Verify first real Stripe subscription end-to-end
- [ ] Run `stripe-meter-setup.sh --live` once first subscriber exists

---

## TOTAL ENV VARS: 31 (Vercel) + 15 (Railway)
## TOTAL NEW FILES THIS SESSION: 42
## STEPS COMPLETE: 1-16 ✓
