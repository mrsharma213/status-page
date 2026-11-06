import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSafeEvidenceUrl, parseAllowlist } from "../src/lib/urls";

describe("evidence urls", () => {
  it("allows public https hosts and blocks private targets", () => {
    assert.equal(isSafeEvidenceUrl("https://example.com/synthetic/banner", null), true);
    for (const value of [
      "http://example.com/a",
      "javascript:alert(1)",
      "https://user:pass@example.com/a",
      "https://localhost/a",
      "https://printer.local/a",
      "https://127.0.0.1/a",
      "https://10.0.0.8/a",
      "https://192.168.1.9/a",
      "https://169.254.169.254/latest",
      "https://[::1]/a",
      "https://metadata.google.internal/a",
    ]) {
      assert.equal(isSafeEvidenceUrl(value, null), false, value);
    }
  });

  it("honors an allowlist", () => {
    const allow = parseAllowlist(" example.com, files.example.com ");
    assert.equal(isSafeEvidenceUrl("https://example.com/a", allow), true);
    assert.equal(isSafeEvidenceUrl("https://other.example/a", allow), false);
  });
});
