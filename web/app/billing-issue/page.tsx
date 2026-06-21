// app/billing-issue/page.tsx
// Landing page for subscribers with lapsed/past_due subscriptions.
// Gives them one click to the Stripe Customer Portal to fix billing.

"use client";
import { useState } from "react";
import { AlertCircle, ExternalLink } from "lucide-react";

export default function BillingIssuePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const openPortal = async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.message || "Could not open billing portal");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[#0D1D33] border border-[#7F1D1D] rounded-xl p-8 text-center">
        <AlertCircle className="mx-auto text-red-400 mb-4" size={40} />
        <h1 className="text-white font-serif text-2xl font-semibold mb-2">
          Subscription issue
        </h1>
        <p className="text-[#94A3B8] text-sm mb-6">
          Your Verafile Sentinel subscription is no longer active. This is usually a
          payment method issue. Update your billing details to restore access —
          all your existing proofs remain verifiable regardless.
        </p>
        <button
          onClick={openPortal}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#1A7A3A] hover:bg-[#1A6A30] disabled:bg-[#94A3B8] text-white font-semibold py-3 rounded-lg text-sm mb-3"
        >
          {loading ? "Opening portal…" : <>Update billing details <ExternalLink size={14} /></>}
        </button>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <p className="text-[#4B5563] text-xs mt-4">
          Questions? Email{" "}
          <a href="mailto:damon@ocp-labs.org" className="text-[#86EFAC] hover:underline">
            damon@ocp-labs.org
          </a>
        </p>
      </div>
    </div>
  );
}
