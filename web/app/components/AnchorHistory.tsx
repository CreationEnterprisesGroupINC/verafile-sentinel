"use client";
// app/components/AnchorHistory.tsx
//
// Displays sealed packages with:
//   - Date, document type, organization, file count
//   - Transaction hash linked to basescan (Base Mainnet)
//   - Proof JSON download button
//   - DoD receipt (.txt) download button
//   - CMMC PDF report button (generates on demand from proof — requires
//     proof to be stored; falls back to "contact support" if key missing)
//   - Status badge for pending/processing jobs (polled from Redis)
//
// Proof and receipt are stored in S3. Download buttons hit /api/download/[key]
// which generates a presigned GET URL and redirects.

import { useState, useEffect } from "react";
import { FileText, Download, ExternalLink, Clock, CheckCircle, AlertCircle, Loader } from "lucide-react";
import type { AnchorRow } from "@/lib/db";

interface Props {
  anchors: AnchorRow[];
}

type JobPhase = "pending" | "processing" | "confirmed" | "failed" | "dead" | null;

function StatusBadge({ status }: { status: JobPhase }) {
  if (!status || status === "confirmed") return null;
  const cfg = {
    pending:    { icon: Clock,     color: "text-yellow-400", label: "Pending" },
    processing: { icon: Loader,    color: "text-blue-400",   label: "Anchoring…" },
    failed:     { icon: AlertCircle, color: "text-red-400",  label: "Failed" },
    dead:       { icon: AlertCircle, color: "text-red-500",  label: "Failed — contact support" },
  }[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
      <Icon size={11} className={status === "processing" ? "animate-spin" : ""} />
      {cfg.label}
    </span>
  );
}

