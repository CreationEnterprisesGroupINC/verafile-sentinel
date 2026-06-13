"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-[#1A3A6B] bg-[#0A1628] p-8 shadow-xl">
      <h1 className="font-serif text-2xl font-semibold text-white">
        Sign in to Verafile Sentinel
      </h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        Blockchain-anchored evidence for your CMMC package.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-400 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[#E2E8F0]"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="mt-1 w-full rounded-md border border-[#1A3A6B] bg-[#0D1D33] px-3 py-2 text-white placeholder-[#6B7280] outline-none focus:border-[#86EFAC]"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-[#E2E8F0]"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="mt-1 w-full rounded-md border border-[#1A3A6B] bg-[#0D1D33] px-3 py-2 text-white placeholder-[#6B7280] outline-none focus:border-[#86EFAC]"
            placeholder="••••••••"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-md bg-[#1A7A3A] px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>

      <div className="mt-6 space-y-2 text-sm">
        <p className="text-[#6B7280]">
          New here?{" "}
          <Link href="/register" className="text-[#86EFAC] hover:underline">
            Create an account
          </Link>{" "}
          — it starts in demo mode with 5 free anchors, no card required.
        </p>
        <p className="text-[#6B7280]">
          Looking for plans?{" "}
          <Link href="/pricing" className="text-[#86EFAC] hover:underline">
            See pricing
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4 py-12">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
