import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export interface CommitmentRecord {
  txHash: string;
  blockNumber: number;
  blockTimestamp: string;
  committerAddress: string;
  contractAddress: string;
  chainId: number;
  chainName: string;
  rootHash: string;
}

export interface HashManifest {
  root: string;
  algorithm: "sha256";
  manifest: { path: string; hash: string }[];
  timestamp_local: string;
  sentinel_version: string;
}

export interface ProofBundle {
  sentinel_version: string;
  proof_type: string;
  root_hash: string;
  manifest_hash: string;
  chain: {
    name: string;
    chain_id: number;
    contract: string;
  };
  commitment: {
    tx_hash: string;
    block_number: number;
    block_timestamp: string;
    committer_address: string;
  };
  verification: {
    instructions: string;
    independent_verifier: string;
  };
}

export function generateProofBundle(
  manifest: HashManifest,
  commitment: CommitmentRecord
): ProofBundle {
  return {
    sentinel_version: "1.0.0",
    proof_type: "ocp-erc8281",
    root_hash: commitment.rootHash,
    manifest_hash: manifest.root,
    chain: {
      name: commitment.chainName,
      chain_id: commitment.chainId,
      contract: commitment.contractAddress,
    },
    commitment: {
      tx_hash: commitment.txHash,
      block_number: commitment.blockNumber,
      block_timestamp: commitment.blockTimestamp,
      committer_address: commitment.committerAddress,
    },
    verification: {
      instructions:
        "Re-hash the target directory using SHA-256 Merkle. Compare root hash against on-chain commitment at the tx_hash above.",
      independent_verifier: `https://arbiscan.io/tx/${commitment.txHash}`,
    },
  };
}

export function writeProofBundle(
  bundle: ProofBundle,
  outputDir: string
): string {
  mkdirSync(outputDir, { recursive: true });
  const outPath = join(outputDir, "sentinel.proof.json");
  writeFileSync(outPath, JSON.stringify(bundle, null, 2));
  return outPath;
}
