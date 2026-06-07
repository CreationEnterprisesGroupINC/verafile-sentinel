import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { hashDirectory } from "../src/hasher.js";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/sentinel-sdk-test";
const PROOF_DIR = "/tmp/sentinel-sdk-proof";

const MOCK_PROOF = {
  sentinel_version: "1.0.0",
  proof_type: "ocp-erc8281",
  root_hash: "", // filled after hashing
  manifest_hash: "",
  chain: { name: "arbitrum-one", chain_id: 42161, contract: "0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a" },
  commitment: {
    tx_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    block_number: 123456789,
    block_timestamp: "2026-06-07T00:00:00.000Z",
    committer_address: "0x1234567890123456789012345678901234567890",
  },
  verification: {
    instructions: "Re-hash and compare",
    independent_verifier: "https://arbiscan.io/tx/0xabc",
  },
};

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(PROOF_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, "SSP.txt"), "System Security Plan v1");
  writeFileSync(join(TEST_DIR, "POAM.txt"), "Plan of Action v1");
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  rmSync(PROOF_DIR, { recursive: true, force: true });
});

describe("hashDirectory", () => {
  it("produces a deterministic root hash", () => {
    const a = hashDirectory(TEST_DIR);
    const b = hashDirectory(TEST_DIR);
    expect(a.root).toBe(b.root);
    expect(a.root).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("manifest lists all files sorted", () => {
    const result = hashDirectory(TEST_DIR);
    expect(result.manifest.length).toBe(2);
    expect(result.manifest[0].path).toBe("POAM.txt");
    expect(result.manifest[1].path).toBe("SSP.txt");
  });

  it("detects tampering — modified file changes root hash", () => {
    const before = hashDirectory(TEST_DIR);
    writeFileSync(join(TEST_DIR, "SSP.txt"), "TAMPERED CONTENT");
    const after = hashDirectory(TEST_DIR);
    expect(before.root).not.toBe(after.root);
    // restore
    writeFileSync(join(TEST_DIR, "SSP.txt"), "System Security Plan v1");
  });
});

describe("proof bundle structure", () => {
  it("mock proof bundle contains required CMMC fields", () => {
    const manifest = hashDirectory(TEST_DIR);
    const proof = { ...MOCK_PROOF, root_hash: manifest.root, manifest_hash: manifest.root };
    const proofPath = join(PROOF_DIR, "sentinel.proof.json");
    writeFileSync(proofPath, JSON.stringify(proof, null, 2));

    const loaded = JSON.parse(readFileSync(proofPath, "utf-8"));
    expect(loaded.sentinel_version).toBe("1.0.0");
    expect(loaded.proof_type).toBe("ocp-erc8281");
    expect(loaded.chain.chain_id).toBe(42161);
    expect(loaded.commitment.tx_hash).toBeTruthy();
    expect(loaded.verification.independent_verifier).toContain("arbiscan.io");
  });

  it("tampered directory produces hash mismatch against proof", () => {
    const manifest = hashDirectory(TEST_DIR);
    const proof = { ...MOCK_PROOF, root_hash: manifest.root };

    writeFileSync(join(TEST_DIR, "SSP.txt"), "TAMPERED");
    const tamperedManifest = hashDirectory(TEST_DIR);

    expect(tamperedManifest.root).not.toBe(proof.root_hash);

    // restore
    writeFileSync(join(TEST_DIR, "SSP.txt"), "System Security Plan v1");
  });
});
