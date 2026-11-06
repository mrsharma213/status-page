import type { Snapshot, WorkItem } from "../src/lib/types";

export const NOW = new Date("2026-11-06T15:00:00.000Z");

export function work(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "item-1",
    ownerBot: "Northwind",
    task: "Sample task for the fixture",
    state: "in-progress",
    attention: "none",
    lastActivityAt: "2026-01-01T15:00:00.000Z",
    lastActivityTimeZone: "America/New_York",
    lastActivitySummary: "A sample activity was recorded.",
    nextStep: "Wait for the next sample run.",
    blocker: null,
    decision: null,
    clearableBy: null,
    evidenceUrl: null,
    evidenceLabel: null,
    confidence: "medium",
    freshUntil: null,
    explicitStale: false,
    stoppedEvidence: null,
    commitment: null,
    ...overrides,
  };
}

export function snap(items: WorkItem[], collectedAt = "2026-11-01T14:00:00.000Z"): Snapshot {
  return {
    schemaVersion: 1,
    snapshotId: "sample-snapshot",
    collectedAt,
    collector: "sample-collector",
    items,
  };
}
