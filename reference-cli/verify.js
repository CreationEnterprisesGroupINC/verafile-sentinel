#!/usr/bin/env node

const fs = require("fs");
const crypto = require("crypto");

function fail(message) {
  console.error(`INVALID: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`VALID: ${message}`);
}

const [, , filePath, proofPath] = process.argv;

if (!filePath || !proofPath) {
  console.error("Usage: node verify.js <file> <proof.json>");
  process.exit(1);
}

// File existence
if (!fs.existsSync(filePath)) {
  fail(`file not found: ${filePath}`);
}

if (!fs.existsSync(proofPath)) {
  fail(`proof not found: ${proofPath}`);
}

// Load inputs
const fileBytes = fs.readFileSync(filePath);
let proof;

try {
  proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
} catch {
  fail("invalid JSON in proof file");
}

// REQUIRED FIELDS
const requiredFields = [
  "version",
  "hash",
  "txHash",
  "network",
  "contract",
  "extractionRule",
];

for (const field of requiredFields) {
  if (!proof[field]) {
    fail(`missing required field: ${field}`);
  }
}

// VERSION
if (proof.version !== "ocp-1") {
  fail(`unsupported version: ${proof.version}`);
}

// HASH FORMAT
if (!/^0x[a-f0-9]{64}$/.test(proof.hash)) {
  fail("invalid hash format (must be 0x-prefixed lowercase hex)");
}

// TX HASH FORMAT
if (!/^0x[a-fA-F0-9]{64}$/.test(proof.txHash)) {
  fail("invalid txHash format");
}

// CONTRACT FORMAT
if (!/^0x[a-fA-F0-9]{40}$/.test(proof.contract)) {
  fail("invalid contract address format");
}

// COMPUTE HASH
const computedHash =
  "0x" + crypto.createHash("sha256").update(fileBytes).digest("hex");

// COMPARE
if (computedHash !== proof.hash) {
  fail(`hash mismatch\ncomputed: ${computedHash}\nproof:    ${proof.hash}`);
}

pass("file hash matches proof hash");

// OUTPUT CONTEXT
console.log("");
console.log("Commitment reference:");
console.log(`network:        ${proof.network}`);
console.log(`txHash:         ${proof.txHash}`);
console.log(`contract:       ${proof.contract}`);
console.log(`extractionRule: ${proof.extractionRule}`);
console.log("");

console.log(
  "Ledger inclusion must be confirmed by resolving txHash and applying extractionRule."
);