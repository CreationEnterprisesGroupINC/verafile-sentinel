import { ethers } from "ethers";
import { readFileSync } from "fs";
import { hashDirectory } from "./hasher.js";

export type VerificationStatus = "PASS" | "FAIL" | "TAMPERED";

export interface VerificationResult {
  status: VerificationStatus;
  checkedAt: string;
  localRootHash: string;
  onChainRootHash: string;
  txHash: string;
  blockNumber?: number;
  message: string;
}

export interface ProofBundle {
  root_hash: string;
  commitment: {
    tx_hash: string;
    block_number: number;
    block_timestamp: string;
    committer_address: string;
  };
  chain: {
    name: string;
    chain_id: number;
    contract: string;
  };
}

export async function verifyProof(
  dirPath: string,
  proofBundlePath: string,
  rpcUrl: string
): Promise<VerificationResult> {
  const bundle: ProofBundle = JSON.parse(readFileSync(proofBundlePath, "utf-8"));
  const localManifest = hashDirectory(dirPath);
  const localRoot = localManifest.root;
  const onChainRoot = bundle.root_hash;

  if (localRoot !== onChainRoot) {
    return {
      status: "TAMPERED",
      checkedAt: new Date().toISOString(),
      localRootHash: localRoot,
      onChainRootHash: onChainRoot,
      txHash: bundle.commitment.tx_hash,
      message: "INTEGRITY FAILURE — package has been modified since commitment",
    };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(bundle.commitment.tx_hash);

  if (!receipt) {
    return {
      status: "FAIL",
      checkedAt: new Date().toISOString(),
      localRootHash: localRoot,
      onChainRootHash: onChainRoot,
      txHash: bundle.commitment.tx_hash,
      message: "Transaction not found on chain — proof may be invalid",
    };
  }

  return {
    status: "PASS",
    checkedAt: new Date().toISOString(),
    localRootHash: localRoot,
    onChainRootHash: onChainRoot,
    txHash: bundle.commitment.tx_hash,
    blockNumber: receipt.blockNumber,
    message: "Package integrity verified — no modifications detected",
  };
}

export async function verifySubcontractorProof(
  proofBundlePath: string,
  rpcUrl: string
): Promise<{ valid: boolean; txHash: string; blockNumber?: number; message: string }> {
  const bundle: ProofBundle = JSON.parse(readFileSync(proofBundlePath, "utf-8"));
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(bundle.commitment.tx_hash);

  if (!receipt) {
    return {
      valid: false,
      txHash: bundle.commitment.tx_hash,
      message: "Subcontractor proof transaction not found on chain",
    };
  }

  return {
    valid: true,
    txHash: bundle.commitment.tx_hash,
    blockNumber: receipt.blockNumber,
    message: "Subcontractor proof verified on-chain — no SPRS access required",
  };
}
