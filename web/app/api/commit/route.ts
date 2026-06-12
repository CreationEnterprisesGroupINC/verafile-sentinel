// app/api/commit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { ethers } from "ethers";
import { isDocumentType } from "@/lib/cmmc-mapping";

export const maxDuration = 60;
export const runtime = "nodejs";

const OCP_CONTRACT = "0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a";
const OCP_ABI = ["function record(bytes32 digest) external"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const organizationName = String(formData.get("organizationName") ?? "").trim();
    const documentType = formData.get("documentType");

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }
    if (!organizationName || organizationName.length > 200) {
      return NextResponse.json(
        { error: "Organization name is required (max 200 characters)" },
        { status: 400 }
      );
    }
    if (!isDocumentType(documentType)) {
      return NextResponse.json({ error: "Invalid or missing document type" }, { status: 400 });
    }

    const manifest: { path: string; hash: string }[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = "sha256:" + createHash("sha256").update(buffer).digest("hex");
      manifest.push({ path: file.name, hash });
    }
    manifest.sort((a, b) => a.path.localeCompare(b.path));

    // Per-package salt (hiding). The on-chain digest of a predictable document
    // set is a dictionary/confirmation-attack target; a high-entropy salt in
    // the root preimage means the public digest leaks nothing about content.
    // The salt is returned in the proof JSON, which the customer retains
    // privately — LOSING THE PROOF JSON MEANS LOSING THE SALT, and a lost
    // salt makes the anchor permanently unverifiable. The UI says this.
    const salt = randomBytes(32).toString("hex");

    // Root preimage (exact recipe, also stated in verification.instructions):
    //   salt + "|" + ("path:sha256:<hex>" entries, sorted by path, joined "|")
    const combined = salt + "|" + manifest.map((e) => e.path + ":" + e.hash).join("|");
    const rootHashHex = createHash("sha256").update(combined).digest("hex");
    const rootHash = "sha256:" + rootHashHex;

    const privateKey = process.env.SENTINEL_PRIVATE_KEY;
    const rpcUrl = process.env.SENTINEL_RPC_URL;
    if (!privateKey || !rpcUrl) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(OCP_CONTRACT, OCP_ABI, wallet);

    const hashBytes = ("0x" + rootHashHex) as `0x${string}`;

    const tx = await contract.record(hashBytes);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      return NextResponse.json({ error: "Anchoring transaction failed" }, { status: 502 });
    }
    const block = await provider.getBlock(receipt.blockNumber);

    // Position of our event within the receipt's log array (zero-indexed).
    // This is the receipt-array position, NOT the block-scoped JSON-RPC logIndex.
    const receiptLogPosition = receipt.logs.findIndex(
      (l) => l.address.toLowerCase() === OCP_CONTRACT.toLowerCase()
    );

    const proof = {
      sentinel_version: "1.1.0",
      proof_type: "ocp-erc8281-v0",
      package: {
        organization: organizationName,
        document_type: documentType,
      },
      root_hash: rootHash,
      salt, // retain privately; required to re-derive the root from the files
      manifest,
      chain: {
        name: "arbitrum-one",
        chain_id: 42161,
        contract: OCP_CONTRACT,
      },
      commitment: {
        tx_hash: receipt.hash,
        block_number: receipt.blockNumber,
        block_timestamp: block ? new Date(block.timestamp * 1000).toISOString() : null,
        committer_address: wallet.address,
        receipt_log_position: receiptLogPosition >= 0 ? receiptLogPosition : null,
      },
      // ERC-8281 alignment block. Honesty note: the deployed contract is a v0
      // OCP deployment that predates the final ERC-8281 event signature
      // (Recorded(bytes32,address)), so this proof is NOT a conformant
      // erc8281/1 envelope and ocp-verify will not accept it. It remains
      // independently verifiable via the documented procedure below. Fully
      // conformant envelopes ship with the v1 contract deployment.
      erc8281: {
        envelope_version: "sentinel-v0",
        digest: "0x" + rootHashHex,
        hash_function: "sha2-256",
        chain_id: "42161",
        contract: OCP_CONTRACT,
        tx_hash: receipt.hash,
        block_number: String(receipt.blockNumber),
        receipt_log_position:
          receiptLogPosition >= 0 ? String(receiptLogPosition) : null,
        committer: wallet.address,
        conformance_note:
          "Anchored via a v0 OCP contract predating the final ERC-8281 event signature. Not verifiable with erc8281/1 tooling (ocp-verify) until the v1 contract deployment; verify via the documented procedure in `verification`.",
      },
      verification: {
        instructions:
          "1) SHA-256 each file. 2) Sort entries by filename (ascending, code-point order). 3) Build the string: <salt> + \"|\" + entries joined with \"|\", where each entry is \"<filename>:sha256:<hex digest>\". 4) SHA-256 that string; the result is the root hash. 5) Confirm the root hash (as bytes32, 0x-prefixed) appears in the referenced transaction's event log on Arbitrum One (chain ID 42161), emitted by the contract address in this proof, at the recorded receipt log position. Any RPC endpoint or block explorer suffices; no Verafile software or cooperation is required.",
        independent_explorer: "https://arbiscan.io/tx/" + receipt.hash,
      },
    };

    return NextResponse.json(proof);
  } catch (err: any) {
    console.error("Commit error:", err);
    return NextResponse.json({ error: err.message || "Commit failed" }, { status: 500 });
  }
}
