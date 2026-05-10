# OCP Proof Format v1

An OCP proof is a portable verification artifact.

It contains the minimum information required to independently verify that a provided observation produces a digest committed to a referenced public ledger transaction.

---

## Required Fields

### version

Protocol proof format version.

Example:

ocp-1

---

### fileName

Human-readable name of the observed file or artifact.

This field is descriptive only.

It is not used for cryptographic verification.

---

### hash

The committed digest of the observation.

The digest MUST be represented as a `0x`-prefixed hexadecimal string.

Example:

0x14cca453684a18c1ef3e1c0b9a7744cfa06942660719bba373ef5fc36208bf73

---

### txHash

The public ledger transaction hash containing the commitment.

---

### network

The public ledger network where the commitment was recorded.

Example:

base-sepolia

---

### contract

The contract address or ledger commitment target from which the digest can be extracted.

---

### extractionRule

A deterministic rule describing how to extract the committed digest from the referenced transaction.

Example:

evm-event:Recorded(bytes32 indexed digest,address indexed recorder)

---

### timestamp

A producer-supplied timestamp in milliseconds since Unix epoch.

This field is informational only.

The ledger transaction provides the independently verifiable commitment reference.

---

## Verification Procedure

Given:

- an observation
- an OCP proof
- access to the referenced ledger transaction

A verifier MUST:

1. compute the digest of the observation using the hash function expected by the implementation
2. compare the computed digest to `hash`
3. resolve `txHash` on `network`
4. apply `extractionRule`
5. confirm that the extracted digest equals `hash`

Verification succeeds only if all checks pass.

---

## Non-Goals

The proof format does not prove:

- authorship
- identity
- real-world creation time
- semantic truth
- data availability
- application intent

The proof format proves only that a digest matching the provided observation was committed to a referenced public ledger transaction.