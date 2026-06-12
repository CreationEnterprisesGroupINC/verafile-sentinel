// app/api/report/route.ts
// PDF generation using pdf-lib — no native binaries, no font file dependencies,
// works with Turbopack and Vercel without any outputFileTracingIncludes hacks.

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { MAPPING, STATUS_LEGEND, isDocumentType, PracticeStatus } from "@/lib/cmmc-mapping";

export const runtime = "nodejs";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const NAVY = rgb(0.102, 0.227, 0.42);
const DARK = rgb(0.039, 0.086, 0.157);
const GREEN = rgb(0.102, 0.478, 0.227);
const GRAY = rgb(0.42, 0.447, 0.502);
const LIGHT_GRAY = rgb(0.58, 0.635, 0.722);
const RULE = rgb(0.886, 0.91, 0.941);
const AMBER = rgb(0.573, 0.376, 0.039);
const WHITE = rgb(1, 1, 1);

interface ProofBody {
  sentinel_version?: string;
  package?: { organization?: string; document_type?: string };
  root_hash?: string;
  salt?: string;
  manifest?: { path: string; hash: string }[];
  chain?: { name?: string; chain_id?: number; contract?: string };
  commitment?: {
    tx_hash?: string;
    block_number?: number;
    block_timestamp?: string | null;
    committer_address?: string;
  };
  verification?: { instructions?: string; independent_explorer?: string };
  assessment_period?: string;
}

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let proof: ProofBody;
  try {
    proof = await req.json();
  } catch {
    return bad("Request body must be the sentinel proof JSON");
  }

  const org = proof.package?.organization?.trim();
  const docType = proof.package?.document_type;
  const manifest = proof.manifest;
  const c = proof.commitment;

  if (!org) return bad("Proof is missing package.organization");
  if (!isDocumentType(docType)) return bad("Proof is missing or has an invalid package.document_type");
  if (!Array.isArray(manifest) || manifest.length === 0) return bad("Proof is missing manifest");
  if (!c?.tx_hash || c.block_number === undefined) return bad("Proof is missing commitment details");
  if (!proof.root_hash) return bad("Proof is missing root_hash");

  const practices = MAPPING[docType];
  const pdfBytes = await renderReport({ proof, org, docType, practices });

  const safeOrg = org.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60) || "organization";
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeOrg}-sentinel-cmmc-report.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// PDF Rendering with pdf-lib
// ---------------------------------------------------------------------------

