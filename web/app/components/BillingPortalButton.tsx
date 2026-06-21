"use client";
// app/components/BillingPortalButton.tsx
// One-click Stripe Customer Portal redirect for paid subscribers.

import { useState } from "react";
import { ExternalLink } from "lucide-react";

export default function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const open = async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.message || "Could not open portal");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={open}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-md border border-[#1A3A6B] bg-[#0D1D33] px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:border-[#86EFAC] hover:text-white disabled:opacity-50"
      >
        {loading ? "Opening…" : <><ExternalLink size={12} /> Manage billing</>}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
