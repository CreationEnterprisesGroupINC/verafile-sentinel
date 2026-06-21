#!/usr/bin/env bash
# scripts/stripe-meter-setup.sh
#
# Run once per Stripe account (test + live separately).
# Prerequisites: Stripe CLI installed and authenticated (`stripe login`)
#
# After running, copy the output IDs into Vercel env vars:
#   STRIPE_METER_ID
#   STRIPE_PRICE_CONTRACTOR_METER
#   STRIPE_PRICE_ASSESSOR_METER
#
# Run against test mode first:
#   bash scripts/stripe-meter-setup.sh
#
# Run against live mode when ready:
#   bash scripts/stripe-meter-setup.sh --live

set -e

LIVE_FLAG=""
if [[ "$1" == "--live" ]]; then
  LIVE_FLAG="--live"
  echo "⚠️  Running in LIVE mode"
else
  echo "Running in TEST mode (pass --live for production)"
fi

echo ""
echo "=== Step 1: Create Billing Meter ==="
echo "Event name: sentinel_anchor"
echo "Aggregation: sum (one event = one anchor)"
echo ""

METER=$(stripe billing_meter create \
  --display-name="Sentinel Anchor" \
  --event-name="sentinel_anchor" \
  --default-aggregation[formula]="sum" \
  --customer-mapping[event-payload-key]="stripe_customer_id" \
  --customer-mapping[type]="by_id" \
  --value-settings[event-payload-key]="value" \
  $LIVE_FLAG \
  --json)

METER_ID=$(echo "$METER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "✓ Meter created: $METER_ID"
echo ""
echo "  → Set STRIPE_METER_ID=$METER_ID"
echo ""

echo "=== Step 2: Create Contractor metered overage price ==="
echo "Rate: \$2.00 per anchor (200 cents)"
echo ""

# Get or create the Contractor product
# NOTE: Replace 'prod_contractor_id' with your actual Contractor product ID
# from the Stripe dashboard after creating products in Step 7.
echo "Enter your Contractor product ID (prod_xxx from Stripe dashboard):"
read -r CONTRACTOR_PRODUCT_ID

CONTRACTOR_METER_PRICE=$(stripe prices create \
  --product="$CONTRACTOR_PRODUCT_ID" \
  --currency=usd \
  --unit-amount=200 \
  --recurring[usage_type]=metered \
  --recurring[interval]=month \
  --recurring[meter]="$METER_ID" \
  --nickname="Contractor Overage - \$2.00/anchor" \
  $LIVE_FLAG \
  --json)

CONTRACTOR_METER_PRICE_ID=$(echo "$CONTRACTOR_METER_PRICE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "✓ Contractor meter price: $CONTRACTOR_METER_PRICE_ID"
echo ""
echo "  → Set STRIPE_PRICE_CONTRACTOR_METER=$CONTRACTOR_METER_PRICE_ID"
echo ""

echo "=== Step 3: Create Assessor metered overage price ==="
echo "Rate: \$1.00 per anchor (100 cents)"
echo ""

echo "Enter your Assessor product ID (prod_xxx from Stripe dashboard):"
read -r ASSESSOR_PRODUCT_ID

ASSESSOR_METER_PRICE=$(stripe prices create \
  --product="$ASSESSOR_PRODUCT_ID" \
  --currency=usd \
  --unit-amount=100 \
  --recurring[usage_type]=metered \
  --recurring[interval]=month \
  --recurring[meter]="$METER_ID" \
  --nickname="Assessor Overage - \$1.00/anchor" \
  $LIVE_FLAG \
  --json)

ASSESSOR_METER_PRICE_ID=$(echo "$ASSESSOR_METER_PRICE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "✓ Assessor meter price: $ASSESSOR_METER_PRICE_ID"
echo ""
echo "  → Set STRIPE_PRICE_ASSESSOR_METER=$ASSESSOR_METER_PRICE_ID"
echo ""

echo "========================================"
echo "All done. Add to Vercel environment variables:"
echo ""
echo "  STRIPE_METER_ID=$METER_ID"
echo "  STRIPE_PRICE_CONTRACTOR_METER=$CONTRACTOR_METER_PRICE_ID"
echo "  STRIPE_PRICE_ASSESSOR_METER=$ASSESSOR_METER_PRICE_ID"
echo ""
echo "Also add to Railway worker:"
echo ""
echo "  STRIPE_SECRET_KEY=<same as Vercel>"
echo "  STRIPE_METER_ID=$METER_ID"
echo "========================================"
