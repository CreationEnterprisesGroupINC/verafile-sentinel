# Smart Contract Reference

OCP requires only a minimal ledger commitment primitive.

This folder includes a minimal Solidity reference contract:

- `ObservationCommitment.sol`

The contract emits digest commitment events that can be independently inspected from ledger data.

OCP defines the verification boundary.

Application logic, storage models, identity systems, and production deployment architectures are intentionally outside the scope of this repository.
