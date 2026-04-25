# Observation Commitment Protocol (OCP)

OCP defines a minimal verification boundary for independently confirming that a specific byte sequence was committed to a public ledger.

## Core Model

data → digest → public commitment

Verification reduces to:

recompute → compare → confirm inclusion

## What OCP Is

- A minimal primitive for committing arbitrary data digests
- A system-independent verification model
- A portable proof boundary

## What OCP Is Not

- Not storage
- Not identity
- Not authorship
- Not canonical encoding
- Not an application framework

## Why It Matters

Today, most systems require you to ask them what’s true.

OCP allows verification without relying on the originating system.

## Status

v1.0.0 Specification — Initial Release
