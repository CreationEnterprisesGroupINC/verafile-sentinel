# Evidential Survivability: OCP and Ethereum's CROPS Direction
## Independent Verification Infrastructure for the AI Era

*Damon Zwicker — May 2026*

---

## Abstract

Ethereum is increasingly positioning itself not as a faster or cheaper execution environment but as durable public infrastructure for an AI-driven world. Vitalik Buterin has articulated a direction for the Ethereum Foundation emphasizing censorship resistance, openness, privacy, and security — what he describes as the CROPS dimension — as the foundational priorities for Ethereum's long-term trajectory.

At the same time, AI systems are evolving from passive tools into autonomous operational actors capable of dynamic execution, delegated decision-making, and machine-to-machine economic coordination. This convergence creates a new infrastructural problem: how can observations, actions, and commitments remain independently verifiable after the originating systems, vendors, orchestration layers, or execution environments change?

The Observation Commitment Protocol (OCP) is not an AI governance framework, execution environment, or runtime control system. It defines one narrower infrastructural role: independent verification. This paper argues that OCP is an example of the kind of narrow, public, independently verifiable infrastructure that Ethereum's CROPS direction makes increasingly necessary — and that this alignment is already visible in public implementations today.

---

## Ethereum's Shift Toward Public Infrastructure

Ethereum's emerging direction reflects a judgment that the protocol's long-term significance derives not from transaction volume or execution throughput but from becoming a trust anchor and coordination substrate for increasingly autonomous systems.

The CROPS framework — censorship resistance, openness, privacy, and security — represents a commitment to building infrastructure that remains trustworthy under adversarial conditions, institutional change, and the passage of time. Buterin is explicit about this direction: "I think Ethereum should strive the hardest to be deeply impressive in a different dimension: the CROPS dimension." This is a fundamentally different objective than systems optimized around operational convenience or short-term performance metrics. It implies that the most important property Ethereum can provide is not speed but *survivability* — the ability for records, commitments, and proofs to remain independently verifiable long after the systems that produced them have changed or disappeared.

This is exactly the infrastructural property that becomes most valuable in the AI era. AI systems increasingly generate decisions, observations, recommendations, and autonomous economic actions. As these systems become more capable and more embedded in consequential processes, the integrity and survivability of their evidential history becomes a first-order concern — not just technically but legally, regulatorily, and institutionally.

---

## The Verification Crisis

Modern governance architectures already rely on layered visibility systems: dashboards, monitoring frameworks, policy engines, attestation systems, and runtime controls. These systems may govern behavior during operation. But operational visibility during execution is not the same as independently survivable accountability afterward.

Over time, systems encounter litigation, audits, regulatory scrutiny, adversarial review, vendor turnover, infrastructure migration, or outright platform failure. At that point, organizations discover that the ability to observe a system during operation does not guarantee the ability to independently reconstruct what happened later.

This gap becomes more acute in probabilistic AI systems where execution paths evolve dynamically, delegation chains fragment, and operational state may exist only transiently. The AI era introduces a new infrastructural challenge: *evidential survivability* — the ability of a commitment to outlast the infrastructure that produced it.

Without an independent verification boundary, commitments are implicitly bound to the systems that created them. When those systems change, the verifiability of the commitment changes with them. This is not a governance failure. It is an architectural one.

---

## The Narrow Role of OCP

The Observation Commitment Protocol intentionally limits its scope. It does not attempt to solve truth, authorship, governance, intent, or AI alignment. It isolates a narrower question:

> Can a committed digest be independently recomputed, compared, and checked against public ledger state — without relying on the originating platform, SDK, gateway, vendor, or orchestration environment?

Its verification invariant is minimal by design:

```
recompute → compare → confirm inclusion
```

Verification operates directly against public ledger state. No trusted dashboard is required. No trusted gateway is required. No trusted SDK is required. No trusted indexer is required. A verifier needs only a public RPC endpoint and the original observation bytes.

OCP is chain-agnostic, but Ethereum's CROPS direction provides one of the clearest philosophical homes for this kind of verification primitive.

---

### What OCP Does Not Claim

> OCP does not prove that an observation is true.
>
> OCP does not prove that an actor was authorized.
>
> OCP does not prove that an AI decision was correct.
>
> OCP does not guarantee data availability.
>
> OCP proves that a digest can be independently recomputed and matched to a public commitment on-chain.

