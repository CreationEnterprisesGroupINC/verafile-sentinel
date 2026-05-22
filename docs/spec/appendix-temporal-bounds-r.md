# OCP Appendix: Temporal Bounds Rule (T)

## Status
Draft

## Version
0.1.0

## Authors
Damon Zwicker

## Overview

This appendix defines temporal bound semantics for OCP commitments.

A verifier applying this appendix may conclude:

> Observation O existed no later than the finalized inclusion of commitment C on ledger L, under the finality assumptions F(L) defined in this appendix.

This is an upper temporal bound only. It is not a claim of globally canonical time, atomic clock synchronization, or absolute UTC truth. It is a ledger-relative existence proof bounded by network finality.

OCP does not become a timestamp authority by implementing this appendix. The commitment layer records inclusion. The verification layer interprets temporal bounds. That boundary is preserved.

## Motivation

OCP commitments establish that an observation existed at or before a specific point in ledger history. However, the core protocol does not define how verifiers should interpret the temporal meaning of that inclusion — specifically, what precision and confidence a verifier may assert about when an observation existed.

This gap matters in practice for:

- Legal evidence — "Did this document exist before the filing date?"
- AI provenance — "Was this output generated before this policy change?"
- Compliance workflows — "Was this record created within the required window?"
- Audit trails — "Which version existed at this point in time?"

For all of these use cases, the requirement is not atomic clock precision. It is:

> A defensible, independently verifiable statement that this observation existed before a bounded finalized network boundary.

This appendix provides that statement in a minimal, chain-agnostic form that preserves OCP's system-independent verification philosophy.

## Scope and Limitations

This appendix establishes an **upper temporal bound only**.

A commitment proves the observation existed no later than finalized inclusion. It does not establish a lower bound on observation creation time. An observation committed at block B could have been created at any point before block B.

Lower bound guarantees require additional application-layer controls outside OCP's verification boundary. Implementations requiring lower bound guarantees SHOULD document those controls separately.

Verifiers MUST NOT represent a temporal bound derived from this appendix as:

- Proof of creation time
- Proof of the exact time of commitment
- Atomic clock or UTC-synchronized time
- Globally canonical time truth

The correct representation is:

> This observation existed no later than [finality-bounded timestamp] on [network].

## Definitions

### Temporal Bound
A statement that an observation existed no later than a specific finality-bounded network time.

### Finalized Block
A block considered irreversible under the finality model of the relevant network.

### Finality Depth
The number of blocks after inclusion required before a commitment is considered finalized under network F(L).

### Finality Window
The wall-clock time corresponding to finality depth on a given network. This is an approximation based on observed block times and MUST be treated as an estimate, not a precise guarantee.

### Upper Bound
The latest possible time at which an observation could have been committed, derived from the finalized block timestamp plus the finality window.

### Ledger-Relative Time
Time as recorded by the network — specifically, block.timestamp on EVM-compatible networks. This value is set by block producers and MAY differ from wall-clock time by up to the validator influence window defined for each network.

### Validator Influence Window
The maximum deviation between block.timestamp and true wall-clock time that is permitted or practically achievable by a block producer on a given network.

## Finality Model by Network

The following table defines finality assumptions F(L) for each supported network. Verifiers MUST use these values when computing temporal bounds.

| Network | Chain ID | Finality Model | Safe Depth | Finality Window | Validator Influence Window |
|---|---|---|---|---|---|
| Ethereum mainnet | eip155:1 | Casper FFG — 2 epochs | 64 blocks | ~12 minutes | ~12 seconds |
| Base mainnet | eip155:8453 | L2 soft + L1 settlement | 32 blocks L2 / L1 settle | ~7 min L2 / ~20 min L1 | ~2 seconds L2 |
| Base Sepolia | eip155:84532 | L2 soft + L1 settlement | 32 blocks L2 / L1 settle | ~7 min L2 / ~20 min L1 | ~2 seconds L2 |
| Ethereum Sepolia | eip155:11155111 | Casper FFG — 2 epochs | 64 blocks | ~12 minutes | ~12 seconds |
| Solana mainnet | solana:mainnet | Tower BFT | 32 slots | ~13 seconds | ~400ms |
| Solana devnet | solana:devnet | Tower BFT | 32 slots | ~13 seconds | ~400ms |

### Notes on L2 Finality

Base is an Ethereum L2. It has two distinct finality layers:

