import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, getRecentAnchors } from "@/lib/db";
import { checkAndResetMonthlyUsage } from "@/lib/usage";
import NavBar from "@/app/components/NavBar";

const PLAN_LABELS: Record<string, string> = {
  demo: "Demo",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function shortHash(hash: string) {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
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

  // Apply the monthly reset on page load so the meter is accurate.
  user = await checkAndResetMonthlyUsage(user);

  const anchors = await getRecentAnchors(user.id, 10);

  const used = user.anchors_used_this_month;
  const limit = user.anchor_limit;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const atLimit = used >= limit;
  const isDemo = user.plan === "demo";

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {upgraded === "true" && (
          <div className="mb-6 rounded-md border border-[#86EFAC] bg-[#E8F5EC] px-4 py-3 text-sm text-[#1A7A3A]">
            Your subscription is active. If your plan badge hasn&apos;t updated
            yet, give it a few seconds — Stripe confirms in the background.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-white sm:text-3xl">
              Welcome back{user.name ? `, ${user.name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-[#6B7280]">{user.email}</p>
          </div>
          <span className="rounded-full border border-[#86EFAC] bg-[#E8F5EC] px-4 py-1 text-sm font-medium text-[#1A7A3A]">
            {PLAN_LABELS[user.plan] ?? user.plan} plan
          </span>
        </div>

        {/* Usage meter */}
        <section className="mt-8 rounded-xl border border-[#1A3A6B] bg-[#0D1D33] p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[#6B7280]">
              Usage
            </h2>
            <p className="text-sm text-[#E2E8F0]">
              {isDemo
                ? `${used} of ${limit} free anchors used`
                : `${used} of ${limit} anchors used this month`}
            </p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#1A3A6B]">
            <div
              className={`h-full rounded-full transition-all ${
                atLimit ? "bg-red-500" : "bg-[#1A7A3A]"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {isDemo && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#1A3A6B] bg-[#0A1628] px-4 py-3">
              <p className="text-sm text-[#E2E8F0]">
                {atLimit
                  ? "You've used all 5 free demo anchors. Upgrade to keep sealing evidence."
                  : "Demo accounts include 5 free anchors. Upgrade for monthly capacity."}
              </p>
              <Link
                href="/pricing"
                className="rounded-md bg-[#1A7A3A] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Upgrade plan
              </Link>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-md bg-[#1A7A3A] px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
          >
            Seal a new package
          </Link>
          <Link
            href="/pricing"
            className="rounded-md border border-[#1A3A6B] px-5 py-2.5 font-medium text-[#E2E8F0] transition-colors hover:border-[#86EFAC]"
          >
            Upgrade plan
          </Link>
        </div>

        {/* Recent anchors */}
        <section className="mt-10">
          <h2 className="font-serif text-xl font-semibold text-white">
            Recent anchors
          </h2>
          {anchors.length === 0 ? (
            <div className="mt-4 rounded-xl border border-[#1A3A6B] bg-[#0D1D33] px-6 py-10 text-center">
              <p className="text-[#6B7280]">
                No anchors yet. Seal your first evidence package to see it
                here.
              </p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-md bg-[#1A7A3A] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Seal a new package
              </Link>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-[#1A3A6B]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#0D1D33] text-xs uppercase tracking-wide text-[#6B7280]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Document type</th>
                    <th className="px-4 py-3 font-medium">Organization</th>
                    <th className="px-4 py-3 font-medium">Files</th>
                    <th className="px-4 py-3 font-medium">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A3A6B]">
                  {anchors.map((a) => (
                    <tr key={a.id} className="text-[#E2E8F0]">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(a.created_at)}
                      </td>
                      <td className="px-4 py-3">{a.document_type ?? "—"}</td>
                      <td className="px-4 py-3">
                        {a.organization_name ?? "—"}
                      </td>
                      <td className="px-4 py-3">{a.file_count ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {a.tx_hash ? (
                          <a
                            href={`https://arbiscan.io/tx/${a.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#86EFAC] hover:underline"
                          >
                            {shortHash(a.tx_hash)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