This boundary is intentional and non-negotiable. It is what makes OCP composable with identity systems, governance frameworks, and attestation layers without absorbing their semantics.

---

## CROPS and OCP: The Architectural Alignment

### Censorship Resistance

Once committed, the digest remains independently checkable through public ledger state. Verification does not depend on the originating application, vendor, gateway, or institution remaining available. This is what censorship resistance means in practice: not the absence of an adversary, but the structural inability of any single actor to revoke the verifiability of a commitment after the fact.

### Openness

OCP verification is publicly recomputable. Any verifier with access to public chain data can independently confirm the digest, the inclusion, and the transaction linkage. There is no permissioned verification layer, no API key required, no SDK dependency. The verification procedure is a published algorithm applied to public data. Any implementation that follows the algorithm produces the same result.

### Privacy

OCP does not make private data public. It allows a public commitment to exist without requiring the underlying data to be disclosed. The commitment itself — the digest anchored on-chain — reveals nothing about the observation it represents. Privacy depends on what is later disclosed: verification requires the relevant observation bytes, but the commitment can exist indefinitely without them. This creates a separation between verification capability and data disclosure that is meaningful for systems operating on sensitive inputs.

### Security

OCP minimizes trusted surfaces. The verifier does not need to trust proprietary APIs, centralized dashboards, gateways, SDKs, or operational vendors. This makes verification substantially more resilient under adversarial conditions. An attacker who compromises the originating system, gateway, or SDK cannot retroactively invalidate the on-chain commitment because the committed digest remains independently checkable through public ledger state.

---

## Modular Trust Architecture

One of the most important architectural shifts emerging in the AI era is the decomposition of trust into independent infrastructure layers. Increasingly, production systems are separating identity, commitment, verification, governance, and execution admissibility into composable components rather than collapsing them into a single platform trust assumption.

This is visible in the stack that has emerged from collaborative work across four builders in three countries:

| Layer | Standard | Question it answers |
|---|---|---|
| Identity | ERC-8004 | Who is the agent? |
| Input Trust | WYRIWE / ERC-8263 profile | What did the agent actually receive? |
| Commitment | ERC-8263 | What was committed on-chain? |
| Verification | OCP | Can the commitment be independently verified from chain state alone? |
| Interface | ERC-8274 | Can any contract consume the proof? |

Each layer answers a materially different question. Each is independently specified. None absorbs the semantics of the others.

This separation matters because governance systems themselves eventually become subject to institutional drift, infrastructure replacement, adversarial challenge, and operational decay. Without independent verification boundaries, governance architectures risk collapsing into opaque authority systems whose integrity must simply be trusted. OCP provides the verification boundary — the structural guarantee that what was committed can be independently checked — on top of which governance systems can operate with more confidence.

---

## Production Evidence

This is not only theoretical alignment. The stack is already visible in public implementations.

ERC-8263 v0.2 cites OCP's boundary statement verbatim in its verification disclaimer. The verification invariant is formally codified in Appendix A.2 of the active Ethereum standard (PR #1748, ethereum/ERCs). As of May 2026, over 742 proofs have been anchored across four chains. A live AI agent bounty settled on Base Sepolia in May 2026 — no oracle, no intermediary, no trusted third party — with the identity, input provenance, commitment, verification, and gateway attestation layers running end-to-end.

