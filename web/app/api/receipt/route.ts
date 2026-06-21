// app/api/receipt/route.ts
// On-demand DoD-format receipt generator from a proof JSON.
// Column layout verified against PowerShell Get-FileHash output.
// See lib/receipt.ts for the shared generator used by the worker.

import { NextRequest, NextResponse } from "next/server";
import { generateReceiptText } from "@/lib/receipt";

export const runtime = "nodejs";

interface ProofBody {
  package?: { organization?: string; document_type?: string };
  manifest?: { path: string; hash: string }[];
  root_hash?: string;
  chain?: { name?: string; chain_id?: number; contract?: string };
  commitment?: {
    tx_hash?: string;
    block_number?: number;
    block_timestamp?: string | null;
  };
}

export async function POST(req: NextRequest) {
  let proof: ProofBody;
  try {
    proof = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be the sentinel proof JSON" }, { status: 400 });
  }

  const org = proof.package?.organization?.trim();
  const docType = proof.package?.document_type?.trim();
  const manifest = proof.manifest;
  const c = proof.commitment;

  if (!org) return NextResponse.json({ error: "Missing package.organization" }, { status: 400 });
  if (!docType) return NextResponse.json({ error: "Missing package.document_type" }, { status: 400 });
  if (!Array.isArray(manifest) || manifest.length === 0)
    return NextResponse.json({ error: "Missing or empty manifest" }, { status: 400 });
  if (!c?.tx_hash || c.block_number === undefined)
    return NextResponse.json({ error: "Missing commitment details" }, { status: 400 });
  if (!proof.root_hash)
    return NextResponse.json({ error: "Missing root_hash" }, { status: 400 });

  const receiptText = generateReceiptText({
    manifest,
    organization: org,
    documentType: docType,
    txHash: c.tx_hash,
    blockNumber: c.block_number,
    blockTimestamp: c.block_timestamp ?? null,
    rootHash: proof.root_hash,
    chain: proof.chain?.name ?? "base-mainnet",
    contract: proof.chain?.contract ?? "",
  });

  const safeOrg = org.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60) || "organization";

  return new NextResponse(receiptText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeOrg}-sentinel-receipt.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
