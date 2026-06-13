import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import NavBar from "@/app/components/NavBar";
import CheckoutButton from "@/app/components/CheckoutButton";

const TIERS = [
  {
    name: "Starter",
    plan: "starter",
    price: "$500",
    priceId: "price_1TheCmQg9XLktfgQXbG4D6Cf",
    anchors: "50 anchors / month",
    blurb: "For contractors anchoring a single CMMC evidence package.",
    features: [
      "50 blockchain anchors per month",
      "Arbitrum One mainnet anchoring",
      "CMMC evidence PDF reports",
      "Proof JSON download and verification",
      "Email support",
    ],
    highlighted: false,
  },
  {
    name: "Professional",
    plan: "professional",
    price: "$1,200",
    priceId: "price_1TheDGQg9XLktfgQYZjY3bEl",
    anchors: "500 anchors / month",
    blurb: "For contractors maintaining continuous evidence across programs.",
    features: [
      "500 blockchain anchors per month",
      "Arbitrum One mainnet anchoring",
      "CMMC evidence PDF reports",
      "Proof JSON download and verification",
      "Priority email support",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    plan: "enterprise",
    price: "$2,000",
    priceId: "price_1TheG4Qg9XLktfgQZMy2bEKJ",
    anchors: "10,000 anchors / month",
    blurb: "For primes and MSPs anchoring evidence at organizational scale.",
    features: [
      "10,000 blockchain anchors per month",
      "Arbitrum One mainnet anchoring",
      "CMMC evidence PDF reports",
      "Proof JSON download and verification",
      "Priority support",
    ],
    highlighted: false,
  },
];

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const currentPlan = session?.user?.plan;

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-semibold text-white sm:text-4xl">
            Pricing
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[#6B7280]">
            Every plan anchors your evidence to Arbitrum One mainnet. Cancel
            anytime — proofs already anchored remain verifiable forever.
          </p>
          {!session && (
            <p className="mt-3 text-sm text-[#6B7280]">
              Not ready to subscribe?{" "}
              <Link href="/register" className="text-[#86EFAC] hover:underline">
                Create a free demo account
              </Link>{" "}
              with 5 anchors included.
            </p>
          )}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.plan}
              className={`flex flex-col rounded-xl border bg-[#0D1D33] p-6 ${
                tier.highlighted
                  ? "border-[#86EFAC] shadow-lg shadow-[#1A7A3A]/10"
                  : "border-[#1A3A6B]"
              }`}
            >
              {tier.highlighted && (
                <span className="mb-3 self-start rounded-full bg-[#1A7A3A] px-3 py-0.5 text-xs font-medium text-white">
                  Most popular
                </span>
              )}
              <h2 className="font-serif text-xl font-semibold text-white">
                {tier.name}
              </h2>
              <p className="mt-1 text-sm text-[#6B7280]">{tier.blurb}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-white">
                  {tier.price}
                </span>
                <span className="text-sm text-[#6B7280]">/month</span>
              </div>
              <p className="mt-1 text-sm font-medium text-[#86EFAC]">
                {tier.anchors}
              </p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-[#E2E8F0]"
                  >
                    <span className="mt-0.5 text-[#1A7A3A]">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <CheckoutButton
                  priceId={tier.priceId}
                  isCurrentPlan={currentPlan === tier.plan}
                  isSignedIn={!!session}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-[#6B7280]">
          Subscriptions are billed monthly through Stripe. See our{" "}
          <Link href="/terms" className="text-[#86EFAC] hover:underline">
            Terms of Service
          </Link>{" "}
          for payment and cancellation details.
        </p>
      </main>
    </div>
  );
}
