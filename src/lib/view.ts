import type { PresentedItem, ViewFilters } from "./types";

const ATTENTION_RANK = {
  "needs-decision": 0,
  stopped: 1,
  "clearable-blocker": 2,
  none: 3,
} as const;

const STATE_RANK = {
  "stale-evidence": 0,
  blocked: 1,
  "in-progress": 2,
  planned: 3,
  idle: 4,
  done: 5,
} as const;

function activityMs(item: PresentedItem): number | null {
  if (!item.lastActivityAt) return null;
  const value = Date.parse(item.lastActivityAt);
  return Number.isNaN(value) ? null : value;
}

export function compareAttention(a: PresentedItem, b: PresentedItem): number {
  const byAttention = ATTENTION_RANK[a.displayAttention] - ATTENTION_RANK[b.displayAttention];
  if (byAttention !== 0) return byAttention;
  const byState = STATE_RANK[a.displayState] - STATE_RANK[b.displayState];
  if (byState !== 0) return byState;
  const aTime = activityMs(a);
  const bTime = activityMs(b);
  if (aTime === null && bTime === null) return a.id.localeCompare(b.id);
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  if (aTime !== bTime) return aTime - bTime;
  return a.id.localeCompare(b.id);
}

function compareByActivity(a: PresentedItem, b: PresentedItem, direction: "newest" | "oldest"): number {
  const aTime = activityMs(a);
  const bTime = activityMs(b);
  if (aTime === null && bTime === null) return a.id.localeCompare(b.id);
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  if (aTime !== bTime) return direction === "newest" ? bTime - aTime : aTime - bTime;
  return a.id.localeCompare(b.id);
}

export function applyView(items: PresentedItem[], filters: ViewFilters): PresentedItem[] {
  const query = filters.query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (filters.bot && item.ownerBot !== filters.bot) return false;
    if (filters.state && item.displayState !== filters.state) return false;
    if (filters.attention && item.displayAttention !== filters.attention) return false;
    if (filters.confidence && item.confidence !== filters.confidence) return false;
    if (!query) return true;
    const haystack = [
      item.ownerBot,
      item.task,
      item.nextStep,
      item.blocker,
      item.decision,
      item.lastActivitySummary,
      item.clearableBy,
      item.stoppedEvidence,
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    return haystack.includes(query);
  });
  filtered.sort((a, b) => {
    if (filters.sort === "newest") return compareByActivity(a, b, "newest");
    if (filters.sort === "oldest") return compareByActivity(a, b, "oldest");
    if (filters.sort === "owner") {
      const byOwner = a.ownerBot.localeCompare(b.ownerBot);
      return byOwner !== 0 ? byOwner : compareAttention(a, b);
    }
    return compareAttention(a, b);
  });
  return filtered;
}
