import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, sql } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

const VALID_PRICE_IDS = new Set([
  "price_1TheCmQg9XLktfgQXbG4D6Cf", // starter
  "price_1TheDGQg9XLktfgQYZjY3bEl", // professional
  "price_1TheG4Qg9XLktfgQZMy2bEKJ", // enterprise
]);

const BASE_URL = "https://verafilecorporation.com";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in required." },
      { status: 401 }
    );
  }

  let body: { priceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const priceId = body.priceId ?? "";
  if (!VALID_PRICE_IDS.has(priceId)) {
    return NextResponse.json(
      { error: "invalid_price", message: "Unknown plan." },
      { status: 400 }
    );
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json(
      { error: "user_not_found", message: "Account not found." },
      { status: 404 }
    );
  }

  try {
    // Reuse the Stripe customer if one exists so upgrades and the customer
    // portal stay attached to a single customer record.
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await sql`
        UPDATE users
        SET stripe_customer_id = ${customerId}, updated_at = NOW()
        WHERE id = ${user.id}
      `;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${BASE_URL}/dashboard?upgraded=true`,
      cancel_url: `${BASE_URL}/pricing`,
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Stripe checkout creation failed:", err);
    return NextResponse.json(
      { error: "checkout_failed", message: "Could not start checkout." },
      { status: 500 }
    );
  }
}
