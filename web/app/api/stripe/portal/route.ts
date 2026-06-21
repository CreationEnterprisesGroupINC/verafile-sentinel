// app/api/stripe/portal/route.ts
//
// Creates a Stripe Customer Portal session so subscribers can manage
// their subscription (upgrade, downgrade, cancel, update payment method).
// POST → { url: string }

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://verafilecorporation.com";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.user.id);
  if (!user?.stripe_customer_id) {
    return NextResponse.json(
      { error: "no_subscription", message: "No active subscription found." },
      { status: 404 }
    );
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   user.stripe_customer_id,
      return_url: `${BASE_URL}/dashboard`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Billing portal creation failed:", err);
    return NextResponse.json({ error: "portal_failed" }, { status: 500 });
  }
}
