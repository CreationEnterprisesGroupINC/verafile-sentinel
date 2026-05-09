# Protocol Documentation

This directory contains the formal specification for the Observation Commitment Protocol (OCP).

---

## Overview

OCP defines a minimal verification boundary for independently confirming that a specific byte sequence was committed to a ledger.

Verification reduces to:

recompute → compare → confirm inclusion

---

## Contents

### 📄 Specification
- `/spec/ocp-v1.0.0.md`

The canonical protocol definition, including the verification model, assumptions, and formal structure.

---

## Reading Order

- Start with the specification for the formal protocol definition
- Use `/examples` to inspect verification artifacts
- Use `/contracts` to inspect the minimal reference commitment primitive

---

## Scope Reminder

OCP defines only the verification boundary.

It does not specify:
- storage
- identity
- authorship
- application behavior
- deployment architecture

---

## Status

v1.0.0 — Initial Specification Release
