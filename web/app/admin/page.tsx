"use client";
// app/admin/page.tsx
// Admin dashboard — user list, pending approvals, one-click approve.
// Gated by ADMIN_SECRET entered in the page (not stored in session).
// For a solo operator — no auth overhead needed.

import { useState, useEffect } from "react";
import { CheckCircle, Clock, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  approved: boolean;
  subscription_status: string;
  anchors_used_this_month: number;
  anchor_limit: number;
  stripe_customer_id: string | null;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PlanBadge({ plan, status }: { plan: string; status: string }) {
  const isPaid = plan !== "demo";
  const isActive = status === "active" || status === "trialing";
  const color = isPaid && isActive ? "text-[#86EFAC] border-[#1A7A3A]"
    : isPaid ? "text-red-400 border-red-800"
    : "text-[#94A3B8] border-[#1A3A6B]";
  return (
    <span className={`text-xs border rounded px-2 py-0.5 ${color}`}>
      {plan}{isPaid ? ` · ${status}` : ""}
    </span>
  );
}

export default function AdminPage() {
  const [secret, setSecret]   = useState("");
  const [authed, setAuthed]   = useState(false);
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [filter, setFilter]   = useState<"all" | "pending" | "paid">("pending");
  const [approving, setApproving] = useState<string | null>(null);

  const fetchUsers = async (s = secret) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", { headers: { "x-admin-secret": s } });
      if (!res.ok) throw new Error(res.status === 401 ? "Wrong secret" : "Fetch failed");
      const data = await res.json();
      setUsers(data.users);
      setAuthed(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (userId: string, email: string) => {
    setApproving(userId);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "x-admin-secret": secret, "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Approve failed");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved: true } : u));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApproving(null);
    }
  };

  const filtered = users.filter(u => {
    if (filter === "pending") return u.plan === "demo" && !u.approved;
    if (filter === "paid")    return u.plan !== "demo";
    return true;
  });

  const pendingCount = users.filter(u => u.plan === "demo" && !u.approved).length;
  const paidCount    = users.filter(u => u.plan !== "demo").length;

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-[#0D1D33] border border-[#1A3A6B] rounded-xl p-8">
          <h1 className="text-white font-serif text-xl font-semibold mb-6">Admin</h1>
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchUsers()}
            placeholder="Admin secret"
            className="w-full rounded-md border border-[#1A3A6B] bg-[#0A1628] px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#86EFAC] mb-3"
          />
          <button
            onClick={() => fetchUsers()}
            disabled={loading || !secret}
            className="w-full bg-[#1A7A3A] hover:bg-[#1A6A30] disabled:bg-[#94A3B8] text-white font-medium py-2 rounded-md text-sm"
          >
            {loading ? "Loading…" : "Sign in"}
          </button>
          {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white font-serif text-2xl font-semibold">Admin</h1>
            <p className="text-[#6B7280] text-sm mt-0.5">{users.length} users total</p>
          </div>
          <button onClick={() => fetchUsers()} disabled={loading}
            className="flex items-center gap-2 text-[#94A3B8] hover:text-white text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total users",       value: users.length,  color: "text-white" },
            { label: "Pending approval",  value: pendingCount,  color: pendingCount > 0 ? "text-yellow-400" : "text-white" },
            { label: "Paid subscribers",  value: paidCount,     color: paidCount > 0 ? "text-[#86EFAC]" : "text-white" },
          ].map(s => (
            <div key={s.label} className="bg-[#0D1D33] border border-[#1A3A6B] rounded-xl p-4">
              <p className="text-[#6B7280] text-xs mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(["pending", "paid", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-[#1A3A6B] text-white" : "text-[#6B7280] hover:text-white"}`}>
              {f === "pending" ? `Pending (${pendingCount})` : f === "paid" ? `Paid (${paidCount})` : `All (${users.length})`}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-[#2A1A1A] px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {/* User table */}
        <div className="rounded-xl border border-[#1A3A6B] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0D1D33] text-xs uppercase tracking-wide text-[#6B7280]">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A3A6B] bg-[#0D1D33]">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6B7280] text-sm">No users match this filter</td></tr>
              ) : filtered.map(u => {
                const isPendingApproval = u.plan === "demo" && !u.approved;
                return (
                  <tr key={u.id} className={`text-[#E2E8F0] hover:bg-[#0A1628] transition-colors ${isPendingApproval ? "border-l-2 border-l-yellow-500" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{u.name ?? "—"}</p>
                      <p className="text-xs text-[#6B7280]">{u.email}</p>
                      <p className="text-xs text-[#4B5563] font-mono mt-0.5">{u.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={u.plan} status={u.subscription_status} />
                      {isPendingApproval && (
                        <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                          <Clock size={10} /> Pending
                        </p>
                      )}
                      {u.plan === "demo" && u.approved && (
                        <p className="text-xs text-[#86EFAC] mt-1 flex items-center gap-1">
                          <CheckCircle size={10} /> Approved
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{u.anchors_used_this_month} / {u.anchor_limit}</p>
                      <div className="mt-1 h-1 w-16 bg-[#1A3A6B] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1A7A3A] rounded-full"
                          style={{ width: `${Math.min(100, (u.anchors_used_this_month / u.anchor_limit) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isPendingApproval && (
                          <button
                            onClick={() => approve(u.id, u.email)}
                            disabled={approving === u.id}
                            className="flex items-center gap-1 bg-[#1A7A3A] hover:bg-[#1A6A30] disabled:bg-[#94A3B8] text-white px-2.5 py-1 rounded text-xs font-medium"
                          >
                            {approving === u.id ? "…" : <><CheckCircle size={10} /> Approve</>}
                          </button>
                        )}
                        {u.stripe_customer_id && (
                          <a
                            href={`https://dashboard.stripe.com/customers/${u.stripe_customer_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 border border-[#1A3A6B] text-[#94A3B8] hover:text-white px-2.5 py-1 rounded text-xs"
                          >
                            Stripe <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
