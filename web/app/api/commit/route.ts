import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { ethers } from "ethers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enforceAnchorLimit, recordAnchor } from "@/lib/usage";
import { isDocumentType } from "@/lib/cmmc-mapping";

export const maxDuration = 60;
export const runtime = "nodejs";

const OCP_CONTRACT = "0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a";
const OCP_ABI = ["function record(bytes32 digest) external"];

export async function POST(req: NextRequest) {
  // -------------------------------------------------------------------------
  // 1. Authentication
  // -------------------------------------------------------------------------
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in required." },
      { status: 401 }
    );
  }
  const userId = session.user.id;

  // -------------------------------------------------------------------------
  // 2. Server-side usage enforcement
  // -------------------------------------------------------------------------
  const gate = await enforceAnchorLimit(userId);
  if (!gate.user) {
    return NextResponse.json(
      { error: "user_not_found", message: "Account not found." },
      { status: 404 }
    );
  }
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: "anchor_limit_reached",
        plan: gate.user.plan,
        limit: gate.user.anchor_limit,
        upgradeUrl: "/pricing",
      },
      { status: 402 }
    );
  }

  // -------------------------------------------------------------------------
  // 3. Parse request and anchor
  // -------------------------------------------------------------------------
  let txHash: string | null = null;
  let blockNumber: number | null = null;
  let rootHash: string | null = null;
  let anchorResponse: Record<string, unknown>;

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

    const salt = randomBytes(32).toString("hex");
    const combined = salt + "|" + manifest.map((e) => e.path + ":" + e.hash).join("|");
    const rootHashHex = createHash("sha256").update(combined).digest("hex");
    rootHash = "sha256:" + rootHashHex;

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

    const receiptLogPosition = receipt.logs.findIndex(
      (l: any) => l.address.toLowerCase() === OCP_CONTRACT.toLowerCase()
    );

    txHash = receipt.hash;
    blockNumber = receipt.blockNumber;

    anchorResponse = {
      sentinel_version: "1.1.0",
      proof_type: "ocp-erc8281-v0",
      package: {
        organization: organizationName,
        document_type: documentType,
      },
      root_hash: rootHash,
      salt,
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
      erc8281: {
        envelope_version: "sentinel-v0",
        digest: "0x" + rootHashHex,
        hash_function: "sha2-256",
        chain_id: "42161",
        contract: OCP_CONTRACT,
        tx_hash: receipt.hash,
        block_number: String(receipt.blockNumber),
        receipt_log_position: receiptLogPosition >= 0 ? String(receiptLogPosition) : null,
        committer: wallet.address,
        conformance_note:
          "Anchored via a v0 OCP contract predating the final ERC-8281 event signature. Not verifiable with erc8281/1 tooling (ocp-verify) until the v1 contract deployment; verify via the documented procedure in `verification`.",
      },
      verification: {
        instructions:
          "Re-hash each file (SHA-256). Sort entries by filename. Prepend the salt. Compare root hash against blockchain.",
        independent_verifier: "https://arbiscan.io/tx/" + receipt.hash,
      },
    };
  } catch (err: any) {
    console.error("Anchoring failed:", err);
    return NextResponse.json(
      { error: "anchor_failed", message: err.message || "Anchoring failed. Try again." },
      { status: 500 }
    );
  }

  // -------------------------------------------------------------------------
  // 4. Post-anchor accounting
  // -------------------------------------------------------------------------
  try {
    const incremented = await recordAnchor({
      userId,
      txHash,
      blockNumber,
      rootHash,
      documentType: anchorResponse.package
        ? (anchorResponse.package as any).document_type
        : null,
      organizationName: anchorResponse.package
        ? (anchorResponse.package as any).organization
        : null,
      fileCount: (anchorResponse.manifest as any[])?.length ?? null,
    });
    if (!incremented) {
      console.warn(`User ${userId} exceeded limit via concurrent requests.`);
    }
  } catch (err) {
    console.error("Failed to record anchor usage:", err);
  }

  return NextResponse.json(anchorResponse);
}
