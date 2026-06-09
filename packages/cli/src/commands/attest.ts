import { Command } from "commander";
import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, relative } from "path";

export const attestCommand = new Command("attest")
  .description("Commit with named affiant — satisfies CMMC annual senior leadership attestation")
  .argument("<directory>", "Path to the compliance evidence directory")
  .requiredOption("--affiant <address>", "Ethereum address of the affirming official")
  .requiredOption("--role <role>", "Role of affirming official (e.g. CISO, CEO)")
  .option("--output <dir>", "Output directory for proof files", ".")
  .action(async (directory: string, options: { affiant: string; role: string; output: string }) => {
    console.log(`\n🛡  Verafile Sentinel — attest\n`);
    console.log(`📁 Directory: ${directory}`);
    console.log(`👤 Affiant:   ${options.affiant}`);
    console.log(`🏷  Role:      ${options.role}`);

    const privateKey = process.env.SENTINEL_PRIVATE_KEY;
    const rpcUrl = process.env.SENTINEL_RPC_URL;

    if (!privateKey || !rpcUrl) {
      console.error(`\n❌ Missing SENTINEL_PRIVATE_KEY or SENTINEL_RPC_URL`);
      process.exit(1);
    }

    const manifest = hashDirectory(directory);
    console.log(`\n✅ Root hash: ${manifest.root}`);
    console.log(`⛓  Submitting attestation to Arbitrum One...`);

    try {
      const corePath = new URL("../../../core/dist/committer.js", import.meta.url).pathname;
      const prooferBundlerPath = new URL("../../../proofer/dist/bundler.js", import.meta.url).pathname;
      const prooferStegoPath = new URL("../../../proofer/dist/steganographer.js", import.meta.url).pathname;

      const { commitToChain } = await import(corePath);
      const commitment = await commitToChain(manifest.root, privateKey, rpcUrl);

      const { generateProofBundle, writeProofBundle } = await import(prooferBundlerPath);
      const { generateProofPNG } = await import(prooferStegoPath);

      const bundle = {
        ...generateProofBundle(manifest, commitment),
        affiant: { address: options.affiant, role: options.role, attestation_type: "annual-cmmc-affirmation" },
      };

      mkdirSync(options.output, { recursive: true });
      const jsonPath = writeProofBundle(bundle, options.output);
      const pngPath = generateProofPNG(
        { chainId: commitment.chainId, contractAddress: commitment.contractAddress, txHash: commitment.txHash, sentinelVersion: 1 },
        options.output
      );

      console.log(`\n✅ Attestation committed!`);
      console.log(`   TX:    ${commitment.txHash}`);
      console.log(`   Block: ${commitment.blockNumber}`);
      console.log(`\n📦 Proof files:`);
      console.log(`   ${jsonPath}`);
      console.log(`   ${pngPath}`);
      console.log(`\n✅ CMMC annual affirmation sealed on-chain.`);
    } catch (err) {
      console.error(`\n❌ Attestation failed:`, err);
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
