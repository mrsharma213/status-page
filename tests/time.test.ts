import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTimestamp, resolveTimeZone } from "../src/lib/time";

function norm(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ");
}

describe("timestamps", () => {
  it("formats the same instant in New York and Los Angeles", () => {
    const iso = "2026-01-15T12:00:00.000Z";
    const ny = norm(formatTimestamp(iso, "America/New_York"));
    const la = norm(formatTimestamp(iso, "America/Los_Angeles"));
    assert.match(ny, /Jan 15, 2026/);
    assert.match(ny, /7:00 AM/);
    assert.match(ny, /EST/);
    assert.match(la, /4:00 AM/);
    assert.match(la, /PST/);
  });

  it("uses daylight time in July", () => {
    const label = norm(formatTimestamp("2026-07-15T18:30:00.000Z", "America/New_York"));
    assert.match(label, /2:30 PM/);
    assert.match(label, /EDT/);
  });

  it("falls back when the display zone is invalid", () => {
    const resolved = resolveTimeZone("Not/AZone");
    assert.equal(resolved.timeZone, "America/New_York");
    assert.match(resolved.note ?? "", /America\/New_York/);
  });
});
