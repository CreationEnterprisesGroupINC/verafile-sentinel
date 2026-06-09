"use client";
import { useState, useCallback } from "react";
import { Upload, CheckCircle, Loader } from "lucide-react";

export default function CommitPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [proof, setProof] = useState<any>(null);
  const [error, setError] = useState("");

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const commit = async () => {
    if (files.length === 0) return;
    setStatus("loading");
    setError("");
    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      const res = await fetch("/api/commit", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Commit failed");
      setProof(data);
      setStatus("done");
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    }
  };

  const downloadProof = () => {
    const blob = new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sentinel.proof.json";
    a.click();
  };

  if (status === "done" && proof) {
    return (
      <div className="space-y-6">
        <div className="bg-[#E8F5EC] border border-[#86EFAC] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="text-[#1A7A3A]" size={28} />
            <div>
              <h2 className="text-[#1A7A3A] font-bold text-lg">Package Sealed</h2>
              <p className="text-[#1A7A3A] text-sm">Permanently recorded on Arbitrum One</p>
            </div>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <p className="text-[#6B7280]">TX: <span className="text-[#1A3A6B] break-all">{proof.commitment?.tx_hash}</span></p>
            <p className="text-[#6B7280]">Block: <span className="text-[#374151]">{proof.commitment?.block_number?.toLocaleString()}</span></p>
            <p className="text-[#6B7280]">Root: <span className="text-[#1A3A6B] break-all">{proof.root_hash}</span></p>
            <p className="text-[#6B7280]">Files: <span className="text-[#374151]">{proof.manifest?.length} sealed</span></p>
          </div>
          <a href={"https://arbiscan.io/tx/" + proof.commitment?.tx_hash} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-[#1A3A6B] text-xs underline">View on Arbiscan</a>
        </div>
        <button onClick={downloadProof} className="w-full bg-[#1A3A6B] hover:bg-[#0A2A5B] text-white font-semibold py-3 rounded-lg text-sm">Download sentinel.proof.json</button>
        <p className="text-center text-[#6B7280] text-xs">Save this file. You will need it to verify your package later.</p>
        <button onClick={() => { setFiles([]); setStatus("idle"); setProof(null); }} className="w-full border border-[#E2E8F0] text-[#6B7280] py-2 rounded-lg text-sm">Seal another package</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0A1628] font-serif">Seal a compliance package</h2>
        <p className="text-[#6B7280] text-sm mt-1">Upload your files. We will fingerprint and seal them permanently to the Ethereum blockchain.</p>
      </div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={"border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer " + (dragging ? "border-[#1A7A3A] bg-[#E8F5EC]" : "border-[#CBD5E1] bg-white hover:border-[#1A3A6B]")}
        onClick={() => document.getElementById("fileInput")?.click()}
      >
        <Upload className="mx-auto text-[#94A3B8] mb-3" size={32} />
        <p className="text-[#374151] font-medium text-sm">Drop files here or click to browse</p>
        <p className="text-[#94A3B8] text-xs mt-1">SSP, POA&M, audit logs, software packages</p>
        <input id="fileInput" type="file" multiple className="hidden" onChange={onFileInput} />
      </div>
      {files.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl divide-y divide-[#F1F5F9]">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#374151]">{f.name}</p>
                <p className="text-xs text-[#94A3B8]">{(f.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => removeFile(i)} className="text-[#94A3B8] hover:text-red-400 text-xs">Remove</button>
            </div>
          ))}
        </div>
      )}
      {error && <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>}
      <button
        onClick={commit}
        disabled={files.length === 0 || status === "loading"}
        className="w-full bg-[#1A7A3A] hover:bg-[#1A6A30] disabled:bg-[#94A3B8] text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2"
      >
        {status === "loading" ? <span className="flex items-center gap-2"><Loader size={16} className="animate-spin" />Sealing to blockchain...</span> : ("Seal " + (files.length > 0 ? files.length + " file" + (files.length > 1 ? "s" : "") : "package") + " to blockchain")}
      </button>
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3">
        <p className="text-[#6B7280] text-xs">Your files are hashed locally. Only the cryptographic fingerprint is sent to the blockchain.</p>
      </div>
    </div>
  );
}
