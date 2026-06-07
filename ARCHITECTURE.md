# Verafile Sentinel — Technical Architecture Blueprint

> Version 1.0 | June 2026
> Built on OCP/ERC-8281 | Target: CMMC Phase 4 (November 10, 2028)

---

## 1. Product Purpose

Verafile Sentinel produces cryptographic, blockchain-anchored proof that a software package
or compliance evidence bundle has not been altered — satisfying CMMC Phase 4 continuous
attestation, annual affirmation, system change notification, and subcontractor flowdown
verification requirements under 32 CFR Part 170 and DFARS 252.204-7021.

---

## 2. Core Design Principles

**Trustless verification.** Any party can verify a Sentinel proof independently using only
the package and a public blockchain node. No Verafile server, no SPRS access, no trust
in the prover required.

**Non-repudiability.** Every commitment is signed, timestamped, and immutable on-chain.
A senior official's annual affirmation anchored via Sentinel cannot be backdated, altered,
or plausibly denied — eliminating good-faith FCA exposure.

**Protocol separation.** Sentinel is a commercial product built on top of OCP/ERC-8281.
It depends on OCP as a protocol — it does not own or fork it. OCP primitives are consumed
as a library. Sentinel's value is in the compliance workflow layer above the protocol.

**Directory-first.** Phase 1 targets compliance evidence directories — the real-world
shape of CMMC deliverables (SSPs, POA&Ms, audit logs, config exports). Single files
and archives are v1.1.

**Arbitrum One.** Primary deployment target. OCP is already live at
`0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a`. Low gas, high throughput, EVM-compatible.
Base Sepolia used for testnet. Multi-chain in v2.

---

## 3. CMMC Phase 4 Requirements Mapping

| CMMC Requirement | Sentinel Mechanism | Package Component |
|---|---|---|
| Continuous compliance attestation | Hash commit → on-chain OCP observation | `core/` |
| Annual senior leadership affirmation | Signed OCP commitment with affiant address | `core/` + `cli/` |
| System change notification (CUI) | Hash mismatch detection → alert + new commit | `cli/` + `sdk/` |
| Subcontractor flowdown verification | Trustless independent verification, no SPRS needed | `proofer/` + `sdk/` |
| Audit & Accountability (AU domain) | Cryptographically sequenced on-chain audit trail | `core/` |
| FCA exposure mitigation | On-chain proof of good-faith compliance at attestation time | `core/` + `proofer/` |
| POA&M tracking | Commitment references tied to remediation state | `sdk/` |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SENTINEL INPUTS                       │
│         Compliance evidence directory (SSP,              │
│         POA&M, audit logs, config exports)               │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  packages/core/                          │
│                                                          │
│  1. HASHER                                               │
│     - Recursively hash directory tree                    │
│     - SHA-256 each file                                  │
│     - Produce deterministic Merkle root hash             │
│     - Serialize manifest: file list + individual hashes  │
│                                                          │
│  2. COMMITTER                                            │
│     - Connect to OCP/ERC-8281 on Arbitrum One            │
│     - Submit root hash as OCP observation                │
│     - Record: tx hash, block number, timestamp,          │
│       committer address, contract address                │
│                                                          │
│  3. REVEALER                                             │
│     - Execute OCP reveal against prior commitment        │
│     - Produce on-chain verifiable proof object           │
│                                                          │
│  4. VERIFIER                                             │
│     - Re-hash local directory                            │
│     - Fetch on-chain commitment by reference             │
│     - Compare hashes                                     │
│     - Return: PASS / FAIL / TAMPERED + diff report       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                 packages/proofer/                        │
│                                                          │
│  1. PROOF BUNDLE GENERATOR                               │
│     - Takes core commitment object                       │
│     - Produces sentinel.proof.json sidecar file          │
│       containing:                                        │
│         - root hash                                      │
│         - file manifest                                  │
│         - on-chain tx hash                               │
│         - block number + timestamp                       │
│         - committer address                              │
│         - OCP contract address                           │
│         - Arbitrum One chain ID                          │
│         - verification instructions                      │
│                                                          │
│  2. PIXEL ART EMBEDDER                                   │
│     - Encodes on-chain commitment reference into         │
│       steganographic pixel art PNG                       │
│     - Embedded data: tx hash + contract address          │
│       + chain ID (minimum viable reference for           │
│       independent verification)                          │
│     - Output: sentinel.proof.png                         │
│     - Human-presentable proof carrier for               │
│       C3PAO assessors and compliance officers            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   packages/cli/                          │
│                                                          │
│  Commands:                                               │
│                                                          │
│  sentinel commit <directory>                             │
│    - Hash directory                                      │
│    - Commit to Arbitrum One via OCP                      │
│    - Generate sentinel.proof.json + sentinel.proof.png   │
│    - Output: commitment reference                        │
│                                                          │
│  sentinel verify <directory>                             │
│    - Re-hash directory                                   │
│    - Fetch on-chain commitment                           │
│    - Compare + report PASS / FAIL / TAMPERED             │
│                                                          │
│  sentinel attest <directory> --affiant <address>         │
│    - Commit with named affiant address                   │
│    - Produces senior leadership attestation record       │
│    - Satisfies annual SPRS affirmation requirement       │
│                                                          │
│  sentinel watch <directory>                              │
│    - Continuous monitoring mode                          │
│    - Detects hash changes in real time                   │
│    - Alerts on CUI system modification                   │
│    - Satisfies 48 CFR system change notification         │
│                                                          │
│  sentinel report <commitment-reference>                  │
│    - Generates human-readable compliance report          │
│    - PDF output for C3PAO assessors                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   packages/sdk/                          │
│                                                          │
│  Enterprise integration layer                            │
│                                                          │
│  - JavaScript/TypeScript SDK                             │
│  - Programmatic access to all CLI commands               │
│  - Webhook support: fire on commit / tamper detected     │
│  - Prime contractor dashboard hooks:                     │
│    verify subcontractor proof bundles without            │
│    SPRS access                                           │
│  - POA&M state tracking: attach remediation             │
│    commitments to open findings                          │
│  - CI/CD pipeline integration (GitHub Actions,          │
│    Jenkins, GitLab CI)                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Data Structures

