import type { AttentionReason, ClassifiedItem, WorkItem } from "./types";

export function classifyItem(item: WorkItem, now: Date): ClassifiedItem {
  const dueMs =
    item.commitment?.active && item.commitment.dueAt ? Date.parse(item.commitment.dueAt) : Number.NaN;
  const commitmentOverdue =
    !Number.isNaN(dueMs) &&
    dueMs < now.getTime() &&
    (item.state === "in-progress" || item.state === "blocked");

  let displayAttention = item.attention;
  let attentionReason: AttentionReason = null;

  if (item.state === "done" || item.state === "idle" || item.state === "planned" || item.state === "stale-evidence") {
    displayAttention = "none";
  } else if (item.state === "in-progress" && item.attention === "none" && commitmentOverdue) {
    displayAttention = "stopped";
    attentionReason = "overdue-commitment";
  } else if (item.attention === "stopped") {
    attentionReason = item.stoppedEvidence ? "reported-stop" : "overdue-commitment";
  }

  const freshUntilMs = item.freshUntil ? Date.parse(item.freshUntil) : Number.NaN;
  const windowElapsed = !Number.isNaN(freshUntilMs) && freshUntilMs < now.getTime();
  const evidenceIsStale = item.state === "done" ? false : item.explicitStale || windowElapsed;

  let displayState = item.state;
  if (item.state === "done" || item.state === "idle" || item.state === "planned") {
    displayState = item.state;
  } else if (item.state === "stale-evidence" || ((item.state === "in-progress" || item.state === "blocked") && evidenceIsStale)) {
    displayState = "stale-evidence";
  }

  return {
    ...item,
    displayState,
    displayAttention,
    attentionReason,
    commitmentOverdue,
    evidenceIsStale,
    quietBecauseComplete: item.state === "done",
  };
}
