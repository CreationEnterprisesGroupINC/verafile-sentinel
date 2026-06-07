import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

export interface FileEntry {
  path: string;
  hash: string;
}

export interface HashManifest {
  root: string;
  algorithm: "sha256";
  manifest: FileEntry[];
  timestamp_local: string;
  sentinel_version: string;
}

function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return "sha256:" + createHash("sha256").update(content).digest("hex");
}

function collectFiles(dir: string, base: string): FileEntry[] {
  const entries: FileEntry[] = [];
  const items = readdirSync(dir).sort(); // sort for determinism
  for (const item of items) {
    const full = join(dir, item);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      entries.push(...collectFiles(full, base));
    } else {
      entries.push({
        path: relative(base, full),
        hash: hashFile(full),
      });
    }
  }
  return entries;
}

export function hashDirectory(dirPath: string): HashManifest {
  const manifest = collectFiles(dirPath, dirPath);
  const combined = manifest.map((e) => e.path + ":" + e.hash).join("|");
  const root = "sha256:" + createHash("sha256").update(combined).digest("hex");
  return {
    root,
    algorithm: "sha256",
    manifest,
    timestamp_local: new Date().toISOString(),
    sentinel_version: "1.0.0",
  };
}
