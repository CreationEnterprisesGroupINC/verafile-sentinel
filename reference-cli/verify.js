#!/usr/bin/env node

const fs = require("fs");
const crypto = require("crypto");

function fail(message) {
  console.error(`INVALID: ${message}`);
  process.exit(1);
}

function pass() {
  console.log("VALID");
}

const [, , filePath, proofArg] = process.argv;

if (!filePath) {
  console.error("Usage: ocp-verify <file> [proof.json]");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  fail(`file not found: ${filePath}`);
}

// Auto-detect proof file
const proofPath =
  proofArg ||
  filePath.replace(/(\.[^/.]+)?$/, ".proof.json");

if (!fs.existsSync(proofPath)) {
  fail(`proof not found: ${proofPath}`);
}

const fileBytes = fs.readFileSync(filePath);
let proof;

try {
  proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
} catch {
  fail("invalid JSON in proof file");
}

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

if (proof.version !== "ocp-1") {
  fail(`unsupported version: ${proof.version}`);
}

if (!/^0x[a-f0-9]{64}$/.test(proof.hash)) {
  fail("invalid hash format");
}

if (!/^0x[a-fA-F0-9]{64}$/.test(proof.txHash)) {
  fail("invalid txHash format");
}

if (!/^0x[a-fA-F0-9]{40}$/.test(proof.contract)) {
  fail("invalid contract address format");
}

const computedHash =
  "0x" + crypto.createHash("sha256").update(fileBytes).digest("hex");

if (computedHash !== proof.hash) {
  fail("hash mismatch");
}

pass();
