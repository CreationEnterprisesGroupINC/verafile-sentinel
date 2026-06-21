// components/CommitPage.tsx
//
// Full async commit flow:
//   1. Upload files via presigned S3 (bypasses Vercel 4.5MB limit)
//   2. POST /api/commit → { jobId, status: "pending" }
//   3. Poll GET /api/commit/[jobId]/status every 3s until confirmed/failed
//   4. On confirmed: proof available, download buttons shown

"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, CheckCircle, Loader, FileText, AlertCircle, Clock } from "lucide-react";

const DOCUMENT_TYPES = [
  "Audit Log",
  "System Security Plan (SSP)",
  "POA&M",
  "Configuration Baseline",
  "Incident Report",
  "Vulnerability Scan Report",
] as const;

type Phase =
  | "idle"
  | "uploading"
  | "sealing"
  | "polling"
  | "confirmed"
  | "error";

interface FileToken {
  s3Key: string;
  filename: string;
  sha256Hex: string;
  sizeBytes: number;
  confirmedAt: string;
  userId: string;
}

async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadFile(file: File): Promise<FileToken> {
  const initRes = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, sizeBytes: file.size, mimeType: file.type || "application/octet-stream" }),
  });
  if (!initRes.ok) {
    const d = await initRes.json().catch(() => ({}));
    throw new Error(d.error || `Upload init failed (${initRes.status})`);
  }
  const { uploadUrl, s3Key } = await initRes.json();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status}). Try again.`);

  const sha256Hex = await sha256File(file);

  const confirmRes = await fetch("/api/upload/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ s3Key, sha256Hex, filename: file.name, sizeBytes: file.size }),
  });
  if (!confirmRes.ok) {
    const d = await confirmRes.json().catch(() => ({}));
    throw new Error(d.error || `Upload confirmation failed (${confirmRes.status})`);
  }
  const { fileToken } = await confirmRes.json();
  return fileToken as FileToken;
}

export default function CommitPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadFilename, setUploadFilename] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [proof, setProof] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "error">("idle");
  const [reportError, setReportError] = useState("");
  const [receiptStatus, setReceiptStatus] = useState<"idle" | "loading" | "error">("idle");
  const [receiptError, setReceiptError] = useState("");
  const [pollSeconds, setPollSeconds] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollSecondsRef = useRef(0);

  // Polling
  useEffect(() => {
    if (phase !== "polling" || !jobId) return;

    pollRef.current = setInterval(async () => {
      pollSecondsRef.current += 3;
      setPollSeconds(pollSecondsRef.current);

      try {
        const res = await fetch(`/api/commit/${jobId}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "confirmed" && data.proof) {
          clearInterval(pollRef.current!);
          setProof(data.proof);
          setPhase("confirmed");
        } else if (data.status === "dead" || data.status === "failed") {
          clearInterval(pollRef.current!);
          setErrorMsg(data.errorDetail || "Commit failed. Please try again.");
          setPhase("error");
        }
        // pending / processing — keep polling
      } catch {
        // network hiccup — keep polling
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, jobId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const isWorking = phase === "uploading" || phase === "sealing" || phase === "polling";
  const canCommit = files.length > 0 && organizationName.trim().length > 0 && documentType.length > 0 && phase === "idle";

  const commit = async () => {
    if (!canCommit) return;
    setErrorMsg("");
    try {
      const fileTokens: FileToken[] = [];
      for (let i = 0; i < files.length; i++) {
        setPhase("uploading");
        setUploadIndex(i + 1);
        setUploadFilename(files[i].name);
        fileTokens.push(await uploadFile(files[i]));
      }

      setPhase("sealing");
      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileTokens, organizationName: organizationName.trim(), documentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Commit failed");

      setJobId(data.jobId);
      pollSecondsRef.current = 0;
      setPollSeconds(0);
      setPhase("polling");
    } catch (err: any) {
      setErrorMsg(err.message);
      setPhase("error");
    }
  };

  const downloadProof = () => {
    if (!proof) return;
    const blob = new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sentinel.proof.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadReport = async () => {
    if (!proof) return;
    setReportStatus("loading");
    setReportError("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Report generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeOrg = ((proof?.package as any)?.organization || "organization").replace(/[^a-zA-Z0-9-_]+/g, "-");
      a.download = `${safeOrg}-sentinel-cmmc-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setReportStatus("idle");
    } catch (err: any) {
      setReportError(err.message);
      setReportStatus("error");
    }
  };

  const downloadReceipt = async () => {
    if (!proof) return;
    setReceiptStatus("loading");
    setReceiptError("");
    try {
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Receipt generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeOrg = ((proof?.package as any)?.organization || "organization").replace(/[^a-zA-Z0-9-_]+/g, "-");
      a.download = `${safeOrg}-sentinel-receipt.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setReceiptStatus("idle");
    } catch (err: any) {
      setReceiptError(err.message);
      setReceiptStatus("error");
    }
  };

  const reset = () => {
    setFiles([]);
    setPhase("idle");
    setProof(null);
    setJobId(null);
    setOrganizationName("");
    setDocumentType("");
    setErrorMsg("");
    setReportStatus("idle");
    setReportError("");
    setReceiptStatus("idle");
    setReceiptError("");
    setPollSeconds(0);
    pollSecondsRef.current = 0;
  };

  // ── Confirmed ──────────────────────────────────────────────────────────────
  if (phase === "confirmed" && proof) {
    return (
      <div className="space-y-6">
        <div className="bg-[#E8F5EC] border border-[#86EFAC] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="text-[#1A7A3A]" size={28} />
            <div>
              <h2 className="text-[#1A7A3A] font-bold text-lg">Package Sealed</h2>
              <p className="text-[#1A7A3A] text-sm">Permanently recorded on Base Mainnet</p>
            </div>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <p className="text-[#6B7280]">Org: <span className="text-[#374151]">{(proof.package as any)?.organization}</span></p>
            <p className="text-[#6B7280]">Type: <span className="text-[#374151]">{(proof.package as any)?.document_type}</span></p>
            <p className="text-[#6B7280]">TX: <span className="text-[#1A3A6B] break-all">{(proof.commitment as any)?.tx_hash}</span></p>
            <p className="text-[#6B7280]">Block: <span className="text-[#374151]">{(proof.commitment as any)?.block_number?.toLocaleString()}</span></p>
            <p className="text-[#6B7280]">Root: <span className="text-[#1A3A6B] break-all">{proof.root_hash as string}</span></p>
            <p className="text-[#6B7280]">Files: <span className="text-[#374151]">{(proof.manifest as any[])?.length} sealed</span></p>
          </div>
          <a href={"https://basescan.org/tx/" + (proof.commitment as any)?.tx_hash} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-[#1A3A6B] text-xs underline">View on Basescan</a>
        </div>

        <button onClick={downloadReport} disabled={reportStatus === "loading"}
          className="w-full bg-[#1A7A3A] hover:bg-[#1A6A30] disabled:bg-[#94A3B8] text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2">
          {reportStatus === "loading"
            ? <span className="flex items-center gap-2"><Loader size={16} className="animate-spin" />Generating report...</span>
            : <span className="flex items-center gap-2"><FileText size={16} />Download CMMC Compliance Report (PDF)</span>}
        </button>
        {reportError && <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-4 py-3 text-red-700 text-sm">{reportError}</div>}

        <button onClick={downloadReceipt} disabled={receiptStatus === "loading"}
          className="w-full bg-[#1A3A6B] hover:bg-[#0A2A5B] disabled:bg-[#94A3B8] text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2">
          {receiptStatus === "loading"
            ? <span className="flex items-center gap-2"><Loader size={16} className="animate-spin" />Generating receipt...</span>
            : <span className="flex items-center gap-2"><FileText size={16} />Download DoD-Format Evidence Receipt (.txt)</span>}
        </button>
        {receiptError && <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-4 py-3 text-red-700 text-sm">{receiptError}</div>}

        <button onClick={downloadProof} className="w-full bg-[#1A3A6B] hover:bg-[#0A2A5B] text-white font-semibold py-3 rounded-lg text-sm">Download sentinel.proof.json</button>
        <p className="text-center text-[#6B7280] text-xs">Keep the proof JSON with your compliance records — the salt inside is required to independently verify this package.</p>
        <button onClick={reset} className="w-full border border-[#E2E8F0] text-[#6B7280] py-2 rounded-lg text-sm">Seal another package</button>
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0A1628] font-serif">Seal a compliance package</h2>
        <p className="text-[#6B7280] text-sm mt-1">Upload your files. We fingerprint and seal them permanently to Base Mainnet.</p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="orgName" className="block text-sm font-medium text-[#374151] mb-1">Organization name <span className="text-red-500">*</span></label>
          <input id="orgName" type="text" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)}
            maxLength={200} disabled={isWorking} placeholder="e.g. Meridian Defense Systems, Inc."
            className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151] focus:outline-none focus:border-[#1A3A6B] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]" />
        </div>
        <div>
          <label htmlFor="docType" className="block text-sm font-medium text-[#374151] mb-1">Document type <span className="text-red-500">*</span></label>
          <select id="docType" value={documentType} onChange={(e) => setDocumentType(e.target.value)}
            disabled={isWorking}
            className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:border-[#1A3A6B] disabled:bg-[#F8FAFC]">
            <option value="" disabled>Select the type of documents in this package…</option>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <p className="text-[#94A3B8] text-xs mt-1">Determines which CMMC Level 2 practices the compliance report cites.</p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!isWorking) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={isWorking ? undefined : onDrop}
        className={"border-2 border-dashed rounded-xl p-10 text-center transition-colors " +
          (isWorking ? "border-[#E2E8F0] bg-[#F8FAFC] cursor-not-allowed"
            : dragging ? "border-[#1A7A3A] bg-[#E8F5EC] cursor-pointer"
            : "border-[#CBD5E1] bg-white hover:border-[#1A3A6B] cursor-pointer")}
        onClick={() => !isWorking && document.getElementById("fileInput")?.click()}>
        <Upload className="mx-auto text-[#94A3B8] mb-3" size={32} />
        <p className="text-[#374151] font-medium text-sm">Drop files here or click to browse</p>
        <p className="text-[#94A3B8] text-xs mt-1">SSP, POA&M, audit logs, scan reports — any size</p>
        <input id="fileInput" type="file" multiple className="hidden" onChange={onFileInput} />
      </div>

      {files.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl divide-y divide-[#F1F5F9]">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#374151]">{f.name}</p>
                <p className="text-xs text-[#94A3B8]">{f.size >= 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + " MB" : (f.size / 1024).toFixed(1) + " KB"}</p>
              </div>
              {!isWorking && <button onClick={() => removeFile(i)} className="text-[#94A3B8] hover:text-red-400 text-xs">Remove</button>}
            </div>
          ))}
        </div>
      )}

      {/* Progress states */}
      {phase === "uploading" && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-4 py-3 flex items-center gap-3">
          <Loader size={16} className="animate-spin text-[#1A3A6B] shrink-0" />
          <div>
            <p className="text-[#1A3A6B] text-sm font-medium">Uploading file {uploadIndex} of {files.length}</p>
            <p className="text-[#6B7280] text-xs truncate max-w-xs">{uploadFilename}</p>
          </div>
        </div>
      )}
      {phase === "sealing" && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-4 py-3 flex items-center gap-3">
          <Loader size={16} className="animate-spin text-[#1A3A6B] shrink-0" />
          <p className="text-[#1A3A6B] text-sm font-medium">Queuing commit…</p>
        </div>
      )}
      {phase === "polling" && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-4 py-3 flex items-center gap-3">
          <Clock size={16} className="text-[#1A3A6B] shrink-0" />
          <div>
            <p className="text-[#1A3A6B] text-sm font-medium">Anchoring to blockchain…</p>
            <p className="text-[#6B7280] text-xs">Waiting for on-chain confirmation · {pollSeconds}s</p>
          </div>
        </div>
      )}
      {phase === "error" && (
        <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-700 text-sm font-medium">Seal failed</p>
            <p className="text-red-600 text-xs mt-0.5">{errorMsg}</p>
            <button onClick={reset} className="text-red-500 underline text-xs mt-1">Try again</button>
          </div>
        </div>
      )}

      <button onClick={commit} disabled={!canCommit || isWorking}
        className="w-full bg-[#1A7A3A] hover:bg-[#1A6A30] disabled:bg-[#94A3B8] text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2">
        {isWorking
          ? <span className="flex items-center gap-2"><Loader size={16} className="animate-spin" />{phase === "uploading" ? "Uploading…" : phase === "polling" ? "Anchoring…" : "Queuing…"}</span>
          : "Seal " + (files.length > 0 ? files.length + " file" + (files.length > 1 ? "s" : "") : "package") + " to blockchain"}
      </button>

      {!canCommit && files.length > 0 && phase === "idle" && (
        <p className="text-center text-[#94A3B8] text-xs">Enter your organization name and select a document type to continue.</p>
      )}

      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3">
        <p className="text-[#6B7280] text-xs">Your files upload directly to encrypted storage. Only the salted cryptographic fingerprint is committed to the blockchain — file contents never appear in the public record.</p>
      </div>
    </div>
  );
}
