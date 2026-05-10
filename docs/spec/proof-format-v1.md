# OCP Proof Format v1

Machine-readable schema:

/docs/spec/proof-format-v1.schema.json

---

An OCP proof is a portable verification artifact.

It contains the minimum information required to independently verify that a provided observation produces a digest committed to a referenced public ledger transaction.

---

## Required Fields

### version

Protocol proof format version.

MUST be:

ocp-1

---

### fileName

Human-readable name of the observed file or artifact.

This field is descriptive only and is NOT used for cryptographic verification.

---

### hash

The committed digest of the observation.

MUST:
- be computed using SHA-256 (for v1)
- be represented as a 0x-prefixed lowercase hexadecimal string
- be exactly 32 bytes (64 hex characters)

Example:

0x14cca453684a18c1ef3e1c0b9a7744cfa06942660719bba373ef5fc36208bf73

---

### txHash

The public ledger transaction hash containing the commitment.

MUST:
- be a 0x-prefixed hexadecimal string
- represent a valid transaction identifier on the specified network

---

### network

The public ledger network where the commitment was recorded.

MUST:
- be a valid network identifier
- correspond to a network where txHash can be resolved

Example:

base-sepolia

---

### contract

The contract address or ledger commitment target from which the digest can be extracted.

MUST:
- be a valid address for the specified network
- correspond to the contract or location used to emit or store the digest

---

### extractionRule

A deterministic rule describing how to extract the committed digest from the referenced transaction.

MUST:
- be a parseable string
- define a deterministic extraction method
- yield a single digest value

Example:

evm-event:Recorded(bytes32 indexed digest,address indexed recorder)

---

### timestamp

A producer-supplied timestamp in milliseconds since Unix epoch.

This field is informational only.

It is NOT used for verification.

---

## Verification Procedure

Given:
- an observation
- an OCP proof
- access to the referenced ledger transaction

A verifier MUST:

1. compute the SHA-256 digest of the observation
2. compare the computed digest to `hash`
3. resolve `txHash` on `network`
4. apply `extractionRule` to the transaction
5. confirm that the extracted digest equals `hash`

Verification succeeds only if all checks pass.

---

## Failure Conditions

Verification MUST fail if:

- the computed digest does not equal `hash`
- `txHash` cannot be resolved
- `extractionRule` cannot be applied
- the extracted value does not equal `hash`
- any required field is missing or malformed

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