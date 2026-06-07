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

export function hashDirectory(dirPath: string): HashManifest {
  const manifest = collectFiles(dirPath, dirPath);
  const combined = manifest.map((e) => e.path + ":" + e.hash).join("|");
  const root = "sha256:" + createHash("sha256").update(combined).digest("hex");
  return { root, algorithm: "sha256", manifest, timestamp_local: new Date().toISOString(), sentinel_version: "1.0.0" };
}

function collectFiles(dir: string, base: string): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const item of readdirSync(dir).sort()) {
    const full = join(dir, item);
    if (statSync(full).isDirectory()) {
      entries.push(...collectFiles(full, base));
    } else {
      entries.push({ path: relative(base, full), hash: "sha256:" + createHash("sha256").update(readFileSync(full)).digest("hex") });
    }
  }
  return entries;
}
