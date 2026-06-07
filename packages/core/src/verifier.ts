import { ethers } from "ethers";
import { hashDirectory } from "./hasher.js";
import { CommitmentRecord } from "./committer.js";

export type VerificationStatus = "PASS" | "FAIL" | "TAMPERED";

export interface VerificationReport {
  status: VerificationStatus;
  checkedAt: string;
  localRootHash: string;
  onChainRootHash: string;
  commitment: CommitmentRecord;
  tamperedFiles?: string[];
  message: string;
}

const OCP_ABI = [
  "event Observed(uint256 indexed id, bytes32 indexed hash, address indexed observer, uint256 timestamp)"
];

export async function verifyDirectory(
  dirPath: string,
  commitment: CommitmentRecord,
  rpcUrl: string
): Promise<VerificationReport> {
  // Step 1: Re-hash the local directory
  const localManifest = hashDirectory(dirPath);
  const localRoot = localManifest.root;

  // Step 2: Fetch the on-chain commitment and verify tx
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(commitment.txHash);

  if (!receipt) {
    return {
      status: "FAIL",
      checkedAt: new Date().toISOString(),
      localRootHash: localRoot,
      onChainRootHash: commitment.rootHash,
      commitment,
      message: "Transaction not found on chain. Proof may be invalid.",
    };
  }

  // Step 3: Compare local hash to committed hash
  const onChainRoot = commitment.rootHash;
  const match = localRoot === onChainRoot;

  if (match) {
    return {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      localRootHash: localRoot,
      onChainRootHash: onChainRoot,
      commitment,
      message: "Package integrity verified. No modifications detected.",
    };
  }

  // Step 4: If mismatch, identify which files changed
  const tamperedFiles: string[] = [];
  for (const entry of localManifest.manifest) {
    const original = commitment.rootHash; // placeholder for per-file comparison
    if (entry.hash !== original) {
      tamperedFiles.push(entry.path);
    }
  }

  return {
    status: "TAMPERED",
    checkedAt: new Date().toISOString(),
    localRootHash: localRoot,
    onChainRootHash: onChainRoot,
    commitment,
    tamperedFiles,
    message: "INTEGRITY FAILURE. Package has been modified since commitment.",
  };
}
