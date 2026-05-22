// revoke.js — zero-dependency revocation helpers for OCP
// CommonJS, Node.js >=18

const crypto = require("crypto");

function normalizeHexDigest(value, fieldName) {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string`);
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${fieldName} must be a 0x-prefixed 32-byte hex digest`);
  }

  return value.toLowerCase();
}

function stableJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  const keys = Object.keys(value).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

async function buildRevocationDigest(originalDigest, metadata = {}) {
  const normalizedOriginalDigest = normalizeHexDigest(
    originalDigest,
    "originalDigest"
  );

  const payload = {
    originalDigest: normalizedOriginalDigest,
    ...metadata,
  };

  const encoded = stableJson(payload);

  return `0x${crypto.createHash("sha256").update(encoded).digest("hex")}`;
}

async function checkRevocationStatus(originalDigest, rpcUrl, contractAddress) {
  normalizeHexDigest(originalDigest, "originalDigest");

  if (!rpcUrl || typeof rpcUrl !== "string") {
    throw new Error("rpcUrl is required");
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress || "")) {
    throw new Error("contractAddress must be a valid 0x-prefixed address");
  }

  throw new Error(
    "checkRevocationStatus is not implemented in the zero-dependency reference helper yet"
  );
}

module.exports = {
  buildRevocationDigest,
  checkRevocationStatus,
  stableJson,
};