ERC-8274 (AI Inference Proof Verification Interfaces, PR #1771) names OCP as the unifying verification primitive across zkML, opML, TEE, oracle, and multisig backends. A Composition Note co-authored by Vincent Wu (ERC-8263), Damon Zwicker (OCP), and Tiago Merlini (ERC-8004 / WYRIWE) documents how the layers compose and is published on ethresear.ch. Full references are in the appendix.

The architecture Ethereum's CROPS direction calls for is not waiting for future development. It exists today, operating on public infrastructure, verifiable by anyone with a public RPC endpoint.

---

## Why Narrow Systems Matter

OCP is an example of a class of infrastructure Ethereum's CROPS direction makes necessary: narrow, public, independently verifiable primitives that provide durable guarantees without absorbing governance, identity, or application semantics.

Ethereum increasingly favors modularity, credible neutrality, minimized trust assumptions, and constrained protocol scope. OCP follows the same architectural discipline. It does not attempt to absorb governance, execution control, identity semantics, or institutional authority.

This narrowness is a resilience strategy. Systems that attempt to absorb too many responsibilities often become centralized, opaque, politically brittle, and difficult to independently verify. Constrained systems are easier to reason about under adversarial conditions. They are easier to audit, easier to compose with, and easier to trust precisely because there is less to trust.

In the AI era, where systems are probabilistic, autonomous, and difficult to predict, the ability to reason clearly about what a primitive does and does not do becomes increasingly valuable. A verification layer that also handles identity is harder to trust than one that handles only verification. A commitment layer that also handles governance introduces entanglement that makes both functions harder to audit independently.

The decomposition is the architecture.

---

## Conclusion

Ethereum's CROPS direction reflects an attempt to preserve trustworthy public infrastructure in an era increasingly shaped by autonomous systems, probabilistic computation, institutional centralization, and machine-scale coordination. The most important property Ethereum can provide is not execution speed — it is evidential survivability: the ability for commitments to outlast the systems that produced them.

OCP is an example of the kind of narrow, public, independently verifiable infrastructure this direction makes necessary. It does not answer what is true, what is allowed, or who is responsible. It answers whether a committed digest can be independently recomputed and matched against public ledger state — by anyone, at any time, from any client, without trusting the system that produced it.

Independent verification does not solve the AI alignment problem. It does not replace governance. It provides the floor beneath both.

That is not a small thing. In the era of autonomous computation, it may be one of the most important properties any infrastructure can provide.

---

## References and Evidence Appendix

**CROPS / EF Direction (Primary Source)**
- Vitalik Buterin, May 2026: x.com/VitalikButerin/status/2058583593102844111

**OCP**
- Specification: github.com/damonzwicker/observation-commitment-protocol
- ethresear.ch publication: ethresear.ch/t/observation-commitment-protocol-ocp-v1-0-0/24602
- npm package: npmjs.com/package/ocp-verify (ocp-verify@1.1.0)
- Base Sepolia contract: 0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c
- Solana devnet: GCXRKzreL2fdYBpnfmKzFqTxE46eGmwQuErMw4uZ1DUL

**ERC-8263 v0.2 (OCP boundary citation)**
- PR #1748: github.com/ethereum/ERCs/pull/1748
- ETH Mainnet contract: 0xe95d6a15966984c209a62a2c188828555eb5ec3d (Etherscan Exact Match)
- L2 mainnets (Polygon/Base/BSC): 0x87dd3A56AFD0D2c488aD7E13fB036b59144b25dC

**ERC-8274 (OCP as unifying primitive)**
- PR #1771: github.com/ethereum/ERCs/pull/1771
- Ethereum Magicians thread: ethereum-magicians.org/t/erc-8274-ai-inference-proof-verification/28083

**ERC-8004**
- Ethereum Magicians thread: ethereum-magicians.org/t/erc-8004-trustless-agents/25098
- Reference implementation: gateway.ensub.org

**WYRIWE**
- ERC draft: github.com/TMerlini/wyriwe
- Ethereum Magicians thread: ethereum-magicians.org/t/wyriwe-what-you-read-is-what-you-execute-input-provenance-for-verifiable-ai-inference/28655

**Composition Note (Wu / Zwicker / Merlini)**
- ethresear.ch: ethresear.ch/t/composition-note-erc-8004-erc-8263-ocp-a-reference-guide-for-implementers-building-on-the-ai-agent-verification-stack/24995
- Gist: gist.github.com/damonzwicker/8742e742bdc627b8e2179c00b81289dc

**Live Bounty Settlement — Base Sepolia, May 2026**
- Contract: 0x57fe09a6Eb8d5741b24fF640AA8Bc4D2010B93D7
- Claim tx: sepolia.basescan.org/tx/0x2780f94d11ad3766e7d370b1016d3ba917933f8111ddd42d3fcab2226cd380e4
- Verify endpoint: gateway.ensub.org/agent/verify/758d61f26a44448384e5c4468a0dcb7a2abe456067b0f7b505bc28b9411fe931
- Contract source: gist.github.com/TMerlini/bf3abd30c332cccb257d0e5bdff1ff95

**OCP Discussions-To (Ethereum Magicians)**
- ethereum-magicians.org/t/draft-erc-observation-commitment-protocol-ocp-chain-agnostic-cryptographic-commitment-primitive/28399

