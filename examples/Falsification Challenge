# OCP Falsification Challenge

This example demonstrates the core OCP verification invariant:

recompute → compare → confirm inclusion

The observation is `observation.txt`.

---

## Manual Verification (No Tools Required)

You can verify this example independently using any SHA-256 implementation and a public block explorer.

### Step 1 — Compute the digest

Run:

shasum -a 256 observation.txt

(or use any equivalent SHA-256 tool)

This produces H′.

---

### Step 2 — Compare

Confirm that:

H′ == H (from proof.json)

---

### Step 3 — Confirm inclusion

Open the referenced transaction:

https://sepolia.basescan.org/tx/PASTE_TX_HASH_HERE

Inspect the transaction data or logs.

Confirm that the digest H appears in the transaction.

---

If all checks pass → verification succeeds.

If any check fails → verification fails.

---

## Optional UI Verification

You can also verify this example using the VeraFile demo:

https://observation-commitment-protocol.vercel.app/

Upload the file and proof.

The system will perform the same steps automatically.

Use of this interface is not required for verification.

---

## Falsification Test

1. Verify the original `observation.txt`  
2. Modify any single character in the file  
3. Repeat verification  

The modified file must fail verification.

If it still verifies successfully, the system is broken.
