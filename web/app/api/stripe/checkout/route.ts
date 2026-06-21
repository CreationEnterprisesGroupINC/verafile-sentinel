// app/api/stripe/checkout/route.ts
//
// Creates a Stripe Checkout session.
// Attaches two prices per subscription:
//   1. Base recurring price (monthly or annual flat fee)
//   2. Metered overage price (usage_type=metered, billed per anchor over limit)
//
// POST body: { priceId: string }
// Returns:   { url: string }

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, sql } from "@/lib/db";
import { getAllPriceIds, PLANS } from "@/lib/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://verafilecorporation.com";

// Find the metered overage price ID for a given base price ID
function getMeterPriceId(basePriceId: string): string | null {
  for (const plan of PLANS) {
    const monthly = process.env[plan.monthlyPriceEnvKey];
    const annual  = process.env[plan.annualPriceEnvKey];
    if (basePriceId === monthly || basePriceId === annual) {
      return process.env[plan.meterPriceEnvKey] ?? null;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
  }

  let body: { priceId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const priceId  = body.priceId ?? "";
  const validIds = getAllPriceIds();
  if (!validIds.has(priceId)) {
    return NextResponse.json({ error: "invalid_price", message: "Unknown plan." }, { status: 400 });
  }

  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  if (user.subscription_status === "active" && user.plan !== "demo") {
    return NextResponse.json(
      { error: "already_subscribed", message: "Active subscription exists. Use the billing portal to change plans." },
      { status: 409 }
    );
  }

  try {
    // Reuse Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  user.name ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await sql`
        UPDATE users SET stripe_customer_id = ${customerId}, updated_at = NOW()
        WHERE id = ${user.id}
      `;
    }

    // Build line items: base price + metered overage price (if configured)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId, quantity: 1 },
    ];

    const meterPriceId = getMeterPriceId(priceId);
    if (meterPriceId) {
      // Metered price has no quantity — Stripe drives quantity from meter events
      lineItems.push({ price: meterPriceId });
    } else {
      console.warn(`[checkout] No meter price found for ${priceId} — overage billing disabled`);
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode:       "subscription",
      customer:   customerId,
      line_items: lineItems,
      success_url: `${BASE_URL}/dashboard?upgraded=1`,
      cancel_url:  `${BASE_URL}/pricing`,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      allow_promotion_codes:      true,
      billing_address_collection: "auto",
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Stripe checkout creation failed:", err);
    return NextResponse.json({ error: "checkout_failed", message: "Could not start checkout." }, { status: 500 });
  }
}
