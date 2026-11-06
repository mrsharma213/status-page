import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateIngest } from "../src/lib/schema";
import { NOW, snap, work } from "./helpers";

describe("ingest schema", () => {
  it("accepts a reported stop and an overdue commitment", () => {
    const stopped = validateIngest(
      snap([
        work({
          attention: "stopped",
          stoppedEvidence: "The draft run ended after the outline. No follow-up run is scheduled.",
        }),
      ]),
      NOW,
      null,
    );
    assert.equal(stopped.ok, true);
    const overdue = validateIngest(
      snap([
        work({
          id: "overdue",
          attention: "stopped",
          commitment: {
            active: true,
            dueAt: "2026-10-01T16:00:00.000Z",
            evidence: "Committed to deliver the sample recap by Oct 1.",
          },
        }),
      ]),
      NOW,
      null,
    );
    assert.equal(overdue.ok, true);
  });

  it("rejects a stop that has no evidence and no overdue commitment", () => {
    const result = validateIngest(snap([work({ attention: "stopped" })]), NOW, null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.issues.some((issue) => issue.code === "stopped_evidence_required"));
  });

  it("rejects a decision request without the decision text", () => {
    const result = validateIngest(snap([work({ attention: "needs-decision", decision: null })]), NOW, null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.issues.some((issue) => issue.code === "decision_required"));
  });

  it("rejects a clearable blocker that names nobody", () => {
    const result = validateIngest(
      snap([
        work({
          state: "blocked",
          attention: "clearable-blocker",
          blocker: "Sample asset folder is missing the price sheet export.",
          clearableBy: null,
        }),
      ]),
      NOW,
      null,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.issues.some((issue) => issue.code === "clearable_by_required"));
  });

  it("rejects done work that is also flagged as stopped", () => {
    const result = validateIngest(
      snap([
        work({
          state: "done",
          attention: "stopped",
          stoppedEvidence: "This should not be accepted.",
        }),
      ]),
      NOW,
      null,
    );
    assert.equal(result.ok, false);
  });

  it("rejects unsafe evidence links and does not echo the value", () => {
    const secretish = "https://user:secret-token-value@example.com/path";
    const result = validateIngest(snap([work({ evidenceUrl: secretish })]), NOW, null);
    assert.equal(result.ok, false);
    const body = JSON.stringify(result);
    assert.equal(body.includes("secret-token-value"), false);
    assert.equal(body.includes("example.com"), false);
  });

  it("rejects a collected time in the future", () => {
    const result = validateIngest(snap([work()], "2026-11-06T16:00:00.000Z"), NOW, null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.issues[0]?.code, "future_collected_at");
  });

  it("rejects extra fields", () => {
    const payload = { ...snap([work()]), notes: "nope" };
    const result = validateIngest(payload, NOW, null);
    assert.equal(result.ok, false);
  });
});
