# Verafile Sentinel

> **Standing guard against mal-actors across the defense supply chain.**

Verafile Sentinel is a cryptographic proof-of-integrity system for defense software supply chains. Built on the [Observation Commitment Protocol (OCP/ERC-8281)](https://github.com/damonzwicker/observation-commitment-protocol), Sentinel enables defense contractors to generate tamper-evident, blockchain-anchored proof that any software package, compliance artifact, or CUI-bearing deliverable has not been altered — satisfying CMMC 2.0 Phase 4 continuous attestation requirements without relying on self-reported scores.

---

## The Problem

CMMC 2.0 Phase 4 (effective November 10, 2028) mandates that **every DoD contractor and subcontractor** demonstrate continuous, verifiable compliance across all applicable contracts. The framework requires:

- Continuous compliance attestation
- Senior leadership annual affirmations (with False Claims Act exposure)
- Mandatory notification of any system change touching CUI
- Subcontractor flowdown verification — with no direct SPRS visibility for prime contractors

Existing approaches rely on self-attestation, manual documentation, and periodic point-in-time audits. **None of these produce independent, cryptographically verifiable proof.** A C3PAO assessor has no way to confirm a score wasn't fabricated. A prime contractor has no trustless way to verify a subcontractor's compliance posture.

Sentinel solves this.

---

## How It Works

```
Software Package / Compliance Artifact
        │
        ▼
[ Hash the Package ]
  SHA-256 deterministic fingerprint
        │
        ▼
[ Commit to Blockchain via OCP/ERC-8281 ]
  Timestamped, immutable on-chain observation
        │
        ▼
[ Generate Cryptographic Proof ]
  OCP reveal mechanism — verifiable by any party
        │
        ▼
[ Embed Proof in Package ]
  Sidecar proof file + steganographic pixel art
  encoding the on-chain commitment reference
        │
        ▼
[ Independent Verification ]
  Re-hash package → fetch on-chain commitment
  → compare → pass/fail — no Sentinel server required
```

Verification is **fully independent**. If Verafile ceased to exist tomorrow, every proof anchored to chain remains verifiable forever.

---

## CMMC Phase 4 Coverage

| CMMC Requirement | Sentinel Mechanism |
|---|---|
| Continuous compliance attestation | Every package state = on-chain timestamped OCP commitment |
| Senior leadership annual affirmation | Affirmation anchored as signed OCP observation — non-repudiable |
| System change notification (CUI) | Hash mismatch triggers automatic alert + new commitment required |
| Subcontractor flowdown verification | Any party verifies independently — no SPRS access required |
| Audit & Accountability (AU domain) | Full tamper-evident audit trail, cryptographically sequenced |
| False Claims Act protection | On-chain proof demonstrates good-faith compliance at time of attestation |

---

## Protocol Foundation

Sentinel is built on **OCP (Observation Commitment Protocol)**, formally designated **ERC-8281** on Ethereum.

OCP implements a commit-reveal pattern for trustless observation: an observer commits to having observed a state before revealing what that state was, producing a cryptographic proof that is independently verifiable on-chain without trusting the observer.

- **OCP/ERC-8281:** [ethereum/ERCs PR #1788](https://github.com/ethereum/ERCs/pull/1788)
- **Arbitrum One deployment:** `0x65884e7db1E57cA2AEf0d66eFcff9c738684B02a`
- **Base Sepolia (testnet):** `0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c`
- **npm:** `ocp-verify`
- **Stack:** EIP-3668, WYRIWE, ERC-8004, OCP/ERC-8281, VNI, ERC-8275

---

## Architecture

```
verafile-sentinel/
├── packages/
│   ├── core/          # OCP primitives — hash, commit, reveal
│   ├── cli/           # verafile-sentinel CLI
│   ├── sdk/           # SDK for enterprise integrations
│   └── proofer/       # Proof generation + pixel art embedding
├── contracts/         # Sentinel-specific smart contracts
├── docs/              # CMMC domain mapping, compliance specs
├── examples/          # Reference implementations
└── README.md
```

---

## Status

> Sentinel is in active development. The protocol foundation (OCP/ERC-8281) is live on Arbitrum One and Base Sepolia. Commercial product development is underway.

---

## Legal

Verafile Sentinel is proprietary software. All rights reserved.
© 2026 Verafile / Creation Enterprises Group Inc.

This repository is private. Unauthorized access, use, reproduction, or distribution is prohibited.

The underlying protocol (OCP/ERC-8281) is open source under MIT license.
Sentinel's commercial implementation built on top of OCP is not open source.
