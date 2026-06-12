// lib/cmmc-mapping.ts
//
// Single source of truth for Verafile Sentinel's CMMC Level 2 mapping.
// The wording here is deliberate and assessment-safe: it follows the
// Verafile Sentinel CMMC L2 Mapping document v1.1. Do NOT edit status
// labels or role text casually — a generated PDF that says "satisfies"
// where this file says "evidence generation" is a channel-credibility
// incident waiting for an assessor to find it.

export const DOCUMENT_TYPES = [
  "Audit Log",
  "System Security Plan (SSP)",
  "POA&M",
  "Configuration Baseline",
  "Incident Report",
  "Vulnerability Scan Report",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function isDocumentType(v: unknown): v is DocumentType {
  return typeof v === "string" && (DOCUMENT_TYPES as readonly string[]).includes(v);
}

export type PracticeStatus =
  | "Directly implements"
  | "Partially supports"
  | "Evidence generation";

export interface PracticeMapping {
  id: string;
  title: string; // accurate paraphrase of the NIST SP 800-171 Rev 2 requirement
  status: PracticeStatus;
  role: string; // exactly what this anchor contributes — assessment-safe wording
}

// Practice definitions. `role` text consistently uses the "existed no later
// than" framing: an anchor bounds when an artifact existed; it does not
// independently prove when the underlying event occurred.
const PRACTICES: Record<string, Omit<PracticeMapping, "status" | "role">> = {
  "AU.L2-3.3.8": {
    id: "AU.L2-3.3.8",
    title:
      "Protect audit information and audit logging tools from unauthorized access, modification, and deletion",
  },
  "AU.L2-3.3.1": {
    id: "AU.L2-3.3.1",
    title:
      "Create and retain system audit logs and records to enable monitoring, analysis, investigation, and reporting of unlawful or unauthorized system activity",
  },
  "AU.L2-3.3.2": {
    id: "AU.L2-3.3.2",
    title:
      "Ensure that the actions of individual system users can be uniquely traced to those users so they can be held accountable",
  },
  "CA.L2-3.12.4": {
    id: "CA.L2-3.12.4",
    title:
      "Develop, document, and periodically update system security plans describing system boundary, environment, requirement implementation, and connections to other systems",
  },
  "CA.L2-3.12.1": {
    id: "CA.L2-3.12.1",
    title: "Periodically assess security controls to determine effectiveness",
  },
  "CA.L2-3.12.3": {
    id: "CA.L2-3.12.3",
    title:
      "Monitor security controls on an ongoing basis to ensure continued effectiveness",
  },
  "CM.L2-3.4.1": {
    id: "CM.L2-3.4.1",
    title:
      "Establish and maintain baseline configurations and inventories of organizational systems throughout system development life cycles",
  },
  "CM.L2-3.4.2": {
    id: "CM.L2-3.4.2",
    title:
      "Establish and enforce security configuration settings for information technology products employed in organizational systems",
  },
  "CM.L2-3.4.3": {
    id: "CM.L2-3.4.3",
    title: "Track, review, approve or disapprove, and log changes to organizational systems",
  },
  "IR.L2-3.6.1": {
    id: "IR.L2-3.6.1",
    title:
      "Establish an operational incident-handling capability (preparation, detection, analysis, containment, recovery, and user response activities)",
  },
  "IR.L2-3.6.2": {
    id: "IR.L2-3.6.2",
    title:
      "Track, document, and report incidents to designated officials and authorities, internal and external",
  },
  "RA.L2-3.11.2": {
    id: "RA.L2-3.11.2",
    title:
      "Scan for vulnerabilities in organizational systems and applications periodically and when new vulnerabilities affecting them are identified",
  },
};

function p(id: keyof typeof PRACTICES, status: PracticeStatus, role: string): PracticeMapping {
  return { ...PRACTICES[id], status, role };
}

export const MAPPING: Record<DocumentType, PracticeMapping[]> = {
  "Audit Log": [
    p(
      "AU.L2-3.3.8",
      "Directly implements",
      "Cryptographic integrity protection for audit information (per the AU-9(3) control lineage): any modification or deletion of the anchored log after the anchor block is cryptographically detectable. Access-control objectives for this practice remain the organization's responsibility; this anchor provides the integrity mechanism that complements them."
    ),
    p(
      "AU.L2-3.3.1",
      "Partially supports",
      "Supports the retention component: the anchored digest demonstrates that the retained log existed in this exact state no later than the anchor block, making the retained record forensically reliable. Log creation and content remain the organization's logging architecture's responsibility."
    ),
    p(
      "AU.L2-3.3.2",
      "Evidence generation",
      "For the anchoring operation itself: the commitment is bound on-chain to a committer address, creating a non-repudiable record of which system anchored this artifact and when. General user-activity traceability remains the logging architecture's job."
    ),
  ],
  "System Security Plan (SSP)": [
    p(
      "CA.L2-3.12.4",
      "Evidence generation",
      "This SSP revision's existence in this exact state is fixed no later than the anchor block; a sequence of anchored revisions produces a verifiable SSP version history with demonstrable update cadence, unaltered since anchoring."
    ),
    p(
      "CA.L2-3.12.1",
      "Evidence generation",
      "Establishes that this assessment artifact existed, in its presented form, no later than its anchor time and has not been altered since. Under a policy of anchoring at completion, anchor cadence substantiates assessment periodicity."
    ),
  ],
  "POA&M": [
    p(
      "CA.L2-3.12.1",
      "Evidence generation",
      "Establishes that this POA&M existed, in its presented form, no later than its anchor time and has not been altered since — substantiating the contemporaneity of control-assessment records."
    ),
    p(
      "CA.L2-3.12.3",
      "Evidence generation",
      "As part of a sequence of anchored monitoring artifacts, demonstrates the continuity of ongoing monitoring in a form that cannot be fabricated retroactively, because anchors cannot be created in the past."
    ),
  ],
  "Configuration Baseline": [
    p(
      "CM.L2-3.4.1",
      "Partially supports",
      "The anchored baseline's existence in this exact state is fixed no later than the anchor block, producing a tamper-evident baseline history that cannot be reconstructed retroactively. Establishing and approving baselines remains the organization's configuration-management process."
    ),
    p(
      "CM.L2-3.4.2",
      "Partially supports",
      "Enables drift-detection evidence: re-hashing deployed configurations against this anchored approved baseline demonstrates continuity or detects divergence. Enforcement and remediation remain the organization's configuration-management tooling's responsibility."
    ),
    p(
      "CM.L2-3.4.3",
      "Partially supports",
      "Contributes tamper-evident change tracking: anchored baseline versions give each change a verifiable identity that cannot be silently rewritten. Review and approval workflows remain organizational."
    ),
  ],
  "Incident Report": [
    p(
      "IR.L2-3.6.1",
      "Evidence generation",
      "Chain-of-custody integrity for incident artifacts: the artifact analyzed or presented later is provably the artifact that was anchored, with its existence in this state fixed no later than the anchor block. Where anchoring is performed at collection as procedure, this bounds collection time from above."
    ),
    p(
      "IR.L2-3.6.2",
      "Evidence generation",
      "Establishes that this incident record existed in this exact form no later than its anchor time — supporting demonstration that records presented to officials are the records produced at the time, not later reconstructions."
    ),
  ],
  "Vulnerability Scan Report": [
    p(
      "RA.L2-3.11.2",
      "Evidence generation",
      "Establishes that this scan report existed, in its presented form, no later than its anchor time — substantiating result integrity. Under anchoring-at-scan-completion as procedure, anchor cadence evidences scan cadence."
    ),
  ],
};

export const STATUS_LEGEND: Record<PracticeStatus, string> = {
  "Directly implements":
    "Sentinel is the technical mechanism for specific objectives of this practice; organizational policy and procedure are still required.",
  "Partially supports":
    "Sentinel materially contributes to this practice; other controls carry primary weight.",
  "Evidence generation":
    "Sentinel does not implement this practice; it provides tamper-evident, independently verifiable objective evidence of the organization's own implementation.",
};
