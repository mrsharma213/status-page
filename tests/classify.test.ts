import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyItem } from "../src/lib/classify";
import { buildReadModel } from "../src/lib/board";
import { syntheticSnapshot } from "../src/lib/synthetic";
import { NOW, work } from "./helpers";

describe("classification", () => {
  it("does not treat a quiet in-progress item as stopped", () => {
    const item = classifyItem(
      work({ lastActivityAt: "2024-06-01T16:00:00.000Z", freshUntil: "2027-01-01T00:00:00.000Z" }),
      NOW,
    );
    assert.equal(item.displayState, "in-progress");
    assert.equal(item.displayAttention, "none");
    assert.equal(item.attentionReason, null);
  });

  it("promotes an overdue active commitment to stopped", () => {
    const item = classifyItem(
      work({
        commitment: {
          active: true,
          dueAt: "2026-10-01T16:00:00.000Z",
          evidence: "Committed to deliver the sample recap by Oct 1.",
        },
      }),
      NOW,
    );
    assert.equal(item.displayAttention, "stopped");
    assert.equal(item.attentionReason, "overdue-commitment");
    assert.equal(item.commitmentOverdue, true);
  });

  it("leaves a future commitment in progress", () => {
    const item = classifyItem(
      work({
        commitment: {
          active: true,
          dueAt: "2026-12-01T16:00:00.000Z",
          evidence: "Committed to deliver the sample recap in December.",
        },
      }),
      NOW,
    );
    assert.equal(item.displayAttention, "none");
    assert.equal(item.commitmentOverdue, false);
  });

  it("keeps a decision in the decision list when a commitment is also overdue", () => {
    const item = classifyItem(
      work({
        attention: "needs-decision",
        decision: "Ship the violet sample banner, or hold it.",
        commitment: {
          active: true,
          dueAt: "2026-10-01T16:00:00.000Z",
          evidence: "Committed to deliver the sample recap by Oct 1.",
        },
      }),
      NOW,
    );
    assert.equal(item.displayAttention, "needs-decision");
    assert.equal(item.commitmentOverdue, true);
  });

  it("marks stale evidence without calling the work stopped", () => {
    const item = classifyItem(work({ freshUntil: "2026-08-01T00:00:00.000Z" }), NOW);
    assert.equal(item.displayState, "stale-evidence");
    assert.equal(item.displayAttention, "none");
    assert.equal(item.evidenceIsStale, true);
  });

  it("keeps completed work done when it is old or marked stale", () => {
    const item = classifyItem(
      work({
        state: "done",
        attention: "none",
        lastActivityAt: "2024-01-01T00:00:00.000Z",
        freshUntil: "2024-02-01T00:00:00.000Z",
      }),
      NOW,
    );
    assert.equal(item.displayState, "done");
    assert.equal(item.displayAttention, "none");
    assert.equal(item.quietBecauseComplete, true);
    assert.equal(item.evidenceIsStale, false);
  });

  it("does not infer a stall for idle or planned work", () => {
    const idle = classifyItem(work({ state: "idle", lastActivityAt: null }), NOW);
    const planned = classifyItem(work({ state: "planned", lastActivityAt: null }), NOW);
    assert.equal(idle.displayState, "idle");
    assert.equal(planned.displayState, "planned");
    assert.equal(idle.displayAttention, "none");
    assert.equal(planned.displayAttention, "none");
  });
});

describe("synthetic board", () => {
  it("places only explicit attention in the three lists", () => {
    const model = buildReadModel({
      now: NOW,
      displayTimeZone: "America/New_York",
      allowlist: null,
      source: { kind: "synthetic" },
    });
    assert.equal(model.synthetic, true);
    assert.match(model.notice ?? "", /Synthetic example/);
    const stopped = model.items.filter((item) => item.displayAttention === "stopped").map((item) => item.id);
    assert.deepEqual(stopped.sort(), ["overdue-commitment", "reported-stop"]);
    assert.equal(model.items.find((item) => item.id === "quiet-progress")?.displayAttention, "none");
    assert.equal(model.items.find((item) => item.id === "done-notes")?.displayState, "done");
    assert.equal(model.items.find((item) => item.id === "stale-review")?.displayState, "stale-evidence");
    assert.equal(model.counts.needsDecision, 1);
    assert.equal(model.counts.clearable, 1);
    assert.equal(syntheticSnapshot().collector, "synthetic-fixture");
  });
});
