import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import { checkAndResetMonthlyUsage } from "@/lib/usage";
import NavBar from "@/app/components/NavBar";
import CommitPage from "@/app/components/CommitPage";

/**
 * Main app page.
 *
 * The previous hardcoded password gate (sentinel2028) is removed entirely.
 * Authentication is enforced by middleware.ts (unauthenticated visitors are
 * redirected to /login before this page renders) and re-checked here.
 *
 * All anchoring functionality lives in <CommitPage /> and is unchanged.
 */
export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  let user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  user = await checkAndResetMonthlyUsage(user);

  const used = user.anchors_used_this_month;
  const limit = user.anchor_limit;
  const remaining = Math.max(0, limit - used);
  const atLimit = remaining === 0;
  const isDemo = user.plan === "demo";

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <NavBar />

      {/* User context strip */}
      <div className="border-b border-[#1A3A6B] bg-[#0D1D33]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-6">
          <span className="text-[#E2E8F0]">
            {user.name ?? user.email}
            <span className="ml-2 text-[#6B7280]">
              · {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} plan
            </span>
          </span>
          <span className={atLimit ? "text-red-400" : "text-[#86EFAC]"}>
            {isDemo
              ? `${remaining} of ${limit} free anchors remaining`
              : `${remaining} anchors remaining this month`}
          </span>
        </div>
      </div>

      {/* Limit-reached banner */}
      {atLimit && (
        <div className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-400 bg-red-950/40 px-4 py-3">
            <p className="text-sm text-red-200">
              You&apos;ve used all {limit}{" "}
              {isDemo ? "free demo anchors" : "anchors for this month"}.
              Upgrade to continue sealing evidence packages.
            </p>
            <Link
              href="/pricing"
              className="rounded-md bg-[#1A7A3A] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Upgrade plan
            </Link>
          </div>
        </div>
      )}

      {/* Existing anchoring app — unchanged */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <CommitPage />
      </main>
    </div>
  );
}
