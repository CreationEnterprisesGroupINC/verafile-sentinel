#!/usr/bin/env node

const fs = require("fs");
const crypto = require("crypto");

const [, , filePath, proofPath] = process.argv;

if (!filePath || !proofPath) {
  console.error("Usage: node commit.js <file> <proof.json>");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`ERROR: file not found: ${filePath}`);
  process.exit(1);
}

const fileBytes = fs.readFileSync(filePath);
const hash = "0x" + crypto.createHash("sha256").update(fileBytes).digest("hex");

const proof = {
  version: "ocp-1",
  hash,
  txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  network: "demo-local",
  contract: "0x0000000000000000000000000000000000000000",
  extractionRule: "demo:proof.hash"
};

fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + "\n");

console.log("COMMITTED: proof created");
console.log(`file:  ${filePath}`);
console.log(`proof: ${proofPath}`);
console.log(`hash:  ${hash}`);
