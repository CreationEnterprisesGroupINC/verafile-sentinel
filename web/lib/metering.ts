// lib/metering.ts
//
// Reports anchor usage events to Stripe Billing Meters.
//
// Architecture:
//   - One Stripe Meter per plan tier (contractor, assessor), created once
//     in Stripe dashboard or via CLI (see setup instructions below)
//   - Each confirmed anchor fires reportMeterEvent() with the Stripe
//     customer ID — Stripe aggregates and adds overage to the next invoice
//   - The base plan includes the monthly allowance; meter events only
//     generate charges above the included quantity
//
// Stripe Meter setup (run once per environment):
//
//   stripe billing_meter create \
//     --display-name="Sentinel Anchor" \
//     --event-name="sentinel_anchor" \
//     --default-aggregation[formula]="sum" \
//     --customer-mapping[event-payload-key]="stripe_customer_id" \
//     --customer-mapping[type]="by_id" \
//     --value-settings[event-payload-key]="value"
//
//   Copy the meter ID (e.g. "mtr_xxx") to env var STRIPE_METER_ID
//
// Metered Price setup (run once per plan per environment):
//   - Create a recurring price with usage_type=metered on each product
//   - Set the unit_amount to the overage rate (e.g. 200 for $2.00)
//   - Add this price to the subscription at checkout alongside the base price
//   - Set env vars STRIPE_PRICE_CONTRACTOR_METER / STRIPE_PRICE_ASSESSOR_METER
//
// Environment variables:
//   STRIPE_SECRET_KEY
//   STRIPE_METER_ID              Stripe meter ID (mtr_xxx)

import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  _stripe = new Stripe(key, { apiVersion: "2023-10-16" });
  return _stripe;
}

export interface MeterEventParams {
  stripeCustomerId: string;
  // Idempotency key — use jobId to prevent double-reporting on worker retry
  idempotencyKey: string;
  // Timestamp of the anchor (block timestamp preferred; falls back to now)
  timestamp?: number;
}

/**
 * Report one anchor event to Stripe Billing Meters.
 * Called by the worker after on-chain confirmation.
 * Non-fatal — a metering failure does not fail the anchor.
 *
 * Stripe deduplicates on identifier within a 24-hour window.
 */
export async function reportAnchorEvent(params: MeterEventParams): Promise<void> {
  const meterId = process.env.STRIPE_METER_ID;
  if (!meterId) {
    console.warn("[metering] STRIPE_METER_ID not set — skipping meter event");
    return;
  }

  const stripe = getStripe();

  try {
    await stripe.billing.meterEvents.create({
      event_name: "sentinel_anchor",
      payload: {
        stripe_customer_id: params.stripeCustomerId,
        value: "1",
      },
      identifier: params.idempotencyKey,
      timestamp: params.timestamp ?? Math.floor(Date.now() / 1000),
    });
    console.log(`[metering] Anchor event reported for customer ${params.stripeCustomerId}`);
  } catch (err: any) {
    // Log but don't throw — metering failure must never fail an anchor
    console.error(`[metering] Failed to report meter event: ${err.message}`);
  }
}

/**
 * Look up the Stripe customer ID for a user.
 * Used by the worker (which doesn't have direct DB access) via the
 * internal /api/internal/user-email endpoint which also returns stripe_customer_id.
 */
export function isMeterableCustomer(stripeCustomerId: string | null | undefined): boolean {
  return typeof stripeCustomerId === "string" && stripeCustomerId.startsWith("cus_");
}
