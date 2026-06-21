"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!organization.trim()) {
      setError("Enter your organization name.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, organization, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Could not create account.");
        setLoading(false);
        return;
      }

      // Auto sign-in after successful registration.
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Account exists; the sign-in failed for some other reason.
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-[#1A3A6B] bg-[#0A1628] p-8 shadow-xl">
        <h1 className="font-serif text-2xl font-semibold text-white">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Start with 5 free demo anchors. No card required.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-red-400 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[#E2E8F0]"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#1A3A6B] bg-[#0D1D33] px-3 py-2 text-white placeholder-[#6B7280] outline-none focus:border-[#86EFAC]"
              placeholder="Jane Contractor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E2E8F0]">
              Organization
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#1A3A6B] bg-[#0D1D33] px-3 py-2 text-white placeholder-[#6B7280] outline-none focus:border-[#86EFAC]"
              placeholder="Your company or organization name"
            />
          </div>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#1A3A6B] bg-[#0D1D33] px-3 py-2 text-white placeholder-[#6B7280] outline-none focus:border-[#86EFAC]"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block text-sm font-medium text-[#E2E8F0]"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="mt-1 w-full rounded-md border border-[#1A3A6B] bg-[#0D1D33] px-3 py-2 text-white placeholder-[#6B7280] outline-none focus:border-[#86EFAC]"
              placeholder="Re-enter password"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-md bg-[#1A7A3A] px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-xs text-[#6B7280]">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-[#86EFAC] hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </div>

        <p className="mt-6 text-sm text-[#6B7280]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#86EFAC] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
