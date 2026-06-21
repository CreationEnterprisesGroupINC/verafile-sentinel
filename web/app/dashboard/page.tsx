import BillingPortalButton from "@/app/components/BillingPortalButton";
// app/dashboard/page.tsx
// v1.0 dashboard:
//   - Usage meter with correct plan labels
//   - Approval pending / subscription lapsed banners
//   - Anchor history with proof JSON + DoD receipt download + basescan links
//   - Billing portal button for paid subscribers
//   - Pending job status for in-flight anchors

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, getRecentAnchors } from "@/lib/db";
import { checkAndResetMonthlyUsage } from "@/lib/usage";
import NavBar from "@/app/components/NavBar";
import AnchorHistory from "@/app/components/AnchorHistory";

const PLAN_LABELS: Record<string, string> = {
  demo:         "Demo",
  contractor:   "Contractor",
  assessor:     "Assessor",
  enterprise:   "Enterprise",
  // legacy labels — keep until DB migration is complete
  starter:      "Starter",
  professional: "Professional",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { upgraded } = await searchParams;

  let user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  user = await checkAndResetMonthlyUsage(user);

  const anchors = await getRecentAnchors(user.id, 25);

  const used      = user.anchors_used_this_month;
  const limit     = user.anchor_limit;
  const pct       = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const atLimit   = used >= limit;
  const isDemo    = user.plan === "demo";
  const isPaid    = !isDemo;
  const notApproved = isDemo && !user.approved;
  const isLapsed  = isPaid && !["active", "trialing"].includes(user.subscription_status);

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* ── Banners ─────────────────────────────────────────────────────── */}
        {upgraded === "1" && (
          <div className="mb-6 rounded-lg border border-[#86EFAC] bg-[#0A2A1A] px-4 py-3 text-sm text-[#86EFAC]">
            Subscription active — welcome to Sentinel. If your plan badge hasn't updated, refresh in a moment.
          </div>
        )}
        {notApproved && (
          <div className="mb-6 rounded-lg border border-[#1A3A6B] bg-[#0D1D33] px-4 py-3 text-sm text-[#94A3B8]">
            <span className="font-medium text-white">Demo access pending review.</span>{" "}
            You'll receive an email at <span className="text-white">{user.email}</span> when anchoring is enabled — typically within one business day.
          </div>
        )}
        {isLapsed && (
          <div className="mb-6 rounded-lg border border-[#7F1D1D] bg-[#2A1A1A] px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-red-300">
              <span className="font-medium text-red-200">Subscription issue.</span>{" "}
              Your payment method needs attention. Update billing to restore access.
            </p>
            <a href="/billing-issue"
              className="shrink-0 rounded-md bg-red-700 hover:bg-red-600 px-3 py-1.5 text-xs font-medium text-white">
              Fix billing
            </a>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-white sm:text-3xl">
              {user.name ? `Welcome back, ${user.name}` : "Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-[#6B7280]">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#1A3A6B] bg-[#0D1D33] px-4 py-1 text-sm font-medium text-[#86EFAC]">
              {PLAN_LABELS[user.plan] ?? user.plan} plan
            </span>
            {isPaid && (
              <BillingPortalButton />
            )}
          </div>
        </div>

        {/* ── Usage meter ─────────────────────────────────────────────────── */}
        <section className="mt-8 rounded-xl border border-[#1A3A6B] bg-[#0D1D33] p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Usage</h2>
            <p className="text-sm text-[#E2E8F0]">
              {used} of {limit} {isDemo ? "lifetime" : "monthly"} packages used
              {isPaid && !atLimit && (
                <span className="ml-2 text-[#6B7280] text-xs">
                  · {limit - used} remaining
                </span>
              )}
            </p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1A3A6B]">
            <div
              className={`h-full rounded-full transition-all ${atLimit ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-[#1A7A3A]"}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {isDemo && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#1A3A6B] bg-[#0A1628] px-4 py-3">
              <p className="text-sm text-[#E2E8F0]">
                {atLimit
                  ? "You've used all demo packages. Subscribe to keep sealing evidence."
                  : "Demo accounts include 3 free packages. Subscribe for monthly capacity."}
              </p>
              <Link href="/pricing"
                className="rounded-md bg-[#1A7A3A] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                View plans
              </Link>
            </div>
          )}

          {isPaid && atLimit && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#1A3A6B] bg-[#0A1628] px-4 py-3">
              <p className="text-sm text-[#E2E8F0]">
                Monthly limit reached. Additional packages are billed at the overage rate and appear on your next invoice.
              </p>
              <Link href="/pricing"
                className="rounded-md border border-[#1A3A6B] px-4 py-2 text-sm font-medium text-[#E2E8F0] hover:border-[#86EFAC]">
                Upgrade plan
              </Link>
            </div>
          )}
        </section>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap gap-3">
          {!isLapsed && (
            <Link href="/"
              className="rounded-md bg-[#1A7A3A] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
              Seal a new package
            </Link>
          )}
          {!isPaid && (
            <Link href="/pricing"
              className="rounded-md border border-[#1A3A6B] px-5 py-2.5 text-sm font-medium text-[#E2E8F0] hover:border-[#86EFAC]">
              View plans
            </Link>
          )}
        </div>

        {/* ── Anchor history ───────────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold text-white">Evidence history</h2>
            {anchors.length > 0 && (
              <p className="text-xs text-[#6B7280]">{anchors.length} most recent packages</p>
            )}
          </div>

          {anchors.length === 0 ? (
            <div className="rounded-xl border border-[#1A3A6B] bg-[#0D1D33] px-6 py-12 text-center">
              <p className="text-[#6B7280] text-sm">No packages sealed yet.</p>
              {!notApproved && !isLapsed && (
                <Link href="/"
                  className="mt-4 inline-block rounded-md bg-[#1A7A3A] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
                  Seal your first package
                </Link>
              )}
            </div>
          ) : (
            <AnchorHistory anchors={anchors} />
          )}
        </section>

      </main>
    </div>
  );
}


