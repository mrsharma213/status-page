import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { envFrom } from "../src/lib/env";
import { ingestDecision, ingestStatus, loginStatus, readBearer, syntheticAllowed } from "../src/lib/secrets";

const owner = "owner-password-value-01";
const auth = "auth-secret-value-0123456789abcd";
const ingest = "ingest-secret-value-0123456789abcd";
const bypass = "bypass-secret-value-0123456789abcd";

function env(overrides: Record<string, string | undefined> = {}) {
  return envFrom({
    OWNER_PASSWORD: owner,
    AUTH_SECRET: auth,
    INGEST_SECRET: ingest,
    VERCEL_AUTOMATION_BYPASS_SECRET: bypass,
    ...overrides,
  });
}

describe("secret separation", () => {
  it("accepts distinct owner, session, ingest, and bypass secrets", () => {
    const value = env();
    assert.equal(loginStatus(value), "ok");
    assert.equal(ingestStatus(value), "ok");
    assert.equal(ingestDecision(value, ingest), "ok");
  });

  it("does not treat the bypass secret or the owner password as the ingest token", () => {
    const value = env();
    assert.equal(ingestDecision(value, bypass), "unauthorized");
    assert.equal(ingestDecision(value, owner), "unauthorized");
    assert.equal(ingestDecision(value, auth), "unauthorized");
    assert.equal(ingestDecision(value, null), "unauthorized");
  });

  it("fails closed when secrets collide or are missing", () => {
    const shared = "shared-secret-value-0123456789abcd";
    assert.equal(loginStatus(env({ OWNER_PASSWORD: shared, INGEST_SECRET: shared })), "unconfigured");
    assert.equal(ingestStatus(env({ VERCEL_AUTOMATION_BYPASS_SECRET: ingest })), "unconfigured");
    assert.equal(loginStatus(env({ OWNER_PASSWORD: "short" })), "unconfigured");
    assert.equal(ingestStatus(env({ INGEST_SECRET: undefined })), "unconfigured");
    assert.equal(readBearer("Bearer token with spaces"), null);
  });

  it("refuses synthetic fixtures on Vercel even if both flags are set", () => {
    assert.equal(
      syntheticAllowed(envFrom({ ALLOW_SYNTHETIC_DEMO: "true", ALLOW_SYNTHETIC_DEMO_LOCAL: "true" })),
      true,
    );
    assert.equal(
      syntheticAllowed(envFrom({ ALLOW_SYNTHETIC_DEMO: "true", ALLOW_SYNTHETIC_DEMO_LOCAL: "true", VERCEL: "1" })),
      false,
    );
    assert.equal(
      syntheticAllowed(
        envFrom({ ALLOW_SYNTHETIC_DEMO: "true", ALLOW_SYNTHETIC_DEMO_LOCAL: "true", VERCEL_ENV: "preview" }),
      ),
      false,
    );
    assert.equal(syntheticAllowed(envFrom({ ALLOW_SYNTHETIC_DEMO: "true" })), false);
  });
});