### Root Hash (Merkle)
```json
{
  "root": "sha256:abc123...",
  "algorithm": "sha256",
  "manifest": [
    { "path": "SSP.docx", "hash": "sha256:def456..." },
    { "path": "POAM.xlsx", "hash": "sha256:ghi789..." },
    { "path": "audit-log-2026-06.json", "hash": "sha256:jkl012..." }
  ],
  "timestamp_local": "2026-06-07T00:00:00Z",
  "sentinel_version": "1.0.0"
}
```

### Proof Bundle (sentinel.proof.json)
```json
{
  "sentinel_version": "1.0.0",
  "proof_type": "ocp-erc8281",
  "root_hash": "sha256:abc123...",
  "manifest_hash": "sha256:manifest...",
  "chain": {
    "name": "arbitrum-one",
    "chain_id": 42161,
    "contract": "0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a"
  },
  "commitment": {
    "tx_hash": "0x...",
    "block_number": 123456789,
    "block_timestamp": "2026-06-07T00:00:00Z",
    "committer_address": "0x..."
  },
  "affiant": {
    "address": "0x...",
    "role": "CISO",
    "attestation_type": "annual-cmmc-affirmation"
  },
  "verification": {
    "instructions": "Re-hash the target directory using SHA-256 Merkle. Compare root hash against on-chain commitment at the tx_hash above on Arbitrum One.",
    "independent_verifier": "https://arbiscan.io/tx/{tx_hash}"
  }
}
```

### Pixel Art Embedded Payload
```
Encoded via LSB steganography in PNG pixel data:
  - chain_id (uint32)
  - contract_address (bytes20)
  - tx_hash (bytes32)
  - sentinel_version (uint8)
Total payload: ~57 bytes — fits in any 8x8 PNG minimum
```

---

## 6. Build Sequence

### Phase 1 — Core (Build First)
- [ ] Directory recursive hasher (SHA-256 Merkle)
- [ ] OCP/ERC-8281 commitment client (Arbitrum One)
- [ ] Reveal + verification logic
- [ ] Unit tests for hash determinism
- [ ] Unit tests for on-chain round-trip

### Phase 2 — Proofer
- [ ] sentinel.proof.json generator
- [ ] LSB steganography encoder/decoder
- [ ] Pixel art PNG generator
- [ ] Round-trip test: encode → decode → verify reference

### Phase 3 — CLI
- [ ] `sentinel commit`
- [ ] `sentinel verify`
- [ ] `sentinel attest`
- [ ] `sentinel watch`
- [ ] `sentinel report`
- [ ] Integration tests against Base Sepolia testnet

### Phase 4 — SDK
- [ ] TypeScript SDK wrapping CLI commands
- [ ] Webhook interface
- [ ] Subcontractor proof verification module
- [ ] GitHub Actions integration example
- [ ] POA&M state tracker

---

## 7. Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript / Node.js |
| Blockchain client | ethers.js v6 |
| OCP protocol | ocp-verify (npm) |
| Hashing | Node.js crypto (built-in SHA-256) |
| Steganography | Custom LSB PNG encoder |
| CLI framework | commander.js |
| Testing | Vitest |
| Testnet | Base Sepolia |
| Production chain | Arbitrum One |
| CI/CD | GitHub Actions |

---

## 8. Security Constraints

- Private keys NEVER touch the codebase — env vars or hardware wallet only
- Proof bundles are append-only — no mutation after generation
- Verifier is stateless — reads only from chain and local filesystem
- Pixel art decoder must be open source and published separately
  so independent verification requires no Verafile tooling
- All on-chain interactions go through OCP contract — no custom
  Sentinel contracts in Phase 1

---

## 9. What Sentinel Is Not

- Not a CMMC consultant or gap assessment tool
- Not a replacement for a System Security Plan
- Not a substitute for C3PAO assessment
- Not a SPRS submission tool

Sentinel produces the cryptographic evidence layer that makes
every other compliance artifact independently verifiable.
The assessment, the SSP, the POA&M — those are the customer's
responsibility. Sentinel proves they haven't been touched since
they were submitted.

---

## 10. Version Roadmap

| Version | Scope |
|---|---|
| v1.0 | core + proofer + cli (commit, verify, attest) |
| v1.1 | cli watch + report, single file + archive inputs |
| v1.2 | sdk + webhook + GitHub Actions integration |
| v2.0 | Base chain support, multi-chain proof bundles |
| v2.1 | Prime contractor subcontractor dashboard |
| v3.0 | FedRAMP-ready hosted verification service |
