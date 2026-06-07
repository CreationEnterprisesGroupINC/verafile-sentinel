// revoke.js — zero-dependency revocation helpers for OCP
// CommonJS, Node.js >=18
// Spec: docs/spec/appendix-revocation-r.md

"use strict";

const crypto = require("crypto");
const https  = require("https");

// Deployed contract addresses
const REVOCATION_CONTRACTS = {
  "eip155:84532": "0x2fa07c85439850ff6C5688d926bDa6DaEe62Db15",
};

// RPC endpoints — no API key required
const RPC = {
  "eip155:84532": "https://sepolia.base.org",
  "eip155:8453":  "https://mainnet.base.org",
};

// keccak256("RevocationCommitted(bytes32,bytes32,address,uint256)")
const REVOCATION_EVENT_TOPIC = "0xc19951599a519bc320c0f352b2f92f315e8a2368bd0efb2e5dca3b1196e76112";

// getRevocation(bytes32) selector
const GET_REVOCATION_SELECTOR = "0x8d4b2a4d";

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
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function rpcCall(url, method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(`RPC error: ${parsed.error.message}`));
          else resolve(parsed.result);
        } catch (e) {
          reject(new Error(`Failed to parse RPC response: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function decodeRevocationRecord(hex) {
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  const revocationDigest = "0x" + data.slice(0, 64);
  const revoker          = "0x" + data.slice(64, 128).slice(24);
  const timestamp        = parseInt(data.slice(128, 192), 16);
  const exists           = data.slice(192, 256) !== "0".repeat(64);
  return { revocationDigest, revoker, timestamp, exists };
}

async function buildRevocationDigest(originalDigest, metadata = {}) {
  const normalizedOriginalDigest = normalizeHexDigest(originalDigest, "originalDigest");
  const payload = { originalDigest: normalizedOriginalDigest, ...metadata };
  const encoded = stableJson(payload);
  return `0x${crypto.createHash("sha256").update(encoded).digest("hex")}`;
}

async function checkRevocationStatus(originalDigest, chainId, rpcUrl, contractAddress) {
  normalizeHexDigest(originalDigest, "originalDigest");

  const resolvedRpc      = rpcUrl      || RPC[chainId];
  const resolvedContract = contractAddress || REVOCATION_CONTRACTS[chainId];

  if (!resolvedRpc)      throw new Error(`no RPC endpoint for chain ${chainId} — pass rpcUrl explicitly`);
  if (!resolvedContract) throw new Error(`no contract address for chain ${chainId} — pass contractAddress explicitly`);

  const digestHex = originalDigest.slice(2).toLowerCase();
  const calldata  = GET_REVOCATION_SELECTOR + digestHex;

  let result;
  try {
    result = await rpcCall(resolvedRpc, "eth_call", [
      { to: resolvedContract, data: calldata },
      "latest",
    ]);
  } catch (e) {
    throw new Error(`RPC call failed: ${e.message}`);
  }

  if (!result || result === "0x") return { status: "NOT_FOUND", record: null };

  const record = decodeRevocationRecord(result);
  if (!record.exists) return { status: "NOT_FOUND", record: null };

  return { status: "REVOKED", record };
}

async function verifyWithRevocation(originalDigest, asOfTimestamp, chainId, rpcUrl, contractAddress) {
  normalizeHexDigest(originalDigest, "originalDigest");

  if (typeof asOfTimestamp !== "number") {
    throw new TypeError("asOfTimestamp must be a number (Unix seconds)");
  }

  const { status, record } = await checkRevocationStatus(
    originalDigest, chainId, rpcUrl, contractAddress
  );

  if (status === "NOT_FOUND") return "NOT_FOUND";
  if (record.timestamp <= asOfTimestamp) return "REVOKED";
  return "VALID";
}

module.exports = {
  buildRevocationDigest,
  checkRevocationStatus,
  verifyWithRevocation,
  stableJson,
  REVOCATION_EVENT_TOPIC,
};
