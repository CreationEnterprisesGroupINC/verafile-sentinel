# OCP Appendix: EVM Extraction Rule for ERC-8263

*Co-authored by Vincent Wu (ERC-8263 / TruthAnchor) and Damon Zwicker (OCP)*

## Status

Draft — pending gate verification and mainnet deployment
Implements: extraction.rule_id: "evm/erc-8263"

## Reference Contract

TruthAnchor V1 reference implementation of ERC-8263:

- Sepolia: 0x89EE9b68c3b2f50cbE9D0fC4Dc134939a0475c1C
- Deploy tx: 0xb15822b519f88cdd0741ed56f2c1cf7710e046a1179477faaad964b959c96a74
- Ethereum mainnet: pending

## Event Signature Topic

keccak256("AnchorProof(uint8,bytes32,bytes32,address,bytes)")
= 0x9fe832d83a52f83bd7d54181e4cc7ff8b4e227cc1d3a0144376894b5df6c23cc

Confirmed in deployed bytecode.

## Extraction Rule: evm/erc-8263

R(receipt) = { topics[2] : log in receipt.logs,
               log.topics[0] = keccak256("AnchorProof(uint8,bytes32,bytes32,address,bytes)"),
               len(log.topics) >= 3 }

topics[2] is proofHash — the OCP digest.

## Why proofHash not aux

proofHash is always present and non-zero enforced by the contract.
aux is non-normative and may be absent.
Every anchor is an OCP commitment by default.

## Security Considerations

Frontrunning: any address can anchor any agentId claim. OCP proves digest inclusion only, not authorship.
block.timestamp is validator-influenceable by ~12s. Use finality.depth.
batchAnchor patterns produce multiple events — all matching proofHash values included in S.
proofHash hashing: contract is algorithm-neutral. Implementations SHOULD use SHA-256 for OCP compatibility.

## Gate checklist

- [x] Event signature topic confirmed against deployed bytecode — 0x9fe832d83a52f83bd7d54181e4cc7ff8b4e227cc1d3a0144376894b5df6c23cc matches Sepolia V1 deployment
- [x] Extraction tested — anchor() tx: 0x51b8531d4f775f847d6073dc863e036d787c2a479c58c96a3f83d2356b471ffb — topics[0] 0x9fe832d8 matches, topics[2] 0xe11404ec matches reported proofHash
- [x] anchorWithAux() tested — aux correctly ignored — tx: 0xa9e7a8fca70472ce32463a6fca07dc82d3a60f9780e386dfea81deaf060da9d4 — topics[2] 0x8474ea4c matches proofHash, aux present in data only
- [ ] Mainnet contract address confirmed
