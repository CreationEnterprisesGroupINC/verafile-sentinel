// app/api/webhooks/stripe/route.ts
//
// Stripe webhook handler. Signature-verified on every request.
// Updates user plan, anchor limits, and subscription status in DB.
//
// Handled events:
//   checkout.session.completed       → activate plan
//   customer.subscription.updated    → plan change / renewal
//   customer.subscription.deleted    → cancellation → revert to demo
//   invoice.payment_succeeded        → reset monthly usage counter
//   invoice.payment_failed           → mark past_due, email user (TODO: email)

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql, getUserById } from "@/lib/db";
import { getPlanByPriceId } from "@/lib/plans";
import { sendPaymentFailedEmail } from "@/lib/email";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // Raw body required for signature verification
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── New subscription created via Checkout ─────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId  = session.metadata?.userId;
        if (!userId) { console.error("checkout.session.completed: missing userId metadata"); break; }

        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription : session.subscription?.id ?? null;
        const customerId = typeof session.customer === "string"
          ? session.customer : session.customer?.id ?? null;

        let planId      = "contractor";
        let anchorLimit = 10;

        if (subscriptionId) {
          const sub    = await stripe.subscriptions.retrieve(subscriptionId);
          const mapping = getPlanByPriceId(sub.items.data[0]?.price?.id ?? "");
          if (mapping) { planId = mapping.planId; anchorLimit = mapping.anchorLimit; }
          else console.error("checkout.session.completed: unknown priceId", sub.items.data[0]?.price?.id);
        }

        await sql`
          UPDATE users
          SET plan                    = ${planId},
              anchor_limit            = ${anchorLimit},
              stripe_customer_id      = COALESCE(${customerId}, stripe_customer_id),
              stripe_subscription_id  = ${subscriptionId},
              subscription_status     = 'active',
              anchors_used_this_month = 0,
              billing_period_start    = NOW(),
              updated_at              = NOW()
          WHERE id = ${userId}
        `;
        console.log(`[webhook] checkout.session.completed → user ${userId} → ${planId}`);
        break;
      }

      // ── Subscription changed (upgrade, downgrade, renewal) ────────────────
      case "customer.subscription.updated": {
        const sub     = event.data.object as Stripe.Subscription;
        const mapping = getPlanByPriceId(sub.items.data[0]?.price?.id ?? "");

        if (mapping) {
          await sql`
            UPDATE users
            SET subscription_status = ${sub.status},
                plan                = ${mapping.planId},
                anchor_limit        = ${mapping.anchorLimit},
                updated_at          = NOW()
            WHERE stripe_subscription_id = ${sub.id}
          `;
        } else {
          await sql`
            UPDATE users
            SET subscription_status = ${sub.status}, updated_at = NOW()
            WHERE stripe_subscription_id = ${sub.id}
          `;
        }
        console.log(`[webhook] subscription.updated → ${sub.id} → ${sub.status}`);
        break;
      }

      // ── Subscription cancelled ────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await sql`
          UPDATE users
          SET plan                   = 'demo',
              anchor_limit           = 5,
              subscription_status    = 'inactive',
              stripe_subscription_id = NULL,
              updated_at             = NOW()
          WHERE stripe_subscription_id = ${sub.id}
        `;
        console.log(`[webhook] subscription.deleted → ${sub.id}`);
        break;
      }

      // ── Successful payment / billing cycle renewal ────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only reset usage on renewal invoices (billing_reason = subscription_cycle)
        // Not on the initial invoice (billing_reason = subscription_create) —
        // that's handled by checkout.session.completed above.
        if (invoice.billing_reason === "subscription_cycle") {
          const subId = typeof invoice.subscription === "string"
            ? invoice.subscription : invoice.subscription?.id ?? null;
          if (subId) {
            await sql`
              UPDATE users
              SET anchors_used_this_month = 0,
                  billing_period_start    = NOW(),
                  subscription_status     = 'active',
                  updated_at              = NOW()
              WHERE stripe_subscription_id = ${subId}
            `;
            console.log(`[webhook] invoice.payment_succeeded (cycle) → reset usage for ${subId}`);
          }
        }
        break;
      }

      // ── Failed payment ────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId   = typeof invoice.subscription === "string"
          ? invoice.subscription : invoice.subscription?.id ?? null;
        if (subId) {
          await sql`
            UPDATE users
            SET subscription_status = 'past_due', updated_at = NOW()
            WHERE stripe_subscription_id = ${subId}
          `;
          console.log(`[webhook] invoice.payment_failed → past_due for ${subId}`);
          // Notify user via email
          try {
            const rows = (await sql`SELECT id FROM users WHERE stripe_subscription_id = ${subId} LIMIT 1`) as {id:string}[];
            if (rows[0]) {
              const u = await getUserById(rows[0].id);
              if (u) sendPaymentFailedEmail({ to: u.email, name: u.name ?? "there" }).catch(console.error);
            }
          } catch (e) { console.error("[webhook] payment failed email error:", e); }
        }
        break;
      }

      default:
        // Acknowledge unhandled events so Stripe stops retrying
        break;
    }
  } catch (err) {
    console.error(`[webhook] Handler failed for ${event.type}:`, err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
