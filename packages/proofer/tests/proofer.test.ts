import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateProofBundle, writeProofBundle } from "../src/bundler.js";
import { buildPayload, decodePayload, generateProofPNG } from "../src/steganographer.js";
import { existsSync, rmSync } from "fs";

const TEST_COMMITMENT = {
  txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
  blockNumber: 123456789,
  blockTimestamp: "2026-06-07T00:00:00.000Z",
  committerAddress: "0x1234567890123456789012345678901234567890",
  contractAddress: "0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a",
  chainId: 42161,
  chainName: "arbitrum-one",
  rootHash: "sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abc123",
};

const TEST_MANIFEST = {
  root: "sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abc123",
  algorithm: "sha256" as const,
  manifest: [
    { path: "SSP.txt", hash: "sha256:aaa" },
    { path: "POAM.txt", hash: "sha256:bbb" },
  ],
  timestamp_local: "2026-06-07T00:00:00.000Z",
  sentinel_version: "1.0.0",
};

const OUT_DIR = "/tmp/sentinel-proofer-test";

afterAll(() => {
  rmSync(OUT_DIR, { recursive: true, force: true });
});

describe("generateProofBundle", () => {
  it("produces a valid proof bundle", () => {
    const bundle = generateProofBundle(TEST_MANIFEST, TEST_COMMITMENT);
    expect(bundle.sentinel_version).toBe("1.0.0");
    expect(bundle.proof_type).toBe("ocp-erc8281");
    expect(bundle.root_hash).toBe(TEST_COMMITMENT.rootHash);
    expect(bundle.chain.chain_id).toBe(42161);
    expect(bundle.chain.name).toBe("arbitrum-one");
    expect(bundle.commitment.tx_hash).toBe(TEST_COMMITMENT.txHash);
    expect(bundle.verification.independent_verifier).toContain(TEST_COMMITMENT.txHash);
  });

  it("writes sentinel.proof.json to disk", () => {
    const bundle = generateProofBundle(TEST_MANIFEST, TEST_COMMITMENT);
    const path = writeProofBundle(bundle, OUT_DIR);
    expect(existsSync(path)).toBe(true);
    expect(path).toContain("sentinel.proof.json");
  });
});

describe("steganographer", () => {
  it("encodes and decodes payload round-trip", () => {
    const payload = {
      chainId: 42161,
      contractAddress: "0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a",
      txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
      sentinelVersion: 1,
    };
    const encoded = buildPayload(payload);
    expect(encoded.length).toBe(57);
    const decoded = decodePayload(encoded);
    expect(decoded.chainId).toBe(payload.chainId);
    expect(decoded.contractAddress.toLowerCase()).toBe(payload.contractAddress.toLowerCase());
    expect(decoded.sentinelVersion).toBe(payload.sentinelVersion);
  });

  it("writes sentinel.proof.png to disk", () => {
    const path = generateProofPNG(
      {
        chainId: 42161,
        contractAddress: "0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a",
        txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
        sentinelVersion: 1,
      },
      OUT_DIR
    );
    expect(existsSync(path)).toBe(true);
    expect(path).toContain("sentinel.proof.png");
  });
});
