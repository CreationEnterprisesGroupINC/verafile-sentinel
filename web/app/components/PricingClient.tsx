// app/components/PricingClient.tsx
// Annual/monthly billing toggle + plan cards + checkout.

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanDef } from "@/lib/plans";

interface PriceIds {
  contractor_monthly: string;
  contractor_annual: string;
  assessor_monthly: string;
  assessor_annual: string;
}

interface Props {
  plans: PlanDef[];
  priceIds: PriceIds;
  currentPlan: string | null;
  isSignedIn: boolean;
}

function getPriceId(plan: PlanDef, interval: "monthly" | "annual", priceIds: PriceIds): string {
  const key = `${plan.id}_${interval}` as keyof PriceIds;
  return priceIds[key] ?? "";
}

export default function PricingClient({ plans, priceIds, currentPlan, isSignedIn }: Props) {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCheckout = async (priceId: string) => {
    if (!priceId) { setError("This plan is not yet available. Contact us at damon@ocp-labs.org."); return; }
    if (!isSignedIn) { router.push("/register"); return; }
    setError(null);
    setLoadingPriceId(priceId);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.message || "Could not start checkout. Try again.");
        setLoadingPriceId(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout. Try again.");
      setLoadingPriceId(null);
    }
  };

  return (
    <div className="mt-10">
      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          onClick={() => setInterval("monthly")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            interval === "monthly"
              ? "bg-[#1A3A6B] text-white"
              : "text-[#6B7280] hover:text-white"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("annual")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
            interval === "annual"
              ? "bg-[#1A3A6B] text-white"
              : "text-[#6B7280] hover:text-white"
          }`}
        >
          Annual
          <span className="text-xs bg-[#1A7A3A] text-white px-2 py-0.5 rounded-full">Save 20%</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
        {plans.map((plan) => {
          const variant   = interval === "monthly" ? plan.monthly : plan.annual;
          const priceId   = getPriceId(plan, interval, priceIds);
          const isCurrent = currentPlan === plan.id;
          const isLoading = loadingPriceId === priceId;

          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-xl border bg-[#0D1D33] p-6 ${
                plan.highlighted
                  ? "border-[#86EFAC] shadow-lg shadow-[#1A7A3A]/10"
                  : "border-[#1A3A6B]"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-3 self-start rounded-full bg-[#1A7A3A] px-3 py-0.5 text-xs font-medium text-white">
                  Most popular
                </span>
              )}

              <h2 className="font-serif text-xl font-semibold text-white">{plan.name}</h2>
              <p className="mt-1 text-sm text-[#6B7280]">{plan.tagline}</p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-white">{variant.displayPrice}</span>
                <span className="text-sm text-[#6B7280]">{variant.intervalLabel}</span>
                {variant.savingsLabel && (
                  <span className="ml-2 text-xs text-[#86EFAC] font-medium">{variant.savingsLabel}</span>
                )}
              </div>

              {interval === "annual" && (
                <p className="mt-1 text-xs text-[#4B5563]">
                  Billed as one charge of {variant.displayPrice}
                </p>
              )}

              <p className="mt-2 text-sm font-medium text-[#86EFAC]">
                {variant.anchorLimit} sealed packages / month
              </p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#E2E8F0]">
                    <span className="mt-0.5 text-[#1A7A3A] shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <div className="w-full rounded-md border border-[#86EFAC] bg-[#0A2A1A] px-4 py-2.5 text-center text-sm font-medium text-[#86EFAC]">
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckout(priceId)}
                    disabled={isLoading || !!loadingPriceId}
                    className="w-full rounded-md bg-[#1A7A3A] px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 text-sm"
                  >
                    {isLoading
                      ? "Redirecting to Stripe…"
                      : isSignedIn
                      ? `Subscribe — ${variant.displayPrice}${variant.intervalLabel}`
                      : "Create account to subscribe"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Demo account note */}
      {!isSignedIn && (
        <p className="mt-6 text-center text-sm text-[#6B7280]">
          Not ready to subscribe?{" "}
          <a href="/register" className="text-[#86EFAC] hover:underline">
            Create a free demo account
          </a>{" "}
          — 3 anchors included, no credit card required.
        </p>
      )}

      {error && (
        <div className="mt-4 mx-auto max-w-md rounded-lg bg-[#2A1A1A] border border-[#7F1D1D] px-4 py-3 text-sm text-red-300 text-center">
          {error}
        </div>
      )}

      {/* Urgency note — from shipping plan */}
      <div className="mt-8 mx-auto max-w-2xl rounded-lg border border-[#1A3A6B] bg-[#0D1D33] px-5 py-4">
        <p className="text-xs text-[#94A3B8] leading-relaxed">
          <span className="text-white font-medium">On timing:</span> Assessment evidence must cover
          the period before your assessment — integrity evidence cannot be created retroactively.
          Every month you anchor is a month of verifiable history you will have in the room.
          November 2026 brings Level 2 C3PAO certification requirements into solicitations.
        </p>
      </div>
    </div>
  );
}
