// lib/plans.ts
//
// Single source of truth for Verafile Sentinel v1.0 plans.
// Pricing matches the shipping plan spec exactly:
//   Contractor: $299/mo | $2,872/yr (save ~20%)
//   Assessor:  $1,500/mo | $14,400/yr (save 20%)
//
// Price IDs reference Stripe products — set STRIPE_PRICE_* env vars
// rather than hardcoding so these work across test/live Stripe accounts.
//
// Environment variables required:
//   STRIPE_PRICE_CONTRACTOR_MONTHLY
//   STRIPE_PRICE_CONTRACTOR_ANNUAL
//   STRIPE_PRICE_ASSESSOR_MONTHLY
//   STRIPE_PRICE_ASSESSOR_ANNUAL

export type BillingInterval = "monthly" | "annual";

export interface PlanVariant {
  priceId: string;         // Stripe Price ID — from env var at runtime
  interval: BillingInterval;
  displayPrice: string;    // e.g. "$299"
  intervalLabel: string;   // e.g. "/month"
  savingsLabel?: string;   // e.g. "Save 20%"
  anchorLimit: number;
  overageCents: number;    // cents per anchor over limit
}

export interface PlanDef {
  id: "contractor" | "assessor";
  name: string;
  tagline: string;
  highlighted: boolean;
  features: string[];
  monthly: Omit<PlanVariant, "priceId">;
  annual: Omit<PlanVariant, "priceId">;
  monthlyPriceEnvKey: string;
  annualPriceEnvKey: string;
}

export const PLANS: PlanDef[] = [
  {
    id: "contractor",
    name: "Contractor",
    tagline: "DIB contractors building an evidence history ahead of assessment.",
    highlighted: false,
    features: [
      "10 sealed packages per month",
      "Base Mainnet anchoring via ERC-8281",
      "CMMC Level 2 compliance report (PDF) with every anchor",
      "DoD-format evidence receipt (.txt) with every anchor",
      "Proof JSON for independent verification",
      "$2.00 per package over 10",
      "Email support",
    ],
    monthly: {
      interval: "monthly",
      displayPrice: "$299",
      intervalLabel: "/month",
      anchorLimit: 10,
      overageCents: 200,
    },
    annual: {
      interval: "annual",
      displayPrice: "$2,872",
      intervalLabel: "/year",
      savingsLabel: "Save ~20%",
      anchorLimit: 10,
      overageCents: 200,
    },
    monthlyPriceEnvKey: "STRIPE_PRICE_CONTRACTOR_MONTHLY",
    annualPriceEnvKey:  "STRIPE_PRICE_CONTRACTOR_ANNUAL",
  },
  {
    id: "assessor",
    name: "Assessor",
    tagline: "C3PAO assessors managing evidence across multiple contractors.",
    highlighted: true,
    features: [
      "100 sealed packages per month",
      "Base Mainnet anchoring via ERC-8281",
      "CMMC Level 2 compliance report (PDF) with every anchor",
      "DoD-format evidence receipt (.txt) with every anchor",
      "Proof JSON for independent verification",
      "$1.00 per package over 100",
      "Priority support",
      "1 hour/month assessment preparation consultation",
    ],
    monthly: {
      interval: "monthly",
      displayPrice: "$1,500",
      intervalLabel: "/month",
      anchorLimit: 100,
      overageCents: 100,
    },
    annual: {
      interval: "annual",
      displayPrice: "$14,400",
      intervalLabel: "/year",
      savingsLabel: "Save 20%",
      anchorLimit: 100,
      overageCents: 100,
    },
    monthlyPriceEnvKey: "STRIPE_PRICE_ASSESSOR_MONTHLY",
    annualPriceEnvKey:  "STRIPE_PRICE_ASSESSOR_ANNUAL",
  },
];

// Map a Stripe Price ID to plan + anchor limit.
// Called by the webhook handler to update DB on subscription events.
// Reads from env vars at call time — no module-level caching.
export function getPlanByPriceId(priceId: string): { planId: string; anchorLimit: number; overageCents: number } | null {
  for (const plan of PLANS) {
    const monthlyId = process.env[plan.monthlyPriceEnvKey];
    const annualId  = process.env[plan.annualPriceEnvKey];
    if (priceId === monthlyId || priceId === annualId) {
      return {
        planId: plan.id,
        anchorLimit: plan.monthly.anchorLimit,
        overageCents: plan.monthly.overageCents,
      };
    }
  }
  return null;
}

// All valid price IDs — used for allowlist validation in checkout route.
export function getAllPriceIds(): Set<string> {
  const ids = new Set<string>();
  for (const plan of PLANS) {
    const m = process.env[plan.monthlyPriceEnvKey];
    const a = process.env[plan.annualPriceEnvKey];
    if (m) ids.add(m);
    if (a) ids.add(a);
  }
  return ids;
}
