import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { ethers } from "ethers";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const proofFile = formData.get("proof") as File;

    if (files.length === 0 || !proofFile) {
      return NextResponse.json({ error: "Files and proof required" }, { status: 400 });
    }

    // Parse proof
    const proofText = await proofFile.text();
    const proof = JSON.parse(proofText);
    const onChainRoot = proof.root_hash;

    // Re-hash the uploaded files
    const manifest: { path: string; hash: string }[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = "sha256:" + createHash("sha256").update(buffer).digest("hex");
      manifest.push({ path: file.name, hash });
    }
    manifest.sort((a, b) => a.path.localeCompare(b.path));

    const combined = manifest.map(e => e.path + ":" + e.hash).join("|");
    const localRoot = "sha256:" + createHash("sha256").update(combined).digest("hex");

    // Compare hashes
    if (localRoot !== onChainRoot) {
      return NextResponse.json({ status: "FAIL", localRoot, onChainRoot });
    }

    // Verify tx on chain
    const rpcUrl = process.env.SENTINEL_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const receipt = await provider.getTransactionReceipt(proof.commitment.tx_hash);

    if (!receipt) {
      return NextResponse.json({ status: "FAIL", error: "Transaction not found on chain" });
    }

    return NextResponse.json({
      status: "PASS",
      localRoot,
      onChainRoot,
      txHash: proof.commitment.tx_hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (err: any) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: err.message || "Verification failed" }, { status: 500 });
  }
}
