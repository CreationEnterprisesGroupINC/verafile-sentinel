import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { hashDirectory } from "../src/hasher.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/sentinel-test";

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, "SSP.txt"), "System Security Plan v1");
  writeFileSync(join(TEST_DIR, "POAM.txt"), "Plan of Action v1");
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("hashDirectory", () => {
  it("produces a root hash", () => {
    const result = hashDirectory(TEST_DIR);
    expect(result.root).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("manifest contains all files", () => {
    const result = hashDirectory(TEST_DIR);
    expect(result.manifest.length).toBe(2);
    expect(result.manifest.map((e) => e.path)).toContain("SSP.txt");
    expect(result.manifest.map((e) => e.path)).toContain("POAM.txt");
  });

  it("is deterministic — same files produce same root", () => {
    const a = hashDirectory(TEST_DIR);
    const b = hashDirectory(TEST_DIR);
    expect(a.root).toBe(b.root);
  });

  it("detects file changes — different content produces different root", () => {
    const before = hashDirectory(TEST_DIR);
    writeFileSync(join(TEST_DIR, "SSP.txt"), "System Security Plan MODIFIED");
    const after = hashDirectory(TEST_DIR);
    expect(before.root).not.toBe(after.root);
  });
});
