import { ethers } from "ethers";

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

const OCP_CONTRACT = "0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a";
const ARBITRUM_ONE_CHAIN_ID = 42161;

// Minimal OCP ABI — observe function only
const OCP_ABI = [
  "function record(bytes32 digest) external",
  "event Recorded(bytes32 indexed digest, address indexed recorder)"
];

export async function commitToChain(
  rootHash: string,
  privateKey: string,
  rpcUrl: string
): Promise<CommitmentRecord> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(OCP_CONTRACT, OCP_ABI, wallet);

  // Strip "sha256:" prefix, convert to bytes32
  const hashHex = rootHash.replace("sha256:", "").padStart(64, "0");
  const hashBytes = ("0x" + hashHex) as `0x${string}`;

  const tx = await contract.record(hashBytes);
  const receipt = await tx.wait();

  const block = await provider.getBlock(receipt.blockNumber);
  if (!block) throw new Error("Block not found");

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    blockTimestamp: new Date(block.timestamp * 1000).toISOString(),
    committerAddress: wallet.address,
    contractAddress: OCP_CONTRACT,
    chainId: ARBITRUM_ONE_CHAIN_ID,
    chainName: "arbitrum-one",
    rootHash,
  };
}
