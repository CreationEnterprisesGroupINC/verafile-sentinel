import { Command } from "commander";
import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, relative } from "path";

export const commitCommand = new Command("commit")
  .description("Hash a directory and commit it to blockchain via OCP")
  .argument("<directory>", "Path to the compliance evidence directory")
  .option("--dry-run", "Hash only, skip blockchain commit", false)
  .option("--output <dir>", "Output directory for proof files", ".")
  .action(async (directory: string, options: { dryRun: boolean; output: string }) => {
    console.log(`\n🛡  Verafile Sentinel — commit\n`);
    console.log(`📁 Directory: ${directory}`);

    const manifest = hashDirectory(directory);
    console.log(`\n✅ Root hash: ${manifest.root}`);
    console.log(`📄 Files: ${manifest.manifest.length}`);
    manifest.manifest.forEach((f: { path: string }) => console.log(`   ${f.path}`));

    if (options.dryRun) {
      console.log(`\n⚠️  Dry run — skipping blockchain commit`);
      console.log(`\nManifest:\n${JSON.stringify(manifest, null, 2)}`);
      return;
    }

    const privateKey = process.env.SENTINEL_PRIVATE_KEY;
    const rpcUrl = process.env.SENTINEL_RPC_URL;

    if (!privateKey || !rpcUrl) {
      console.error(`\n❌ Missing environment variables:`);
      console.error(`   SENTINEL_PRIVATE_KEY — your wallet private key`);
      console.error(`   SENTINEL_RPC_URL     — Arbitrum One RPC URL`);
      process.exit(1);
    }

    console.log(`\n⛓  Committing to Arbitrum One...`);

    try {
      const corePath = new URL("../../../core/dist/committer.js", import.meta.url).pathname;
      const prooferBundlerPath = new URL("../../../proofer/dist/bundler.js", import.meta.url).pathname;
      const prooferStegoPath = new URL("../../../proofer/dist/steganographer.js", import.meta.url).pathname;

      const { commitToChain } = await import(corePath);
      const commitment = await commitToChain(manifest.root, privateKey, rpcUrl);

      console.log(`✅ Committed!`);
      console.log(`   TX:    ${commitment.txHash}`);
      console.log(`   Block: ${commitment.blockNumber}`);

      const { generateProofBundle, writeProofBundle } = await import(prooferBundlerPath);
      const { generateProofPNG } = await import(prooferStegoPath);

      const bundle = generateProofBundle(manifest, commitment);
      mkdirSync(options.output, { recursive: true });
      const jsonPath = writeProofBundle(bundle, options.output);
      const pngPath = generateProofPNG(
        { chainId: commitment.chainId, contractAddress: commitment.contractAddress, txHash: commitment.txHash, sentinelVersion: 1 },
        options.output
      );

      console.log(`\n📦 Proof files written:`);
      console.log(`   ${jsonPath}`);
      console.log(`   ${pngPath}`);
      console.log(`\n✅ Done. Your compliance package is sealed.`);
    } catch (err) {
      console.error(`\n❌ Commit failed:`, err);
      process.exit(1);
    }
  });

function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return "sha256:" + createHash("sha256").update(content).digest("hex");
}

function collectFiles(dir: string, base: string): { path: string; hash: string }[] {
  const entries: { path: string; hash: string }[] = [];
  for (const item of readdirSync(dir).sort()) {
    const full = join(dir, item);
    if (statSync(full).isDirectory()) {
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
  return { root, algorithm: "sha256" as const, manifest, timestamp_local: new Date().toISOString(), sentinel_version: "1.0.0" };
}
