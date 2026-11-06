import { z } from "zod";
import { ATTENTION_KINDS, CONFIDENCE_LEVELS, WORK_STATES, type Snapshot, type WorkItem } from "./types";
import { MAX_ITEMS } from "./text";
import { hasUnsafeChars } from "./text";
import { isIanaTimeZone, isIsoWithZone } from "./time";
import { isSafeEvidenceUrl } from "./urls";

export type SchemaIssue = { path: string; code: string };

const bounded = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !hasUnsafeChars(value), { params: { code: "unsafe_text" } });

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !hasUnsafeChars(value), { params: { code: "unsafe_text" } })
    .nullable();

const iso = z.string().refine(isIsoWithZone, { params: { code: "invalid_time" } });

const commitmentSchema = z
  .object({
    active: z.boolean(),
    dueAt: iso.nullable(),
    evidence: nullableText(300),
  })
  .strict();

export const workItemSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/),
    ownerBot: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,40}$/),
    task: bounded(180),
    state: z.enum(WORK_STATES),
    attention: z.enum(ATTENTION_KINDS),
    lastActivityAt: iso.nullable(),
    lastActivityTimeZone: z.string().refine(isIanaTimeZone, { params: { code: "invalid_timezone" } }),
    lastActivitySummary: bounded(300),
    nextStep: bounded(300),
    blocker: nullableText(300),
    decision: nullableText(300),
    clearableBy: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,40}$/)
      .nullable(),
    evidenceUrl: z.string().max(500).nullable(),
    evidenceLabel: nullableText(80),
    confidence: z.enum(CONFIDENCE_LEVELS),
    freshUntil: iso.nullable(),
    explicitStale: z.boolean(),
    stoppedEvidence: nullableText(300),
    commitment: commitmentSchema.nullable(),
  })
  .strict();

export const snapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    snapshotId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    collectedAt: iso,
    collector: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/),
    items: z.array(workItemSchema).max(MAX_ITEMS),
  })
  .strict();

const storedSchema = z
  .object({
    storedAt: iso,
    snapshot: snapshotSchema,
  })
  .strict();

function issueFromZod(issue: z.ZodIssue): SchemaIssue {
  const path = issue.path.map(String).join(".") || "(root)";
  const params = "params" in issue ? issue.params : undefined;
  if (params && typeof params === "object" && "code" in params && typeof params.code === "string") {
    return { path, code: params.code };
  }
  return { path, code: issue.code };
}

function push(issues: SchemaIssue[], path: string, code: string) {
  issues.push({ path, code });
}

