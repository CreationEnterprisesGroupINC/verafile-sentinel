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
  console.error("Usage: node reference-cli/verify.js <file> <proof.json>");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  fail(`file not found: ${filePath}`);
}

if (!fs.existsSync(proofPath)) {
  fail(`proof not found: ${proofPath}`);
}

const fileBytes = fs.readFileSync(filePath);
const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));

if (!proof.hash || typeof proof.hash !== "string") {
  fail("proof is missing hash");
}

const computedHash =
  "0x" + crypto.createHash("sha256").update(fileBytes).digest("hex");

if (computedHash !== proof.hash) {
  fail(`hash mismatch\ncomputed: ${computedHash}\nproof:    ${proof.hash}`);
}

pass("file hash matches proof hash");

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