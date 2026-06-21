// lib/receipt.ts
//
// DoD-format receipt text generator — shared between the Railway worker
// (which stores to S3 on confirmation) and /api/receipt (which generates
// on-demand from a proof JSON).
//
// Column layout verified against PowerShell 7.x Get-FileHash output:
//   col  0: Algorithm (9 chars)
//   col  9: 7-space gap
//   col 16: Hash (64 hex chars uppercase, padded to 64)
//   col 80: 1-space gap
//   col 81: Path (Windows backslash format)

// Exact column constants — do not change without re-running test-receipt-format.ts
const ALGO_WIDTH = 9;
const GAP1       = 7;
const HASH_WIDTH = 64;
const GAP2       = 1;

function row(algo: string, hash: string, path: string): string {
  return (
    algo.padEnd(ALGO_WIDTH) +
    " ".repeat(GAP1) +
    hash.padEnd(HASH_WIDTH) +
    " ".repeat(GAP2) +
    path
  );
}

export const PS_HEADER = row("Algorithm", "Hash", "Path");
export const PS_SEP    = row("-".repeat(ALGO_WIDTH), "----", "----");

export interface ReceiptParams {
  manifest: { path: string; hash: string }[];
  organization: string;
  documentType: string;
  txHash: string;
  blockNumber: number;
  blockTimestamp: string | null;
  rootHash: string;
  chain: string;
  contract: string;
}

export function generateReceiptText(params: ReceiptParams): string {
  const {
    manifest,
    organization,
    documentType,
    txHash,
    blockNumber,
    blockTimestamp,
    rootHash,
    chain,
    contract,
  } = params;

  const lines: string[] = [];

  // Sentinel metadata header
  lines.push("VERAFILE SENTINEL — CMMC EVIDENCE RECEIPT");
  lines.push("=".repeat(78));
  lines.push(`Organization   : ${organization}`);
  lines.push(`Document type  : ${documentType}`);
  lines.push(`Chain          : ${chain}`);
  lines.push(`Contract       : ${contract}`);
  lines.push(`Transaction    : ${txHash}`);
  lines.push(`Block          : ${blockNumber}`);
  lines.push(`Anchor time    : ${blockTimestamp ?? "—"} UTC`);
  lines.push(`Root hash      : ${rootHash}`);
  lines.push(`Generated      : ${new Date().toISOString()} UTC`);
  lines.push("");
  lines.push("INTEGRITY NOTE: Each file digest below was committed to the blockchain as part");
  lines.push("of the root hash above. Any modification after the anchor timestamp is");
  lines.push("cryptographically detectable. Verification: see sentinel.proof.json.");
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("");

  // PowerShell Get-FileHash format
  lines.push(PS_HEADER);
  lines.push(PS_SEP);

  for (const entry of manifest) {
    const rawHex = entry.hash.startsWith("sha256:")
      ? entry.hash.slice(7).toUpperCase()
      : entry.hash.toUpperCase();
    const winPath = `C:\\SentinelEvidence\\${entry.path.replace(/\//g, "\\")}`;
    lines.push(row("SHA256", rawHex, winPath));
  }

  lines.push("");
  lines.push("");

  // Verification footer
  lines.push("=".repeat(78));
  lines.push("INDEPENDENT VERIFICATION");
  lines.push("=".repeat(78));
  lines.push("");
  lines.push("To verify this receipt independently without Verafile:");
  lines.push("");
  lines.push("  1. Compute the SHA-256 digest of each file listed above.");
  lines.push("  2. Compare each digest to the hash in this receipt.");
  lines.push("  3. Open the sentinel.proof.json file accompanying this receipt.");
  lines.push("  4. Reconstruct the root preimage:");
  lines.push("       {salt}|{filename1}:sha256:{hash1}|{filename2}:sha256:{hash2}|...");
  lines.push("       (entries sorted alphabetically by filename, lowercase hashes)");
  lines.push("  5. SHA-256 the preimage string. Compare to root_hash in the proof.");
  lines.push(`  6. Confirm the root hash appears on-chain:`);
  lines.push(`       ${chain} — ${contract}`);
  lines.push(`       Transaction: ${txHash}`);
  lines.push(`       Block explorer: https://basescan.org/tx/${txHash}`);
  lines.push("");
  lines.push("No Verafile software, account, or cooperation is required.");
  lines.push("This evidence is permanently verifiable against the public blockchain.");
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("Verafile Sentinel | ERC-8281 Observation Commitment Protocol");
  lines.push("damon@ocp-labs.org | verafilecorporation.com");
  lines.push("=".repeat(78));

  return lines.join("\r\n");
}