function DownloadButton({
  label, s3Key, filename, variant = "ghost"
}: {
  label: string;
  s3Key: string;
  filename: string;
  variant?: "ghost" | "primary";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const download = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/download?key=${encodeURIComponent(s3Key)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Download failed");
      }
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const base = variant === "primary"
    ? "bg-[#1A3A6B] hover:bg-[#0A2A5B] text-white"
    : "border border-[#1A3A6B] text-[#94A3B8] hover:border-[#86EFAC] hover:text-white";

  return (
    <div>
      <button
        onClick={download}
        disabled={loading}
        title={error || label}
        className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${base}`}
      >
        {loading ? <Loader size={10} className="animate-spin" /> : <Download size={10} />}
        {label}
      </button>
      {error && <p className="mt-0.5 text-xs text-red-400 max-w-[140px] truncate" title={error}>{error}</p>}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function shortHash(hash: string) {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function safeFilename(org: string | null, suffix: string): string {
  const base = (org ?? "organization").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40);
  return `${base}-${suffix}`;
}

export default function AnchorHistory({ anchors }: Props) {
  // Track job statuses for anchors that don't have a tx_hash yet
  // (still in the worker queue). Key = anchor.id, value = JobPhase
  const [jobStatuses, setJobStatuses] = useState<Record<string, JobPhase>>({});

  // Anchors pending confirmation — poll their job status
  const pendingAnchorIds = anchors
    .filter(a => !a.tx_hash)
    .map(a => a.id);

  useEffect(() => {
    if (pendingAnchorIds.length === 0) return;

    // Poll for each pending anchor by looking up its job in Redis
    // The anchor DB row doesn't store jobId directly, but the dashboard
    // can poll /api/anchors/[id]/status which looks up the job via anchor ID.
    const poll = async () => {
      for (const anchorId of pendingAnchorIds) {
        try {
          const res = await fetch(`/api/anchors/${anchorId}/status`);
          if (!res.ok) continue;
          const data = await res.json();
          setJobStatuses(prev => ({ ...prev, [anchorId]: data.status as JobPhase }));
        } catch { /* ignore */ }
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [pendingAnchorIds.join(",")]);

  return (
    <div className="rounded-xl border border-[#1A3A6B] overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#0D1D33] text-xs uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type / Organization</th>
              <th className="px-4 py-3 font-medium">Files</th>
              <th className="px-4 py-3 font-medium">Transaction</th>
              <th className="px-4 py-3 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A3A6B] bg-[#0D1D33]">
            {anchors.map((a) => {
              const pending    = !a.tx_hash;
              const jobStatus  = pending ? (jobStatuses[a.id] ?? "pending") : null;
              const safeOrg    = safeFilename(a.organization_name, "");

              return (
                <tr key={a.id} className="text-[#E2E8F0] hover:bg-[#0A1628] transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[#94A3B8]">
                    {formatDate(a.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[#E2E8F0]">{a.document_type ?? "—"}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{a.organization_name ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94A3B8]">
                    {a.file_count ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {pending ? (
                      <StatusBadge status={jobStatus} />
                    ) : a.tx_hash ? (
                      <a
                        href={`https://basescan.org/tx/${a.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-mono text-xs text-[#86EFAC] hover:underline"
                      >
                        {shortHash(a.tx_hash)}
                        <ExternalLink size={10} />
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {pending ? (
                      <span className="text-xs text-[#4B5563]">Available after confirmation</span>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.proof_key ? (
                          <DownloadButton
                            label="Proof"
                            s3Key={a.proof_key}
                            filename={`${safeOrg}sentinel.proof.json`}
                          />
                        ) : null}
                        {a.receipt_key ? (
                          <DownloadButton
                            label="Receipt"
                            s3Key={a.receipt_key}
                            filename={`${safeOrg}sentinel-receipt.txt`}
                          />
                        ) : null}
                        {a.tx_hash && (
                          <ReportButton anchor={a} />
                        )}
                        {!a.proof_key && !a.receipt_key && !a.tx_hash && (
                          <span className="text-xs text-[#4B5563]">—</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-[#1A3A6B]">
        {anchors.map((a) => {
          const pending    = !a.tx_hash;
          const jobStatus  = pending ? (jobStatuses[a.id] ?? "pending") : null;
          const safeOrg    = safeFilename(a.organization_name, "");

          return (
            <div key={a.id} className="bg-[#0D1D33] px-4 py-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[#E2E8F0]">{a.document_type ?? "—"}</p>
                  <p className="text-xs text-[#6B7280]">{a.organization_name ?? "—"}</p>
                </div>
                <p className="text-xs text-[#6B7280] whitespace-nowrap">{formatDate(a.created_at)}</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                <span>{a.file_count ?? "—"} file{a.file_count !== 1 ? "s" : ""}</span>
                {a.tx_hash && (
                  <a href={`https://basescan.org/tx/${a.tx_hash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-[#86EFAC] hover:underline">
                    {shortHash(a.tx_hash)} <ExternalLink size={9} />
                  </a>
                )}
                {pending && <StatusBadge status={jobStatus} />}
              </div>

              {!pending && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {a.proof_key && (
                    <DownloadButton label="Proof" s3Key={a.proof_key} filename={`${safeOrg}sentinel.proof.json`} />
                  )}
                  {a.receipt_key && (
                    <DownloadButton label="Receipt" s3Key={a.receipt_key} filename={`${safeOrg}sentinel-receipt.txt`} />
                  )}
                  {a.tx_hash && <ReportButton anchor={a} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// On-demand CMMC PDF report generation button
// Fetches proof JSON from S3, then calls /api/report to generate the PDF
function ReportButton({ anchor }: { anchor: AnchorRow }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const download = async () => {
    setLoading(true);
    setError("");
    try {
      // Step 1: get presigned download URL for proof JSON
      if (!anchor.proof_key) throw new Error("Proof not available");
      const urlRes = await fetch(`/api/download?key=${encodeURIComponent(anchor.proof_key)}`);
      if (!urlRes.ok) throw new Error("Could not retrieve proof file");
      const { url } = await urlRes.json();

      // Step 2: fetch the proof JSON
      const proofRes = await fetch(url);
      if (!proofRes.ok) throw new Error("Could not download proof");
      const proof = await proofRes.json();

      // Step 3: generate PDF report
      const reportRes = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      });
      if (!reportRes.ok) {
        const d = await reportRes.json().catch(() => ({}));
        throw new Error(d.error || "Report generation failed");
      }
      const blob = await reportRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const safeOrg = (anchor.organization_name ?? "organization").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40);
      a.download = `${safeOrg}-sentinel-cmmc-report.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!anchor.proof_key) return null;

  return (
    <div>
      <button
        onClick={download}
        disabled={loading}
        className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium border border-[#1A3A6B] text-[#94A3B8] hover:border-[#86EFAC] hover:text-white disabled:opacity-50"
      >
        {loading ? <Loader size={10} className="animate-spin" /> : <FileText size={10} />}
        CMMC PDF
      </button>
      {error && <p className="mt-0.5 text-xs text-red-400 max-w-[140px] truncate" title={error}>{error}</p>}
    </div>
  );
}
