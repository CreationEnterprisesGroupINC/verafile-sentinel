import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { ethers } from "ethers";

const OCP_CONTRACT = "0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a";
const OCP_ABI = ["function record(bytes32 digest) external"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Hash each file
    const manifest: { path: string; hash: string }[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = "sha256:" + createHash("sha256").update(buffer).digest("hex");
      manifest.push({ path: file.name, hash });
    }

    // Sort for determinism
    manifest.sort((a, b) => a.path.localeCompare(b.path));

    // Merkle root
    const combined = manifest.map(e => e.path + ":" + e.hash).join("|");
    const rootHash = "sha256:" + createHash("sha256").update(combined).digest("hex");

    // Commit to blockchain
    const privateKey = process.env.SENTINEL_PRIVATE_KEY;
    const rpcUrl = process.env.SENTINEL_RPC_URL;

    if (!privateKey || !rpcUrl) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(OCP_CONTRACT, OCP_ABI, wallet);

    const hashHex = rootHash.replace("sha256:", "").padStart(64, "0");
    const hashBytes = ("0x" + hashHex) as `0x${string}`;

    const tx = await contract.record(hashBytes);
    const receipt = await tx.wait();
    const block = await provider.getBlock(receipt.blockNumber);

    const proof = {
      sentinel_version: "1.0.0",
      proof_type: "ocp-erc8281",
      root_hash: rootHash,
      manifest,
      chain: {
        name: "arbitrum-one",
        chain_id: 42161,
        contract: OCP_CONTRACT,
      },
      commitment: {
        tx_hash: receipt.hash,
        block_number: receipt.blockNumber,
        block_timestamp: new Date((block!.timestamp) * 1000).toISOString(),
        committer_address: wallet.address,
      },
      verification: {
        instructions: "Re-hash files sorted alphabetically. Compare root hash against blockchain.",
        independent_verifier: `https://arbiscan.io/tx/${receipt.hash}`,
      },
    };

    return NextResponse.json(proof);
  } catch (err: any) {
    console.error("Commit error:", err);
    return NextResponse.json({ error: err.message || "Commit failed" }, { status: 500 });
  }
}
