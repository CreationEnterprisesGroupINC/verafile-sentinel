# OCP v1.0.0 Specification

## Definition

An observation is defined as a byte sequence:

observation ∈ {0,1}*

A digest is computed:

H = hash(observation)

A commitment is made by including H in a public ledger transaction.

## Verification

Given:

- observation′
- H (committed digest)
- tx (referenced transaction)

Verification succeeds if:

H′ = hash(observation′)

H′ == H  
and  
H ∈ tx

## Invariant

recompute → compare → confirm inclusion

## Scope

OCP defines only the verification boundary.

It does not define:

- storage
- identity
- authorship
- encoding standards
- application-layer semantics