async function renderReport(args: {
  proof: ProofBody;
  org: string;
  docType: string;
  practices: { id: string; title: string; status: PracticeStatus; role: string }[];
}): Promise<Uint8Array> {
  const { proof, org, docType, practices } = args;
  const c = proof.commitment!;
  const manifest = proof.manifest!;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Verafile Sentinel — CMMC Compliance Proof Report — ${org}`);
  pdfDoc.setAuthor("Verafile Sentinel");
  pdfDoc.setSubject("Blockchain-anchored artifact integrity evidence (ERC-8281 / OCP)");

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const PAGE_W = 612; // US Letter
  const PAGE_H = 792;
  const ML = 56, MR = 56, MT = 56, MB = 64;
  const W = PAGE_W - ML - MR;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MT;

  // Helper: add new page
  const newPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MT;
  };

  // Helper: ensure room
  const ensureRoom = (needed: number) => {
    if (y - needed < MB) newPage();
  };

  // Helper: draw text and return new y
  const text = (
    str: string,
    x: number,
    yPos: number,
    font: typeof fontReg,
    size: number,
    color: ReturnType<typeof rgb>,
    maxWidth?: number
  ): number => {
    // Simple word wrap
    if (maxWidth) {
      const words = str.split(" ");
      let line = "";
      let cy = yPos;
      for (const word of words) {
        const test = line ? line + " " + word : word;
        const w = font.widthOfTextAtSize(test, size);
        if (w > maxWidth && line) {
          page.drawText(line, { x, y: cy, font, size, color });
          cy -= size + 3;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        page.drawText(line, { x, y: cy, font, size, color });
        cy -= size + 3;
      }
      return cy;
    }
    page.drawText(str, { x, y: yPos, font, size, color });
    return yPos - size - 3;
  };

  // Helper: horizontal rule
  const hr = (yPos: number) => {
    page.drawLine({
      start: { x: ML, y: yPos },
      end: { x: ML + W, y: yPos },
      thickness: 0.7,
      color: RULE,
    });
  };

  // Helper: section title
  const sectionTitle = (title: string): number => {
    ensureRoom(30);
    y = text(title.toUpperCase(), ML, y, fontBold, 10, NAVY);
    hr(y + 2);
    y -= 10;
    return y;
  };

  // Helper: key-value row
  const kv = (label: string, value: string, mono = false) => {
    ensureRoom(18);
    page.drawText(label, { x: ML, y, font: fontBold, size: 8.5, color: GRAY });
    const valFont = mono ? fontMono : fontReg;
    // Truncate long values
    const maxValW = W - 140;
    let val = value;
    while (val.length > 10 && valFont.widthOfTextAtSize(val, 8) > maxValW) {
      val = val.slice(0, -4) + "...";
    }
    page.drawText(val, { x: ML + 140, y, font: valFont, size: 8, color: DARK });
    y -= 14;
  };

  // ---------------------------------------------------------------------------
  // Header band
  // ---------------------------------------------------------------------------
  page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: NAVY });

  y = PAGE_H - MT - 10;
  y = text("Verafile Sentinel", ML, y, fontBold, 20, NAVY);
  y = text("CMMC Level 2 Compliance Proof Report", ML, y, fontReg, 10, GRAY);
  y = text("Blockchain-anchored artifact integrity evidence — ERC-8281 (Observation Commitment Protocol)", ML, y, fontReg, 7.5, LIGHT_GRAY, W);
  hr(y + 2);
  y -= 12;

  // ---------------------------------------------------------------------------
  // Report metadata
  // ---------------------------------------------------------------------------
  kv("Organization", org);
  kv("Document type", docType);
  kv("Report date", new Date().toISOString().slice(0, 10) + " (UTC)");
  kv("Assessment period", proof.assessment_period?.trim() || "Not specified — see anchor timestamp below");
  kv("Sentinel version", proof.sentinel_version || "—");
  y -= 6;

  // ---------------------------------------------------------------------------
  // Blockchain anchor
  // ---------------------------------------------------------------------------
  sectionTitle("Blockchain Anchor");
  kv("Network", `${proof.chain?.name ?? "arbitrum-one"} (chain ID ${proof.chain?.chain_id ?? 42161})`, true);
  kv("Contract", proof.chain?.contract ?? "—", true);
  kv("Transaction", c.tx_hash!, true);
  kv("Block", String(c.block_number), true);
  kv("Anchor timestamp (UTC)", c.block_timestamp ?? "—", true);
  kv("Committer", c.committer_address ?? "—", true);
  kv("Root hash", proof.root_hash!, true);

  const explorerUrl = proof.verification?.independent_explorer ?? `https://arbiscan.io/tx/${c.tx_hash}`;
  ensureRoom(16);
  page.drawText("Public record: " + explorerUrl, { x: ML, y, font: fontReg, size: 8, color: NAVY });
  y -= 16;

  // ---------------------------------------------------------------------------
  // Files anchored
  // ---------------------------------------------------------------------------
  sectionTitle(`Files Anchored (${manifest!.length})`);
  for (const entry of manifest!) {
    ensureRoom(28);
    y = text(entry.path, ML, y, fontBold, 8.5, DARK, W);
    y = text(entry.hash, ML + 12, y, fontMono, 7, GRAY, W - 12);
    y -= 4;
  }
  y -= 6;

  // ---------------------------------------------------------------------------
  // CMMC practices evidenced
  // ---------------------------------------------------------------------------
  sectionTitle("CMMC Level 2 Practices Evidenced");
  y = text(
    "Relationship categories follow the Verafile Sentinel CMMC L2 Mapping (v1.1). No single product satisfies a CMMC practice by being purchased; practices are organizational requirements assessed against NIST SP 800-171A objectives.",
    ML, y, fontReg, 7.5, GRAY, W
  );
  y -= 8;

  for (const pr of practices) {
    ensureRoom(60);
    // Draw checkmark (vector strokes — no glyph dependency)
    const ckX = ML + 2;
    const ckY = y - 4;
    page.drawLine({ start: { x: ckX, y: ckY - 3 }, end: { x: ckX + 3.5, y: ckY - 7 }, thickness: 1.5, color: GREEN });
    page.drawLine({ start: { x: ckX + 3.5, y: ckY - 7 }, end: { x: ckX + 10, y: ckY }, thickness: 1.5, color: GREEN });

    y = text(`${pr.id} — ${pr.status}`, ML + 18, y, fontBold, 9, DARK, W - 18);
    y = text(pr.title, ML + 18, y, fontOblique, 8, GRAY, W - 18);
    y = text(pr.role, ML + 18, y, fontReg, 8, DARK, W - 18);
    y -= 8;
  }
  y -= 4;

  // Status legend
  ensureRoom(40);
  y = text("Category definitions:", ML, y, fontBold, 8, GRAY);
  for (const [status, def] of Object.entries(STATUS_LEGEND)) {
    ensureRoom(16);
    y = text(`${status}: ${def}`, ML, y, fontReg, 7.5, GRAY, W);
  }
  y -= 8;

  // ---------------------------------------------------------------------------
  // Independent verification
  // ---------------------------------------------------------------------------
  sectionTitle("Independent Verification");
  y = text(
    "This proof is verifiable by any third party — including a C3PAO assessor — using only public blockchain data. No Verafile software, account, or cooperation is required, and verification does not depend on Verafile's continued existence. Procedure: (1) compute the SHA-256 digest of each anchored file; (2) sort entries by filename and reconstruct the root preimage using the salt retained in the proof JSON; (3) compute the SHA-256 root and confirm it matches the root hash above; (4) confirm the root hash appears in the referenced transaction's event log on Arbitrum One, emitted by the contract address above. Any RPC endpoint or block explorer suffices; for evidentiary use, cross-check a second independent endpoint. The salt in the retained proof JSON is required for verification — treat the proof JSON as part of the evidence record and include it in backups.",
    ML, y, fontReg, 8.5, DARK, W
  );
  y -= 10;

  // ---------------------------------------------------------------------------
  // Scope of evidence
  // ---------------------------------------------------------------------------
  sectionTitle("Scope of This Evidence");
  y = text(
    "This anchor establishes that the files listed above existed, in exactly the states identified by their digests, no later than the anchor timestamp, and that any subsequent modification is cryptographically detectable. It does not independently establish when the underlying events occurred (an anchor bounds when an artifact existed, not when the activity it documents took place), does not evaluate the content of the documents, and does not constitute CMMC certification or assessment. Practice satisfaction is determined by the organization's implementation as a whole and assessed by the cognizant C3PAO against NIST SP 800-171A objectives.",
    ML, y, fontReg, 8.5, DARK, W
  );
  y -= 10;

  // ---------------------------------------------------------------------------
  // Disclaimer
  // ---------------------------------------------------------------------------
  ensureRoom(60);
  y = text(
    "Disclaimer: This report is generated documentation accompanying a cryptographic proof; it is not compliance, legal, or certification advice, and it has not been reviewed by an assessor. The cryptographic proof — not this report — is the evidence. Anchoring was performed via a v0 OCP contract deployment; this proof verifies via the documented procedure above and will be supplemented with ERC-8281 (erc8281/1) conformant envelopes following the v1 contract deployment.",
    ML, y, fontOblique, 7.5, AMBER, W
  );

  // ---------------------------------------------------------------------------
  // Footer on all pages
  // ---------------------------------------------------------------------------
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawText(
      `Verafile Sentinel — ${org} — ${docType}    |    Page ${i + 1} of ${pages.length}`,
      { x: ML, y: MB - 16, font: fontReg, size: 7, color: LIGHT_GRAY }
    );
  });

  return await pdfDoc.save();
}
