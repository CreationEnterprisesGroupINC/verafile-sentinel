"use client";
import { useState } from "react";
import { CheckCircle, XCircle, Loader, Upload } from "lucide-react";

export default function VerifyPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "pass" | "fail" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const onProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setProofFile(e.target.files[0]);
  };

  const verify = async () => {
    if (files.length === 0 || !proofFile) return;
    setStatus("loading");
    setError("");
    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      formData.append("proof", proofFile);
      const res = await fetch("/api/verify", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setResult(data);
      setStatus(data.status === "PASS" ? "pass" : "fail");
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0A1628] font-serif">Verify a package</h2>
        <p className="text-[#6B7280] text-sm mt-1">Upload your files and proof to verify nothing has changed.</p>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
        <p className="text-sm font-semibold text-[#374151] mb-3">Step 1 - Upload your files</p>
        <label className="flex items-center gap-3 cursor-pointer border border-dashed border-[#CBD5E1] rounded-lg px-4 py-3 hover:border-[#1A3A6B] transition-colors">
          <Upload size={16} className="text-[#94A3B8]" />
          <span className="text-sm text-[#6B7280]">
            {files.length > 0 ? files.length + " file(s) selected" : "Choose files to verify"}
          </span>
          <input type="file" multiple className="hidden" onChange={onFiles} />
        </label>
        {files.length > 0 && (
          <div className="mt-3 space-y-1">
            {files.map((f, i) => (
              <p key={i} className="text-xs text-[#6B7280] font-mono">{f.name}</p>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
        <p className="text-sm font-semibold text-[#374151] mb-3">Step 2 - Upload sentinel.proof.json</p>
        <label className="flex items-center gap-3 cursor-pointer border border-dashed border-[#CBD5E1] rounded-lg px-4 py-3 hover:border-[#1A3A6B] transition-colors">
          <Upload size={16} className="text-[#94A3B8]" />
          <span className="text-sm text-[#6B7280]">{proofFile ? proofFile.name : "Choose sentinel.proof.json"}</span>
          <input type="file" accept=".json" className="hidden" onChange={onProof} />
        </label>
      </div>

      {error && (
        <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      {status === "pass" && result && (
        <div className="bg-[#E8F5EC] border border-[#86EFAC] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="text-[#1A7A3A]" size={28} />
            <div>
              <h3 className="text-[#1A7A3A] font-bold text-lg">PASS - Integrity Verified</h3>
              <p className="text-[#1A7A3A] text-sm">Package is unchanged since commitment</p>
            </div>
          </div>
          <p className="text-xs font-mono text-[#6B7280]">TX: <span className="text-[#1A3A6B] break-all">{result.txHash}</span></p>
          <p className="text-xs font-mono text-[#6B7280] mt-1">Block: {result.blockNumber}</p>
          <a href={"https://arbiscan.io/tx/" + result.txHash} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-[#1A3A6B] text-xs underline">View on Arbiscan</a>
        </div>
      )}

      {status === "fail" && (
        <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="text-[#991B1B]" size={28} />
            <div>
              <h3 className="text-[#991B1B] font-bold text-lg">FAIL - Integrity Failure</h3>
              <p className="text-[#991B1B] text-sm">Package has been modified since commitment</p>
            </div>
          </div>
          <p className="text-xs text-[#991B1B]">The fingerprint does not match the blockchain record. One or more files have been modified.</p>
        </div>
      )}

      <button
        onClick={verify}
        disabled={files.length === 0 || !proofFile || status === "loading"}
        className="w-full bg-[#1A3A6B] hover:bg-[#0A2A5B] disabled:bg-[#94A3B8] text-white font-semibold py-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
      >
        {status === "loading" ? "Verifying..." : "Verify integrity"}
      </button>
    </div>
  );
}
