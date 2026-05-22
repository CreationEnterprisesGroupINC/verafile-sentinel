# OCP Appendix: Revocation Rule (R)

## Status
Draft

## Version
0.1.0

## Authors
Damon Zwicker

## Overview

This appendix defines an optional revocation extension for the Observation Commitment Protocol (OCP).

The revocation model allows an existing OCP commitment to be superseded by a later revocation commitment while preserving the original commitment as a permanently verifiable historical fact.

Revocation in OCP is additive. Existing commitments are never deleted, modified, or rewritten. A revocation is represented as a separate commitment that references a prior digest and introduces additional verification semantics for downstream verifiers.

This appendix does not alter the core OCP invariant:

observation → digest → public commitment → independent verification

Instead, it defines an additional layer for lifecycle-aware verification where verifiers may evaluate both historical validity and current revocation status.

## Motivation

Certain verification workflows require the ability to represent lifecycle transitions after an original observation commitment has been published.

Examples include:

- revoked credentials
- superseded attestations
- withdrawn evidence
- invalidated AI outputs
- compromised signing keys
- regulatory or legal takedown workflows

Core OCP intentionally avoids mutable state and does not permit modification or deletion of previously committed observations.

However, some applications require the ability to communicate that a previously valid commitment should no longer be treated as currently authoritative.

This appendix introduces a revocation mechanism that preserves OCP immutability while enabling downstream systems to evaluate commitment status across time.

The goal is not to erase historical truth, but to provide additional verifiable context regarding the present standing of a commitment.

## Definitions

### Original Commitment

An existing OCP commitment representing the initial observation digest committed to a public ledger.

### Revocation Commitment

A separate commitment referencing a previously committed digest and indicating that the referenced commitment should no longer be treated as currently authoritative.

### Revocation Record

A structured record containing revocation metadata associated with an original digest.

### Revoker

The entity authorized to publish a revocation commitment for a given original commitment.

### Historical Validity

The verification status of a commitment at a specified point in time prior to revocation.

### Current Status

The latest known revocation state associated with a commitment at verification time.

## State Machine

A commitment supporting the revocation extension exists in one of two states:

### COMMITTED

The original OCP commitment exists and no revocation commitment referencing the original digest has been published.

### REVOKED

A revocation commitment exists which references the original digest.

State transitions are strictly one-way:

COMMITTED → REVOKED

A commitment MUST NOT transition from REVOKED back to COMMITTED.

Revocation does not modify, erase, invalidate, or mutate the original commitment record.

Instead, revocation introduces an additional on-chain fact which downstream verifiers may interpret according to the verification semantics defined in this appendix.

The original commitment remains permanently verifiable as a historical observation commitment even after revocation.

## Revocation Record Schema

A revocation record MUST contain the following fields:

| Field | Type | Description |
|---|---|---|
| originalDigest | bytes32 | Digest of the original commitment being revoked |
| revocationDigest | bytes32 | Digest representing the revocation payload |
| revoker | address | Address publishing the revocation commitment |
| timestamp | uint256 | Ledger-relative timestamp associated with the revocation commitment |
| exists | bool | Indicates whether a revocation record exists for the referenced digest |

The revocationDigest MAY represent a structured payload including additional metadata such as:

- revocation reason
- revocation authority
- revokedAt timestamp
- jurisdictional metadata
- application-specific lifecycle information

The exact encoding of revocation payload metadata is implementation-specific unless otherwise standardized by higher-level OCP extensions.

## Authority Model

For version 0.1.0 of this appendix, revocation authority is restricted to the original commitment publisher.

A revocation commitment MUST originate from the same authority responsible for the original commitment unless a higher-level extension explicitly defines alternative authorization semantics.

Implementations MAY introduce more advanced authority models in future versions, including:

- delegated revocation authorities
- multisignature revocation controls
- contract-governed revocation policies
- jurisdiction-specific revocation frameworks

However, such mechanisms are outside the scope of this appendix.

This appendix intentionally adopts the narrowest possible authority model in order to minimize ambiguity and verification complexity.

## On-Chain Binding

A revocation commitment SHOULD be represented as an on-chain event or equivalent public ledger commitment.

For EVM-compatible ledgers, the recommended event shape is:

```solidity
event RevocationCommitted(
    bytes32 indexed originalDigest,
    bytes32 indexed revocationDigest,
    address indexed revoker,
    uint256 timestamp
);
```

The originalDigest field binds the revocation commitment to the prior OCP commitment.

The revocationDigest field binds the revocation event to a revocation payload or metadata record.

The revoker field identifies the account publishing the revocation.

The timestamp field records ledger-relative time and MUST be interpreted as chain-provided time, not absolute external time.

Implementations MUST treat revocation as additive ledger state. The original commitment remains unchanged.

## Verification Semantics

Verifiers implementing this appendix MUST evaluate both original commitment existence and revocation state.

The recommended verification interface is:

```text
verifyWithRevocation(
    digest,
    asOfTimestamp
) → VALID | REVOKED | NOT_FOUND
```

Verification semantics are defined as follows:

### VALID

The original commitment exists and either:

- no revocation commitment exists, or
- the supplied asOfTimestamp precedes the revocation timestamp

### REVOKED

A revocation commitment exists and the supplied asOfTimestamp is equal to or later than the revocation timestamp.

### NOT_FOUND

No original commitment exists for the supplied digest.

Verifiers SHOULD distinguish between:

- historical validity
- present revocation state

A revoked commitment MAY still represent a historically valid observation commitment prior to revocation.

This appendix intentionally preserves temporal verification semantics rather than collapsing all verification into a single present-state interpretation.

## Relationship to Core OCP

This appendix does not modify the core Observation Commitment Protocol invariant.

The underlying OCP verification model remains:

observation → digest → public commitment → independent verification

Revocation introduces an additional commitment layer referencing a prior digest but does not alter or invalidate the existence of the original commitment itself.

The original observation commitment remains permanently verifiable as an immutable historical ledger fact.

This appendix therefore extends lifecycle interpretation without introducing mutable state into the core protocol.

## Test Vectors

Example implementations SHOULD include test vectors covering:

- successful revocation publication
- duplicate revocation rejection
- historical validity queries prior to revocation
- current-state revocation queries
- unauthorized revocation attempts
- non-existent digest verification
- revocation payload hashing consistency
- cross-client verification consistency

## Changelog

### v0.1.0

- Initial draft of revocation extension appendix
- Defined additive revocation model
- Defined one-way commitment state transitions
- Defined minimal authority model
- Defined temporal verification semantics
