export const WORK_STATES = [
  "planned",
  "idle",
  "stale-evidence",
  "blocked",
  "in-progress",
  "done",
] as const;

export const ATTENTION_KINDS = [
  "stopped",
  "needs-decision",
  "clearable-blocker",
  "none",
] as const;

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export type WorkState = (typeof WORK_STATES)[number];
export type AttentionKind = (typeof ATTENTION_KINDS)[number];
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export type Commitment = {
  active: boolean;
  dueAt: string | null;
  evidence: string | null;
};

export type WorkItem = {
  id: string;
  ownerBot: string;
  task: string;
  state: WorkState;
  attention: AttentionKind;
  lastActivityAt: string | null;
  lastActivityTimeZone: string;
  lastActivitySummary: string;
  nextStep: string;
  blocker: string | null;
  decision: string | null;
  clearableBy: string | null;
  evidenceUrl: string | null;
  evidenceLabel: string | null;
  confidence: Confidence;
  freshUntil: string | null;
  explicitStale: boolean;
  stoppedEvidence: string | null;
  commitment: Commitment | null;
};

export type Snapshot = {
  schemaVersion: 1;
  snapshotId: string;
  collectedAt: string;
  collector: string;
  items: WorkItem[];
};

export type AttentionReason = "overdue-commitment" | "reported-stop" | null;

export type ClassifiedItem = WorkItem & {
  displayState: WorkState;
  displayAttention: AttentionKind;
  attentionReason: AttentionReason;
  commitmentOverdue: boolean;
  evidenceIsStale: boolean;
  quietBecauseComplete: boolean;
};

export type PresentedItem = ClassifiedItem & {
  lastActivityLabel: string | null;
  freshUntilLabel: string | null;
  dueLabel: string | null;
  freshnessLabel: string;
  stateLabel: string;
  attentionLabel: string;
  reasonLabel: string | null;
  statusNote: string | null;
};

export type BoardMode = "unconfigured" | "unavailable" | "empty" | "synthetic" | "ready";

export type ReadModel = {
  mode: BoardMode;
  synthetic: boolean;
  notice: string | null;
  timeZoneNote: string | null;
  collectedAt: string | null;
  collectedLabel: string | null;
  storedAt: string | null;
  storedLabel: string | null;
  collector: string | null;
  displayTimeZone: string;
  renderedAt: string;
  renderedLabel: string;
  items: PresentedItem[];
  counts: {
    needsDecision: number;
    stopped: number;
    clearable: number;
    total: number;
  };
};

export type ViewSort = "attention" | "newest" | "oldest" | "owner";

export type ViewFilters = {
  query: string;
  bot: string;
  state: string;
  attention: string;
  confidence: string;
  sort: ViewSort;
};
