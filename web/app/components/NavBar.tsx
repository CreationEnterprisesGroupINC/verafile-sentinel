import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SignOutButton from "@/app/components/SignOutButton";

const PLAN_LABELS: Record<string, string> = {
  demo: "Demo",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

export default async function NavBar() {
  const session = await getServerSession(authOptions);

  return (
    <nav className="w-full border-b border-[#1A3A6B] bg-[#0A1628]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1A7A3A]" />
          <span className="font-serif text-lg font-semibold text-white">
            Verafile Sentinel
          </span>
        </Link>

        {session?.user ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded-full border border-[#86EFAC] bg-[#E8F5EC] px-3 py-0.5 text-xs font-medium text-[#1A7A3A]">
              {PLAN_LABELS[session.user.plan] ?? session.user.plan}
            </span>
            <Link
              href="/dashboard"
              className="text-sm text-[#6B7280] transition-colors hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className="text-sm text-[#6B7280] transition-colors hover:text-white"
            >
              Seal package
            </Link>
            <SignOutButton />
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm text-[#6B7280] transition-colors hover:text-white"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm text-[#6B7280] transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-[#1A7A3A] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
