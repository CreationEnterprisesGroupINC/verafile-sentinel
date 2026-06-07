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
  "function observe(bytes32 hash) external returns (uint256 id)",
  "event Observed(uint256 indexed id, bytes32 indexed hash, address indexed observer, uint256 timestamp)"
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
  const hashHex = rootHash.replace("sha256:", "");
  const hashBytes = ethers.zeroPadValue("0x" + hashHex, 32);

  const tx = await contract.observe(hashBytes);
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
