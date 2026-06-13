import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

const PRICE_TO_PLAN: Record<string, { plan: string; anchorLimit: number }> = {
  price_1TheCmQg9XLktfgQXbG4D6Cf: { plan: "starter", anchorLimit: 50 },
  price_1TheDGQg9XLktfgQYZjY3bEl: { plan: "professional", anchorLimit: 500 },
  price_1TheG4Qg9XLktfgQZMy2bEKJ: { plan: "enterprise", anchorLimit: 10000 },
};

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // Signature verification requires the raw request body.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) {
          console.error("checkout.session.completed missing userId metadata");
          break;
        }

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;

        // Resolve the purchased price from the subscription.
        let plan = "starter";
        let anchorLimit = 50;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId
          );
          const priceId = subscription.items.data[0]?.price?.id;
          const mapping = priceId ? PRICE_TO_PLAN[priceId] : undefined;
          if (mapping) {
            plan = mapping.plan;
            anchorLimit = mapping.anchorLimit;
          } else {
            console.error("Unknown price on subscription:", priceId);
          }
        }

        await sql`
          UPDATE users
          SET plan = ${plan},
              anchor_limit = ${anchorLimit},
              stripe_customer_id = COALESCE(${customerId}, stripe_customer_id),
              stripe_subscription_id = ${subscriptionId},
              subscription_status = 'active',
              anchors_used_this_month = 0,
              billing_period_start = NOW(),
              updated_at = NOW()
          WHERE id = ${userId}
        `;
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price?.id;
        const mapping = priceId ? PRICE_TO_PLAN[priceId] : undefined;

        if (mapping) {
          await sql`
            UPDATE users
            SET subscription_status = ${subscription.status},
                plan = ${mapping.plan},
                anchor_limit = ${mapping.anchorLimit},
                updated_at = NOW()
            WHERE stripe_subscription_id = ${subscription.id}
          `;
        } else {
          await sql`
            UPDATE users
            SET subscription_status = ${subscription.status},
                updated_at = NOW()
            WHERE stripe_subscription_id = ${subscription.id}
          `;
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await sql`
          UPDATE users
          SET plan = 'demo',
              anchor_limit = 5,
              subscription_status = 'inactive',
              stripe_subscription_id = NULL,
              updated_at = NOW()
          WHERE stripe_subscription_id = ${subscription.id}
        `;
        break;
      }

      default:
        // Acknowledge unhandled event types so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error(`Webhook handler failed for ${event.type}:`, err);
    // Return 500 so Stripe retries the event.
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
