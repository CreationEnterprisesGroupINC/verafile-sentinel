// scripts/test-receipt-format.ts
// Run: npx tsx scripts/test-receipt-format.ts
// Validates receipt column layout against actual PowerShell Get-FileHash output.

const ALGO_WIDTH = 9;
const GAP1       = 7;
const HASH_WIDTH = 64;
const GAP2       = 1;

function row(algo: string, hash: string, path: string): string {
  return algo.padEnd(ALGO_WIDTH) + " ".repeat(GAP1) + hash.padEnd(HASH_WIDTH) + " ".repeat(GAP2) + path;
}

// Captured from actual PowerShell 7.x Get-FileHash output
const PS_HEADER = "Algorithm       Hash                                                             Path";
const PS_SEP    = "---------       ----                                                             ----"; // "----" padded to 64 chars + 1 space + "----"

const ourHeader = row("Algorithm", "Hash", "Path");
const ourSep    = row("-".repeat(ALGO_WIDTH), "----", "----"); // PowerShell: "----" padded to HASH_WIDTH

const TEST_HASH = "3B4C8A1F2E5D9C7B0A4E6F3D8B2A1C5E9D4F7A0B3E6C2D8A5F1B4E7C0D3A6F9";
const TEST_FILE = "SSP_rev14_2026.pdf";
const ourRow    = row("SHA256", TEST_HASH, `C:\\SentinelEvidence\\${TEST_FILE}`);

let pass = true;

function check(label: string, a: string, b: string) {
  const ok = a === b;
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) {
    console.log(`  Expected: ${JSON.stringify(b)}`);
    console.log(`  Got:      ${JSON.stringify(a)}`);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) { console.log(`  First diff at col ${i}`); break; }
    }
  }
}

console.log("=== Receipt Format Verification ===\n");
check("Header matches PowerShell", ourHeader, PS_HEADER);
check("Separator matches PowerShell", ourSep, PS_SEP);
check("Hash uppercase", TEST_HASH, TEST_HASH.toUpperCase());
check("Hash starts at col 16", String(ourRow.indexOf(TEST_HASH)), "16");
check("Path starts at col 81", String(ourRow.indexOf("C:\\")), "81");

console.log(`\n${pass ? "ALL CHECKS PASSED ✓" : "CHECKS FAILED ✗ — fix before shipping"}`);
process.exit(pass ? 0 : 1);
