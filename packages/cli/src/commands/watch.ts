import { Command } from "commander";
import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

export const watchCommand = new Command("watch")
  .description("Continuously monitor a directory — alert on any change")
  .argument("<directory>", "Path to the directory to monitor")
  .argument("<proof>", "Path to sentinel.proof.json to verify against")
  .option("--interval <seconds>", "Check interval in seconds", "30")
  .action(async (directory: string, proofPath: string, options: { interval: string }) => {
    const intervalMs = parseInt(options.interval) * 1000;

    console.log(`\n🛡  Verafile Sentinel — watch\n`);
    console.log(`📁 Monitoring: ${directory}`);
    console.log(`📄 Proof:      ${proofPath}`);
    console.log(`⏱  Interval:   every ${options.interval} seconds`);
    console.log(`\n   Press Ctrl+C to stop.\n`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const proof = JSON.parse(readFileSync(proofPath, "utf-8"));
    const onChainRoot = proof.root_hash;
    let lastStatus: "PASS" | "FAIL" = "PASS";
    let checkCount = 0;

    const check = () => {
      checkCount++;
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      const localManifest = hashDirectory(directory);
      const localRoot = localManifest.root;

      if (localRoot === onChainRoot) {
        if (lastStatus !== "PASS") {
          console.log(`\n  [${now}] ✅ RESTORED — package integrity verified`);
        } else {
          process.stdout.write(`\r  [${now}] ✅ PASS  (check #${checkCount})  `);
        }
        lastStatus = "PASS";
      } else {
        if (lastStatus !== "FAIL") {
          console.log(`\n`);
          console.log(`  ┌─────────────────────────────────────────────────────────┐`);
          console.log(`  │  ❌  INTEGRITY ALERT                                    │`);
          console.log(`  │                                                         │`);
          console.log(`  │  Directory: ${directory.slice(0, 40).padEnd(40)}  │`);
          console.log(`  │  Time:      ${now.padEnd(40)}  │`);
          console.log(`  │                                                         │`);
          console.log(`  │  Expected:  ${onChainRoot.slice(0, 40).padEnd(40)}  │`);
          console.log(`  │  Found:     ${localRoot.slice(0, 40).padEnd(40)}  │`);
          console.log(`  │                                                         │`);
          console.log(`  │  One or more files have been modified since commitment. │`);
          console.log(`  └─────────────────────────────────────────────────────────┘`);
          console.log(``);

          // Show which files changed
          if (proof.manifest) {
            const changedFiles: string[] = [];
            for (const entry of localManifest.manifest) {
              const original = proof.manifest.find((m: any) => m.path === entry.path);
              if (!original) {
                changedFiles.push(`  + ADDED:    ${entry.path}`);
              } else if (original.hash !== entry.hash) {
                changedFiles.push(`  ~ MODIFIED: ${entry.path}`);
              }
            }
            for (const orig of proof.manifest) {
              if (!localManifest.manifest.find(e => e.path === orig.path)) {
                changedFiles.push(`  - DELETED:  ${orig.path}`);
              }
            }
            if (changedFiles.length > 0) {
              console.log(`  Changed files:`);
              changedFiles.forEach(f => console.log(f));
              console.log(``);
            }
          }
        } else {
          process.stdout.write(`\r  [${now}] ❌ FAIL  (check #${checkCount}) — modifications detected  `);
        }
        lastStatus = "FAIL";
      }
    };

    // Run immediately then on interval
    check();
    setInterval(check, intervalMs);
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
  return { root, manifest };
}