**L2 soft finality** — the commitment is included in a Base block and considered final under Base's own sequencer. Safe depth: 32 blocks (~7 minutes). This is sufficient for most OCP use cases.

**L1 settlement finality** — the Base block is settled to Ethereum mainnet and finalized under Casper FFG. This provides the strongest temporal guarantee but requires waiting ~20 minutes for L1 settlement. Required for highest-assurance legal or compliance workflows.

Verifiers SHOULD document which finality layer they are asserting when producing temporal bound statements for L2 networks.

### Notes on Solana Finality

Solana's Tower BFT provides fast finality (~13 seconds at 32 slots). block.timestamp on Solana is derived from the cluster's vote-weighted time and has a validator influence window of approximately 400ms. This is the tightest temporal bound of any supported network.

### Notes on Validator Influence Window

The validator influence window defines the maximum practical deviation between ledger-recorded time and true wall-clock time. Verifiers MUST add this window to any temporal bound statement to produce a conservative upper bound.

Example: A commitment on Ethereum mainnet with block.timestamp T has a conservative upper bound of T + 12 seconds due to validator influence.

## Verification Semantics

A verifier implementing this appendix MUST compute the temporal bound as follows:

### Step 1 — Confirm finalized inclusion

Confirm the commitment exists in a finalized block at or beyond the safe depth defined for the network in the finality table above.

### Step 2 — Read block timestamp

Read block.timestamp from the finalized block containing the commitment.

### Step 3 — Apply validator influence window

Add the validator influence window for the network to produce a conservative upper bound:

upper_bound = block.timestamp + validator_influence_window(network)

### Step 4 — Produce temporal bound statement

The verifier MAY assert:

Observation O existed no later than [upper_bound] on [network] under finality depth [safe_depth].

## Relationship to Core OCP

This appendix does not modify the core OCP invariant:

observation → digest → public commitment → independent verification

It adds an interpretation layer over the inclusion verification step. The temporal bound is derived entirely from on-chain state — no external time sources, no oracles, no trusted third parties.

This appendix intentionally avoids introducing any new trust assumptions beyond those already present in OCP's core verification model.

## Relationship to Revocation Extension

When used alongside the revocation extension (appendix-revocation-r.md), temporal bounds apply independently to both the original commitment and the revocation commitment.

A verifier MAY establish:

- Upper bound T1 — observation existed no later than T1
- Upper bound T2 — revocation existed no later than T2
- Therefore: observation was valid in the window before T2 and revoked after T2

This enables the full temporal verification statement:

> This observation existed before T1 and was revoked before T2. It was valid at any point before T2.

## Worked Example

### Setup

- Network: Base Sepolia (eip155:84532)
- Commitment tx: 0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd
- Block: 41658348
- block.timestamp: 1747656933
- Finality model: L2 soft finality
- Safe depth: 32 blocks
- Validator influence window: 2 seconds

### Computation

upper_bound = 1747656933 + 2 = 1747656935
upper_bound_human = 2026-05-19T11:55:35Z (approximate)

### Temporal bound statement

Observation 0x14cca453... existed no later than 2026-05-19T11:55:35Z on Base Sepolia under L2 soft finality at depth 32.

### Plain language (VeraFile / legal context)

This document existed before approximately 11:55 AM UTC on May 19, 2026, as independently verified against the Base blockchain. This statement can be confirmed by any party with access to a Base Sepolia RPC endpoint.

## Test Vectors

### Vector 1 — Ethereum mainnet temporal bound

Input:
- block.timestamp: 1747656933
- network: eip155:1
- validator_influence_window: 12

Expected upper_bound: 1747656945

### Vector 2 — Solana devnet temporal bound

Input:
- block.timestamp: 1747656933
- network: solana:devnet
- validator_influence_window: 1

Expected upper_bound: 1747656934

### Vector 3 — Base Sepolia temporal bound

Input:
- block.timestamp: 1747656933
- network: eip155:84532
- validator_influence_window: 2

Expected upper_bound: 1747656935

## Status

Draft — not yet deployed. No on-chain contract required for this appendix. Temporal bounds are derived entirely from existing ledger state.

## Changelog

### v0.1.0
- Initial draft
- Defined finality model table for all OCP-supported networks
- Defined upper bound semantics only — lower bound explicitly out of scope
- Added worked example with plain language VeraFile representation
- Defined relationship to revocation extension
- Added test vectors for all supported networks
