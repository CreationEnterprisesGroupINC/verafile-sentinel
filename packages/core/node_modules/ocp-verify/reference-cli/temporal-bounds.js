// temporal-bounds.js — zero-dependency temporal bound helper for OCP
// CommonJS, Node.js >=18
// Spec: docs/spec/appendix-temporal-bounds-r.md

"use strict";

const https = require("https");

// RPC endpoints — no API key required
const RPC = {
  "eip155:1":        "https://cloudflare-eth.com",
  "eip155:8453":     "https://mainnet.base.org",
  "eip155:84532":    "https://sepolia.base.org",
  "eip155:11155111": "https://rpc.sepolia.org",
};

// Finality table — F(L) per network
// Source: docs/spec/appendix-temporal-bounds-r.md
const FINALITY = {
  "eip155:1": {
    safe_depth: 64,
    finality_window_seconds: 720,
    validator_influence_window: 12,
    finality_model: "Casper FFG — 2 epochs",
  },
  "eip155:8453": {
    safe_depth: 32,
    finality_window_seconds: 420,
    validator_influence_window: 2,
    finality_model: "L2 soft finality",
    l1_chain_id: "eip155:1",
  },
  "eip155:84532": {
    safe_depth: 32,
    finality_window_seconds: 420,
    validator_influence_window: 2,
    finality_model: "L2 soft finality",
    l1_chain_id: "eip155:11155111",
  },
  "eip155:11155111": {
    safe_depth: 64,
    finality_window_seconds: 720,
    validator_influence_window: 12,
    finality_model: "Casper FFG — 2 epochs",
  },
};

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

function toIso8601(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString();
}

function normalizeHexDigest(value, fieldName) {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string`);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${fieldName} must be a 0x-prefixed 32-byte hex digest`);
  }
  return value.toLowerCase();
}

async function getTemporalBound(txHash, chainId, rpcUrl) {
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("txHash must be a 0x-prefixed 32-byte hex string");
  }

  const finality = FINALITY[chainId];
  if (!finality) {
    throw new Error(`unsupported chainId: ${chainId} — add to FINALITY table`);
  }

  const resolvedRpc = rpcUrl || RPC[chainId];
  if (!resolvedRpc) {
    throw new Error(`no RPC endpoint for chain ${chainId} — pass rpcUrl explicitly`);
  }

  // Step 1 — fetch transaction receipt to get block number
  let receipt;
  try {
    receipt = await rpcCall(resolvedRpc, "eth_getTransactionReceipt", [txHash]);
  } catch (e) {
    throw new Error(`RPC call failed: ${e.message}`);
  }
  if (!receipt) throw new Error(`transaction not found: ${txHash}`);

  const blockNumber = parseInt(receipt.blockNumber, 16);

  // Step 2 — fetch block to get timestamp
  let block;
  try {
    block = await rpcCall(resolvedRpc, "eth_getBlockByNumber", [receipt.blockNumber, false]);
  } catch (e) {
    throw new Error(`RPC call failed fetching block: ${e.message}`);
  }
  if (!block) throw new Error(`block not found: ${receipt.blockNumber}`);

  const blockTimestamp = parseInt(block.timestamp, 16);

  // Step 3 — fetch current block number to compute finality depth
  let currentBlockHex;
  try {
    currentBlockHex = await rpcCall(resolvedRpc, "eth_blockNumber", []);
  } catch (e) {
    throw new Error(`RPC call failed fetching current block: ${e.message}`);
  }
  const currentBlock = parseInt(currentBlockHex, 16);
  const depth = currentBlock - blockNumber;
  const finalized = depth >= finality.safe_depth;

  // Step 4 — compute upper bound
  const upperBound = blockTimestamp + finality.validator_influence_window;

  return {
    tx_hash: txHash,
    chain_id: chainId,
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    block_timestamp_iso: toIso8601(blockTimestamp),
    finality_depth_confirmed: depth,
    finality_depth_required: finality.safe_depth,
    finality_model: finality.finality_model,
    finalized,
    validator_influence_window: finality.validator_influence_window,
    upper_bound: upperBound,
    upper_bound_iso: toIso8601(upperBound),
  };
}

module.exports = {
  getTemporalBound,
  FINALITY,
};
