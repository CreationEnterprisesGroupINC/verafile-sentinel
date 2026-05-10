# OCP Reference Verifier

A minimal, zero-dependency verifier for OCP proofs.

This script demonstrates the core verification invariant:

recompute → compare → confirm inclusion

---

## Usage

Run:

node verify.js <file> <proof.json>

Example:

node verify.js ../examples/example-observation.txt ../examples/example-proof.ocp.json

---

## What It Does

The verifier performs:

1. Computes SHA-256 hash of the file  
2. Compares it to the `hash` field in the proof  
3. Outputs VALID or INVALID  

---

## Output

If the file matches the proof:

VALID: file hash matches proof hash

If the file has been modified:

INVALID: hash mismatch

---

## Important

This verifier checks only:

- recompute  
- compare  

It does not perform:

- transaction lookup  
- extraction rule execution  
- on-chain verification  

Those steps are defined in the protocol and must be performed independently.

---

## Purpose

This script exists to demonstrate:

- minimal verification logic  
- independence from any platform or API  
- reproducibility of OCP proofs  

It is not a production tool.

---

## Next Steps

To fully verify a proof:

1. Resolve `txHash` on the specified network  
2. Apply `extractionRule`  
3. Confirm the digest exists in the transaction  

This completes the OCP verification process.