function crossCheck(item: WorkItem, index: number, collectedAt: string, allowlist: string[] | null, issues: SchemaIssue[]) {
  const path = `items.${index}`;
  const decision = Boolean(item.decision);
  const blocker = Boolean(item.blocker);
  const clearable = Boolean(item.clearableBy);
  const stopped = Boolean(item.stoppedEvidence);
  const quietState = item.state === "done" || item.state === "idle" || item.state === "planned";

  if (item.evidenceUrl && !isSafeEvidenceUrl(item.evidenceUrl, allowlist)) {
    push(issues, `${path}.evidenceUrl`, "unsafe_url");
  }
  if (item.lastActivityAt && Date.parse(item.lastActivityAt) > Date.parse(collectedAt) + 5 * 60 * 1000) {
    push(issues, `${path}.lastActivityAt`, "future_activity");
  }
  if (item.commitment?.active && (!item.commitment.dueAt || !item.commitment.evidence)) {
    push(issues, `${path}.commitment`, "commitment_incomplete");
  }

  if (quietState) {
    if (item.attention !== "none") push(issues, `${path}.attention`, "attention_state_mismatch");
    if (decision) push(issues, `${path}.decision`, "decision_forbidden");
    if (blocker) push(issues, `${path}.blocker`, "blocker_forbidden");
    if (clearable) push(issues, `${path}.clearableBy`, "clearable_by_forbidden");
    if (stopped) push(issues, `${path}.stoppedEvidence`, "stopped_evidence_forbidden");
    if (item.commitment?.active) push(issues, `${path}.commitment`, "commitment_forbidden");
    if (item.explicitStale) push(issues, `${path}.explicitStale`, "explicit_stale_forbidden");
    return;
  }

  if (item.state === "stale-evidence") {
    if (item.attention !== "none") push(issues, `${path}.attention`, "attention_state_mismatch");
    const freshUntilPast = Boolean(item.freshUntil && Date.parse(item.freshUntil) <= Date.parse(collectedAt));
    if (!item.explicitStale && !freshUntilPast) push(issues, `${path}.explicitStale`, "explicit_stale_required");
    if (decision) push(issues, `${path}.decision`, "decision_forbidden");
    if (blocker) push(issues, `${path}.blocker`, "blocker_forbidden");
    if (clearable) push(issues, `${path}.clearableBy`, "clearable_by_forbidden");
    if (stopped) push(issues, `${path}.stoppedEvidence`, "stopped_evidence_forbidden");
    if (item.commitment?.active) push(issues, `${path}.commitment`, "commitment_forbidden");
    return;
  }

  if (item.state === "blocked") {
    if (!blocker) push(issues, `${path}.blocker`, "blocker_required");
    if (stopped) push(issues, `${path}.stoppedEvidence`, "stopped_evidence_forbidden");
    if (item.attention === "stopped") push(issues, `${path}.attention`, "attention_state_mismatch");
    if (item.attention === "clearable-blocker") {
      if (!clearable) push(issues, `${path}.clearableBy`, "clearable_by_required");
      if (decision) push(issues, `${path}.decision`, "decision_forbidden");
    } else if (item.attention === "needs-decision") {
      if (!decision) push(issues, `${path}.decision`, "decision_required");
      if (clearable) push(issues, `${path}.clearableBy`, "clearable_by_forbidden");
    } else if (item.attention === "none") {
      if (decision) push(issues, `${path}.decision`, "decision_forbidden");
      if (clearable) push(issues, `${path}.clearableBy`, "clearable_by_forbidden");
    }
    return;
  }

  if (item.state === "in-progress") {
    if (item.attention === "clearable-blocker") push(issues, `${path}.attention`, "attention_state_mismatch");
    if (blocker) push(issues, `${path}.blocker`, "blocker_forbidden");
    if (clearable) push(issues, `${path}.clearableBy`, "clearable_by_forbidden");
    if (item.attention === "needs-decision") {
      if (!decision) push(issues, `${path}.decision`, "decision_required");
    } else if (decision) {
      push(issues, `${path}.decision`, "decision_forbidden");
    }
    if (item.attention === "stopped") {
      const overdueAtCollection = Boolean(
        item.commitment?.active &&
          item.commitment.dueAt &&
          Date.parse(item.commitment.dueAt) <= Date.parse(collectedAt),
      );
      if (!stopped && !overdueAtCollection) push(issues, `${path}.stoppedEvidence`, "stopped_evidence_required");
    } else if (stopped) {
      push(issues, `${path}.stoppedEvidence`, "stopped_evidence_forbidden");
    }
  }
}

export function parseSnapshotStructural(
  input: unknown,
  allowlist: string[] | null,
): { ok: true; snapshot: Snapshot } | { ok: false; issues: SchemaIssue[] } {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.slice(0, 30).map(issueFromZod) };
  }
  const snapshot = parsed.data;
  const issues: SchemaIssue[] = [];
  const seen = new Set<string>();
  snapshot.items.forEach((item, index) => {
    if (seen.has(item.id)) push(issues, `items.${index}.id`, "duplicate_id");
    seen.add(item.id);
    crossCheck(item, index, snapshot.collectedAt, allowlist, issues);
  });
  if (issues.length > 0) return { ok: false, issues: issues.slice(0, 30) };
  return { ok: true, snapshot };
}

export function validateIngest(
  input: unknown,
  now: Date,
  allowlist: string[] | null,
): { ok: true; snapshot: Snapshot } | { ok: false; issues: SchemaIssue[] } {
  const structural = parseSnapshotStructural(input, allowlist);
  if (!structural.ok) return structural;
  const collected = Date.parse(structural.snapshot.collectedAt);
  if (collected > now.getTime() + 5 * 60 * 1000) {
    return { ok: false, issues: [{ path: "collectedAt", code: "future_collected_at" }] };
  }
  return structural;
}

export function parseStoredDocument(
  input: unknown,
  allowlist: string[] | null,
): { ok: true; storedAt: string; snapshot: Snapshot } | { ok: false; issues: SchemaIssue[] } {
  const parsed = storedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.slice(0, 30).map(issueFromZod) };
  }
  const structural = parseSnapshotStructural(parsed.data.snapshot, allowlist);
  if (!structural.ok) return structural;
  return { ok: true, storedAt: parsed.data.storedAt, snapshot: structural.snapshot };
}
