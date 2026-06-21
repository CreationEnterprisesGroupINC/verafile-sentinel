// app/pricing/page.tsx
// v1.0 plans: Contractor ($299/mo | $2,872/yr) + Assessor ($1,500/mo | $14,400/yr)
// Annual toggle — client component handles the switch.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import NavBar from "@/app/components/NavBar";
import PricingClient from "@/app/components/PricingClient";
import { PLANS } from "@/lib/plans";

export default async function PricingPage() {
  const session     = await getServerSession(authOptions);
  const currentPlan = session?.user?.plan ?? null;

  // Read price IDs server-side from env — never expose secret keys, only price IDs
  const priceIds = {
    contractor_monthly: process.env.STRIPE_PRICE_CONTRACTOR_MONTHLY ?? "",
    contractor_annual:  process.env.STRIPE_PRICE_CONTRACTOR_ANNUAL  ?? "",
    assessor_monthly:   process.env.STRIPE_PRICE_ASSESSOR_MONTHLY   ?? "",
    assessor_annual:    process.env.STRIPE_PRICE_ASSESSOR_ANNUAL    ?? "",
  };

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-semibold text-white sm:text-4xl">Pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-[#6B7280] text-sm">
            Every plan anchors your evidence to Base Mainnet via ERC-8281.
            Proofs already anchored remain verifiable forever — even if you cancel.
          </p>
        </div>

        <PricingClient
          plans={PLANS}
          priceIds={priceIds}
          currentPlan={currentPlan}
          isSignedIn={!!session}
        />

        <div className="mt-10 text-center text-xs text-[#6B7280] space-y-1">
          <p>Billed through Stripe. Cancel anytime — anchors already made remain verifiable forever.</p>
          <p className="text-[#4B5563]">
            Annual plans are billed as a single upfront charge. Monthly plans renew each calendar month.
            Overage is metered and added to the next invoice — one transaction, one $0.30 fee.
          </p>
        </div>
      </main>
    </div>
  );
}
