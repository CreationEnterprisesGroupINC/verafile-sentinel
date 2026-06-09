import { Command } from "commander";
import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync } from "fs";
import { join, relative } from "path";

export interface SBOMEntry {
  name: string;
  version: string;
  license?: string;
  hash?: string;
}

export interface SBOMManifest {
  sbom_version: string;
  software_name: string;
  software_version: string;
  generated_at: string;
  components: SBOMEntry[];
  sbom_hash: string;
  files_root_hash: string;
  combined_root_hash: string;
}

export const sbomCommand = new Command("sbom")
  .description("Commit a software package + SBOM dependency tree to blockchain")
  .argument("<directory>", "Path to the software package directory")
  .requiredOption("--sbom <file>", "Path to sbom.json file")
  .option("--output <dir>", "Output directory for proof files", ".")
  .option("--dry-run", "Hash only, skip blockchain commit", false)
  .option("--software-name <name>", "Name of the software package", "")
  .option("--software-version <version>", "Version of the software package", "")
  .action(async (directory: string, options: {
    sbom: string;
    output: string;
    dryRun: boolean;
    softwareName: string;
    softwareVersion: string;
  }) => {
    console.log(`\n🛡  Verafile Sentinel — sbom\n`);
    console.log(`📁 Directory: ${directory}`);
    console.log(`📋 SBOM:      ${options.sbom}`);

    // Step 1: Hash the software files
    const fileManifest = hashDirectory(directory);
    console.log(`\n✅ Files root hash: ${fileManifest.root}`);
    console.log(`📄 Files: ${fileManifest.manifest.length}`);

    // Step 2: Parse and hash the SBOM
    if (!existsSync(options.sbom)) {
      console.error(`\n❌ SBOM file not found: ${options.sbom}`);
      process.exit(1);
    }

    let sbomData: any;
    try {
      sbomData = JSON.parse(readFileSync(options.sbom, "utf-8"));
    } catch (e) {
      console.error(`\n❌ Failed to parse SBOM JSON: ${e}`);
      process.exit(1);
    }

    // Support CycloneDX, SPDX, and simple custom formats
    const components = extractComponents(sbomData);
    console.log(`\n📦 SBOM components: ${components.length}`);
    components.slice(0, 5).forEach(c => console.log(`   ${c.name}@${c.version}`));
    if (components.length > 5) console.log(`   ... and ${components.length - 5} more`);

    // Hash the SBOM content
    const sbomContent = readFileSync(options.sbom);
    const sbomHash = "sha256:" + createHash("sha256").update(sbomContent).digest("hex");

    // Combined hash — covers both files AND dependency tree
    const combined = fileManifest.root + "|sbom:" + sbomHash;
    const combinedRoot = "sha256:" + createHash("sha256").update(combined).digest("hex");

    console.log(`\n✅ SBOM hash:     ${sbomHash}`);
    console.log(`✅ Combined root: ${combinedRoot}`);
    console.log(`\n   The combined root covers:`);
    console.log(`   → All ${fileManifest.manifest.length} software files`);
    console.log(`   → All ${components.length} SBOM dependencies`);

    if (options.dryRun) {
      console.log(`\n⚠️  Dry run — skipping blockchain commit`);
      return;
    }

    const privateKey = process.env.SENTINEL_PRIVATE_KEY;
    const rpcUrl = process.env.SENTINEL_RPC_URL;

    if (!privateKey || !rpcUrl) {
      console.error(`\n❌ Missing SENTINEL_PRIVATE_KEY or SENTINEL_RPC_URL`);
      process.exit(1);
    }

    console.log(`\n⛓  Committing combined hash to Arbitrum One...`);

    try {
      const corePath = new URL("../../../core/dist/committer.js", import.meta.url).pathname;
      const prooferBundlerPath = new URL("../../../proofer/dist/bundler.js", import.meta.url).pathname;
      const prooferStegoPath = new URL("../../../proofer/dist/steganographer.js", import.meta.url).pathname;

      const { commitToChain } = await import(corePath);
      const commitment = await commitToChain(combinedRoot, privateKey, rpcUrl);

      console.log(`✅ Committed!`);
      console.log(`   TX:    ${commitment.txHash}`);
      console.log(`   Block: ${commitment.blockNumber}`);

      const { generateProofBundle, writeProofBundle } = await import(prooferBundlerPath);
      const { generateProofPNG } = await import(prooferStegoPath);

      const bundle = {
        ...generateProofBundle({ root: combinedRoot, algorithm: "sha256" as const, manifest: fileManifest.manifest, timestamp_local: new Date().toISOString(), sentinel_version: "1.0.0" }, commitment),
        sbom: {
          sbom_hash: sbomHash,
          files_root_hash: fileManifest.root,
          combined_root_hash: combinedRoot,
          component_count: components.length,
          software_name: options.softwareName,
          software_version: options.softwareVersion,
          components: components.slice(0, 50), // top 50 in proof
        },
      };

      mkdirSync(options.output, { recursive: true });
      const jsonPath = writeProofBundle(bundle, options.output);
      const pngPath = generateProofPNG(
        { chainId: commitment.chainId, contractAddress: commitment.contractAddress, txHash: commitment.txHash, sentinelVersion: 1 },
        options.output
      );

      console.log(`\n📦 Proof files written:`);
      console.log(`   ${jsonPath}`);
      console.log(`   ${pngPath}`);
      console.log(`\n✅ Done. Software package + dependency tree sealed on-chain.`);
      console.log(`\n   Arbiscan: https://arbiscan.io/tx/${commitment.txHash}`);
    } catch (err) {
      console.error(`\n❌ Commit failed:`, err);
      process.exit(1);
    }
  });

function extractComponents(sbom: any): SBOMEntry[] {
  // CycloneDX format
  if (sbom.components) {
    return sbom.components.map((c: any) => ({
      name: c.name || c["bom-ref"] || "unknown",
      version: c.version || "unknown",
      license: c.licenses?.[0]?.license?.id || c.licenses?.[0]?.expression || undefined,
      hash: c.hashes?.[0]?.content || undefined,
    }));
  }

  // SPDX format
  if (sbom.packages) {
    return sbom.packages.map((p: any) => ({
      name: p.name || "unknown",
      version: p.versionInfo || "unknown",
      license: p.licenseConcluded || p.licenseDeclared || undefined,
    }));
  }

  // Simple custom format: { dependencies: [{name, version}] }
  if (sbom.dependencies) {
    return sbom.dependencies.map((d: any) => ({
      name: d.name || d.package || "unknown",
      version: d.version || "unknown",
    }));
  }

  // npm package-lock.json format
  if (sbom.packages || sbom.dependencies) {
    const deps = sbom.packages || sbom.dependencies;
    return Object.entries(deps).map(([name, info]: [string, any]) => ({
      name: name.replace("node_modules/", ""),
      version: info.version || "unknown",
    }));
  }

  return [];
}

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
  return { root, manifest };
}
