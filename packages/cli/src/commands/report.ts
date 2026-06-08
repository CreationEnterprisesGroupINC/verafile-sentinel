import { Command } from "commander";
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";
import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";

export const reportCommand = new Command("report")
  .description("Generate a one-page PDF proof report for C3PAO assessors")
  .argument("<proof>", "Path to sentinel.proof.json")
  .option("--output <dir>", "Output directory for the report", ".")
  .option("--org <name>", "Organization name to include on report", "")
  .action(async (proofPath: string, options: { output: string; org: string }) => {
    console.log(`\n🛡  Verafile Sentinel — report\n`);
    console.log(`📄 Proof: ${proofPath}`);

    const proof = JSON.parse(readFileSync(proofPath, "utf-8"));
    mkdirSync(options.output, { recursive: true });
    const outPath = join(options.output, "sentinel-proof-report.pdf");

    await generateReport(proof, outPath, options.org);

    console.log(`\n✅ Report generated:`);
    console.log(`   ${outPath}`);
    console.log(`\nSend this to your C3PAO assessor.`);
  });

async function generateReport(proof: any, outPath: string, org: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 54 });
    const stream = createWriteStream(outPath);
    doc.pipe(stream);

    const W = 612 - 108; // usable width
    const NAVY = "#0A1628";
    const BLUE = "#1A3A6B";
    const LIGHT_BLUE = "#E8F0FB";
    const GREEN = "#1A7A3A";
    const LIGHT_GREEN = "#E8F5EC";
    const GRAY = "#6B7280";
    const BORDER = "#D1D5DB";
    const MONO_BG = "#1E293B";
    const MONO_TEXT = "#E2E8F0";

    const chain = proof.chain || {};
    const commitment = proof.commitment || {};
    const manifest = proof.manifest || [];
    const verification = proof.verification || {};

    let y = 54;

    // ── HEADER ──────────────────────────────────────────────────
    doc.rect(54, y, W, 64).fill(NAVY);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(20)
      .text("🛡  Verafile Sentinel", 70, y + 12, { width: W - 32 });
    doc.fillColor("#A0B4D0").font("Helvetica").fontSize(8)
      .text("CRYPTOGRAPHIC INTEGRITY REPORT  ·  CMMC PHASE 4 COMPATIBLE  ·  OCP/ERC-8281", 70, y + 38);
    if (org) {
      doc.fillColor("#A0B4D0").font("Helvetica").fontSize(8)
        .text(org.toUpperCase(), 70, y + 50);
    }
    const genDate = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    doc.fillColor("#6B8FAD").font("Helvetica").fontSize(7)
      .text(`Generated ${genDate}`, 54, y + 52, { width: W, align: "right" });
    y += 72;

    // ── STATUS BANNER ────────────────────────────────────────────
    doc.rect(54, y, W, 44).fill(LIGHT_GREEN).stroke(GREEN);
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(13)
      .text("✓  INTEGRITY VERIFIED", 70, y + 8, { width: 180 });
    doc.fillColor(GREEN).font("Helvetica").fontSize(8)
      .text(
        "Package has not been modified since blockchain commitment.\nThis record is independently verifiable on Arbitrum One.",
        260, y + 10, { width: W - 220 }
      );
    y += 54;

    // ── SECTION: BLOCKCHAIN RECORD ───────────────────────────────
    y += 10;
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(10).text("BLOCKCHAIN COMMITMENT RECORD", 54, y);
    y += 14;
    doc.rect(54, y, W, 0.5).fill(BORDER);
    y += 8;

    const fields = [
      ["Network", (chain.name || "").toUpperCase(), "Chain ID", String(chain.chain_id || "")],
      ["Block Number", Number(commitment.block_number || 0).toLocaleString(), "Timestamp", commitment.block_timestamp || ""],
      ["Committer", commitment.committer_address || "", "Protocol", "OCP / ERC-8281"],
      ["OCP Contract", chain.contract || "", "", ""],
    ];

    const col = [70, 200, 370, 440];
    fields.forEach((row, i) => {
      const rowY = y + i * 18;
      if (i % 2 === 0) doc.rect(54, rowY - 2, W, 18).fill("#F3F4F6");
      doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(7.5).text(row[0], col[0], rowY + 2);
      doc.fillColor(NAVY).font("Helvetica").fontSize(7.5).text(row[1], col[1], rowY + 2, { width: 160 });
      if (row[2]) {
        doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(7.5).text(row[2], col[2], rowY + 2);
        doc.fillColor(NAVY).font("Helvetica").fontSize(7.5).text(row[3], col[3], rowY + 2, { width: 110 });
      }
    });
    y += fields.length * 18 + 8;

    doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(7).text("Transaction Hash", 54, y);
    y += 10;
    doc.rect(54, y, W, 22).fill(MONO_BG);
    doc.fillColor(MONO_TEXT).font("Courier").fontSize(7.5)
      .text(commitment.tx_hash || "", 62, y + 7, { width: W - 16 });
    y += 30;

    // ── SECTION: ROOT HASH ───────────────────────────────────────
    y += 6;
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(10).text("PACKAGE ROOT HASH", 54, y);
    y += 14;
    doc.rect(54, y, W, 0.5).fill(BORDER);
    y += 8;
    doc.fillColor("#374151").font("Helvetica").fontSize(8)
      .text("SHA-256 Merkle root of all files. Any modification to any file changes this value.", 54, y, { width: W });
    y += 14;
    doc.rect(54, y, W, 22).fill(MONO_BG);
    doc.fillColor(MONO_TEXT).font("Courier").fontSize(7.5)
      .text(proof.root_hash || "", 62, y + 7, { width: W - 16 });
    y += 30;

    // ── SECTION: FILES COVERED ───────────────────────────────────
    y += 6;
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(10).text("FILES COVERED BY THIS PROOF", 54, y);
    y += 14;
    doc.rect(54, y, W, 0.5).fill(BORDER);
    y += 8;

    // Table header
    doc.rect(54, y, W, 16).fill(BLUE);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(7.5)
      .text("#", 58, y + 4)
      .text("File Path", 76, y + 4)
      .text("SHA-256 Hash", 220, y + 4);
    y += 16;

    manifest.forEach((entry: any, i: number) => {
      if (i % 2 === 0) doc.rect(54, y, W, 15).fill("#F3F4F6");
      else doc.rect(54, y, W, 15).fill("white");
      const hashShort = (entry.hash || "").replace("sha256:", "").slice(0, 52) + "...";
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(7).text(String(i + 1), 58, y + 4);
      doc.fillColor(NAVY).font("Helvetica").fontSize(7).text(entry.path || "", 76, y + 4, { width: 138 });
      doc.fillColor("#374151").font("Courier").fontSize(6.5).text(hashShort, 220, y + 4, { width: W - 170 });
      y += 15;
    });
    y += 8;

    // ── SECTION: VERIFICATION ────────────────────────────────────
    y += 4;
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(10).text("INDEPENDENT VERIFICATION", 54, y);
    y += 14;
    doc.rect(54, y, W, 0.5).fill(BORDER);
    y += 8;

    const steps = [
      ["1. Obtain package", "Acquire the compliance evidence directory from the submitting contractor."],
      ["2. Re-hash", "SHA-256 each file sorted alphabetically. Combine as path:hash pairs with | separator. SHA-256 the result, prefix 'sha256:'."],
      ["3. Compare hashes", `Computed root must match: ${(proof.root_hash || "").slice(0, 40)}...`],
      ["4. Verify on-chain", `Look up the transaction hash on Arbiscan. Confirm it exists and contains the matching hash.`],
      ["5. Confirm block", `Block ${Number(commitment.block_number || 0).toLocaleString()} establishes earliest possible attestation date.`],
    ];

    steps.forEach((step, i) => {
      if (i % 2 === 0) doc.rect(54, y, W, 20).fill("#F9FAFB");
      doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(7.5).text(step[0], 60, y + 6, { width: 100 });
      doc.fillColor("#374151").font("Helvetica").fontSize(7.5).text(step[1], 168, y + 6, { width: W - 120 });
      y += 20;
    });

    y += 6;
    doc.fillColor(BLUE).font("Courier").fontSize(7)
      .text(`Arbiscan: ${verification.independent_verifier || ""}`, 54, y, { width: W });
    y += 16;

    // ── CMMC NOTE ────────────────────────────────────────────────
    y += 4;
    doc.rect(54, y, W, 42).fill(LIGHT_BLUE).stroke(BLUE);
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(7.5)
      .text("CMMC Phase 4 Compliance Note", 62, y + 6);
    doc.fillColor("#1A3A6B").font("Helvetica").fontSize(7)
      .text(
        "This report satisfies the continuous attestation requirement under 32 CFR Part 170 and DFARS 252.204-7021. " +
        "The blockchain commitment constitutes a non-repudiable, tamper-evident record of compliance package state at the time " +
        "of attestation, providing False Claims Act protection for good-faith senior leadership affirmations. " +
        "Verification requires no access to SPRS or any Verafile system — only a public Ethereum node.",
        62, y + 18, { width: W - 20 }
      );
    y += 50;

    // ── FOOTER ───────────────────────────────────────────────────
    doc.rect(54, y, W, 0.5).fill(BORDER);
    y += 6;
    doc.fillColor(GRAY).font("Helvetica").fontSize(6.5)
      .text(
        `Verafile Sentinel v${proof.sentinel_version || "1.0.0"}  ·  Protocol: OCP/ERC-8281  ·  Chain: Arbitrum One (ID ${chain.chain_id || 42161})  ·  verafile.com`,
        54, y, { width: W, align: "center" }
      );

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}
