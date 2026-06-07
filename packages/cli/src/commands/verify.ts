import { Command } from "commander";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

export const verifyCommand = new Command("verify")
  .description("Verify a directory against its on-chain commitment")
  .argument("<directory>", "Path to the compliance evidence directory")
  .argument("<proof>", "Path to sentinel.proof.json")
  .action(async (directory: string, proofPath: string) => {
    console.log(`\n🛡  Verafile Sentinel — verify\n`);
    console.log(`📁 Directory: ${directory}`);
    console.log(`📄 Proof:     ${proofPath}`);

    const proof = JSON.parse(readFileSync(proofPath, "utf-8"));
    const rpcUrl = process.env.SENTINEL_RPC_URL;

    if (!rpcUrl) {
      console.error(`\n❌ Missing SENTINEL_RPC_URL environment variable`);
      process.exit(1);
    }

    // Re-hash locally
    const localManifest = hashDirectory(directory);
    const localRoot = localManifest.root;
    const onChainRoot = proof.root_hash;

    console.log(`\n🔍 Local root:    ${localRoot}`);
    console.log(`⛓  On-chain root: ${onChainRoot}`);

    if (localRoot !== onChainRoot) {
      console.error(`\n❌ INTEGRITY FAILURE — package has been modified since commitment`);
      process.exit(1);
    }

    // Verify tx exists on chain
    try {
      const { ethers } = await import(/* @ts-ignore */ "ethers");
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(proof.commitment.tx_hash);
      if (!receipt) {
        console.error(`\n❌ Transaction not found on chain: ${proof.commitment.tx_hash}`);
        process.exit(1);
      }
      console.log(`\n✅ PASS — integrity verified`);
      console.log(`   TX confirmed at block ${receipt.blockNumber}`);
      console.log(`   Arbiscan: https://arbiscan.io/tx/${proof.commitment.tx_hash}`);
    } catch (err) {
      console.error(`\n❌ Chain verification failed:`, err);
      process.exit(1);
    }
  });

function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return "sha256:" + createHash("sha256").update(content).digest("hex");
}

function collectFiles(dir: string, base: string): { path: string; hash: string }[] {
  const entries: { path: string; hash: string }[] = [];
  const items = readdirSync(dir).sort();
  for (const item of items) {
    const full = join(dir, item);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      entries.push(...collectFiles(full, base));
    } else {
      entries.push({ path: relative(base, full), hash: hashFile(full) });
    }
  }
  return entries;
}

function hashDirectory(dirPath: string) {
  const manifest = collectFiles(dirPath, dirPath);
  const combined = manifest.map((e) => e.path + ":" + e.hash).join("|");
  const root = "sha256:" + createHash("sha256").update(combined).digest("hex");
  return { root, manifest };
}
