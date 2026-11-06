import { classifyItem } from "./classify";
import type { PresentedItem, ReadModel, Snapshot, WorkItem } from "./types";
import { formatTimestamp, resolveTimeZone } from "./time";
import { isSafeEvidenceUrl } from "./urls";
import { SYNTHETIC_NOTICE, syntheticSnapshot } from "./synthetic";

const STATE_LABEL = {
  planned: "Planned",
  idle: "Idle",
  "stale-evidence": "Stale evidence",
  blocked: "Blocked",
  "in-progress": "In progress",
  done: "Done",
} as const;

const ATTENTION_LABEL = {
  stopped: "Started, then stopped",
  "needs-decision": "Needs a decision",
  "clearable-blocker": "Another bot can clear",
  none: "No attention flag",
} as const;

function withSafeUrl(item: WorkItem, allowlist: string[] | null): WorkItem {
  if (!item.evidenceUrl) return item;
  if (isSafeEvidenceUrl(item.evidenceUrl, allowlist)) return item;
  return {
    ...item,
    evidenceUrl: null,
    evidenceLabel: "Link withheld by the current URL policy.",
  };
}

export function presentItem(item: WorkItem, now: Date, displayTimeZone: string, allowlist: string[] | null): PresentedItem {
  const safe = withSafeUrl(item, allowlist);
  const classified = classifyItem(safe, now);
  const lastActivityLabel = classified.lastActivityAt
    ? formatTimestamp(classified.lastActivityAt, classified.lastActivityTimeZone)
    : null;
  const freshUntilLabel = classified.freshUntil ? formatTimestamp(classified.freshUntil, displayTimeZone) : null;
  const dueLabel =
    classified.commitment?.dueAt ? formatTimestamp(classified.commitment.dueAt, displayTimeZone) : null;

  let freshnessLabel = "No freshness window declared.";
  if (classified.state === "done") {
    freshnessLabel = "Completed. Quiet after this is expected.";
  } else if (classified.state === "idle") {
    freshnessLabel = "Idle. No active commitment.";
  } else if (classified.state === "planned") {
    freshnessLabel = "Planned. Not started.";
  } else if (classified.evidenceIsStale && freshUntilLabel) {
    freshnessLabel = `Evidence window elapsed ${freshUntilLabel}.`;
  } else if (classified.evidenceIsStale) {
    freshnessLabel = "Marked stale by the collector.";
  } else if (freshUntilLabel) {
    freshnessLabel = `Evidence window open until ${freshUntilLabel}.`;
  }

  let statusNote: string | null = null;
  if (classified.quietBecauseComplete) {
    statusNote = "Completed. Quiet after this is expected.";
  } else if (classified.displayState === "in-progress" && classified.displayAttention === "none") {
    statusNote = "Still in progress. No stop was reported, and no active commitment is overdue.";
  } else if (classified.displayState === "stale-evidence" && classified.displayAttention === "none") {
    statusNote = "Evidence is stale. This is not treated as a stop.";
  } else if (classified.displayAttention === "needs-decision" && classified.commitmentOverdue) {
    statusNote = "An active commitment is also overdue.";
  }

  const reasonLabel =
    classified.attentionReason === "overdue-commitment"
      ? "Overdue active commitment."
      : classified.attentionReason === "reported-stop"
        ? "The collector reported a stop."
        : null;

  return {
    ...classified,
    lastActivityLabel,
    freshUntilLabel,
    dueLabel,
    freshnessLabel,
    stateLabel: STATE_LABEL[classified.displayState],
    attentionLabel: ATTENTION_LABEL[classified.displayAttention],
    reasonLabel,
    statusNote,
  };
}

function counts(items: PresentedItem[]): ReadModel["counts"] {
  return {
    needsDecision: items.filter((item) => item.displayAttention === "needs-decision").length,
    stopped: items.filter((item) => item.displayAttention === "stopped").length,
    clearable: items.filter((item) => item.displayAttention === "clearable-blocker").length,
    total: items.length,
  };
}

export function buildReadModel(input: {
  now: Date;
  displayTimeZone: string | undefined;
  allowlist: string[] | null;
  source:
    | { kind: "unconfigured" }
    | { kind: "unavailable" }
    | { kind: "empty" }
    | { kind: "synthetic" }
    | { kind: "snapshot"; storedAt: string; snapshot: Snapshot };
}): ReadModel {
  const zone = resolveTimeZone(input.displayTimeZone);
  const renderedAt = input.now.toISOString();
  const renderedLabel = formatTimestamp(renderedAt, zone.timeZone) ?? renderedAt;
  const base = {
    timeZoneNote: zone.note,
    displayTimeZone: zone.timeZone,
    renderedAt,
    renderedLabel,
  };

  if (input.source.kind === "unconfigured") {
    return {
      ...base,
      mode: "unconfigured",
      synthetic: false,
      notice: "Blob storage is not configured. Nothing is stored, and ingestion is off.",
      collectedAt: null,
      collectedLabel: null,
      storedAt: null,
      storedLabel: null,
      collector: null,
      items: [],
      counts: counts([]),
    };
  }
  if (input.source.kind === "unavailable") {
    return {
      ...base,
      mode: "unavailable",
      synthetic: false,
      notice: "The stored snapshot could not be read. No work is shown.",
      collectedAt: null,
      collectedLabel: null,
      storedAt: null,
      storedLabel: null,
      collector: null,
      items: [],
      counts: counts([]),
    };
  }
  if (input.source.kind === "empty") {
    return {
      ...base,
      mode: "empty",
      synthetic: false,
      notice: "No snapshot yet. This board stays empty until a collector posts one.",
      collectedAt: null,
      collectedLabel: null,
      storedAt: null,
      storedLabel: null,
      collector: null,
      items: [],
      counts: counts([]),
    };
  }

  const snapshot = input.source.kind === "synthetic" ? syntheticSnapshot() : input.source.snapshot;
  const storedAt = input.source.kind === "synthetic" ? snapshot.collectedAt : input.source.storedAt;
  const items = snapshot.items.map((item) => presentItem(item, input.now, zone.timeZone, input.allowlist));
  return {
    ...base,
    mode: input.source.kind === "synthetic" ? "synthetic" : "ready",
    synthetic: input.source.kind === "synthetic",
    notice: input.source.kind === "synthetic" ? SYNTHETIC_NOTICE : null,
    collectedAt: snapshot.collectedAt,
    collectedLabel: formatTimestamp(snapshot.collectedAt, zone.timeZone),
    storedAt,
    storedLabel: formatTimestamp(storedAt, zone.timeZone),
    collector: snapshot.collector,
    items,
    counts: counts(items),
  };
}
