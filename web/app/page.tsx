"use client";
import { useState } from "react";
import CommitPage from "./components/CommitPage";
import VerifyPage from "./components/VerifyPage";

const PASSWORD = "sentinel2028";

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<"commit" | "verify">("commit");

  const handleLogin = () => {
    if (input === PASSWORD) {
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="text-4xl mb-3">🛡</div>
            <h1 className="text-3xl font-bold text-white font-serif">Verafile Sentinel</h1>
            <p className="text-[#8BADD4] mt-2 text-sm">Your compliance, sealed.</p>
          </div>
          <div className="bg-[#132240] border border-[#2A4A7F] rounded-xl p-8">
            <label className="block text-[#8BADD4] text-sm font-medium mb-2">
              Access Password
            </label>
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter password"
              className="w-full bg-[#0A1628] border border-[#2A4A7F] rounded-lg px-4 py-3 text-white placeholder-[#4A6A9F] focus:outline-none focus:border-[#1A7A3A] text-sm"
            />
            {error && (
              <p className="text-red-400 text-xs mt-2">Incorrect password. Try again.</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full mt-4 bg-[#1A7A3A] hover:bg-[#1A6A30] text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              Enter
            </button>
          </div>
          <p className="text-center text-[#4A6A9F] text-xs mt-6">
            Powered by OCP / ERC-8281 · Arbitrum One
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-[#0A1628] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡</span>
          <div>
            <h1 className="text-white font-bold font-serif text-lg">Verafile Sentinel</h1>
            <p className="text-[#8BADD4] text-xs">Cryptographic proof of integrity</p>
          </div>
        </div>
        <div className="flex gap-1 bg-[#132240] rounded-lg p-1">
          <button
            onClick={() => setTab("commit")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "commit"
                ? "bg-[#1A7A3A] text-white"
                : "text-[#8BADD4] hover:text-white"
            }`}
          >
            Commit
          </button>
          <button
            onClick={() => setTab("verify")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "verify"
                ? "bg-[#1A3A6B] text-white"
                : "text-[#8BADD4] hover:text-white"
            }`}
          >
            Verify
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-10">
        {tab === "commit" ? <CommitPage /> : <VerifyPage />}
      </div>
    </div>
  );
}
