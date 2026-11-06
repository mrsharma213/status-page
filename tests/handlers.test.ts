import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { envFrom } from "../src/lib/env";
import { handleIngest, handleSnapshot } from "../src/lib/handlers";
import { buildReadModel } from "../src/lib/board";
import type { SnapshotStore } from "../src/lib/store";
import { NOW, snap, work } from "./helpers";

const owner = "owner-password-value-01";
const auth = "auth-secret-value-0123456789abcd";
const ingest = "ingest-secret-value-0123456789abcd";
const bypass = "bypass-secret-value-0123456789abcd";
const marker = "UNIQUE_PAYLOAD_MARKER_SHOULD_NOT_ECHO";

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return envFrom({
    OWNER_PASSWORD: owner,
    AUTH_SECRET: auth,
    INGEST_SECRET: ingest,
    VERCEL_AUTOMATION_BYPASS_SECRET: bypass,
    BLOB_STORE_ID: "store_synthetic",
    ...overrides,
  });
}

function memoryStore(): SnapshotStore & { body: string | null; writes: number } {
  const state: { body: string | null; writes: number } = { body: null, writes: 0 };
  return {
    get body() {
      return state.body;
    },
    get writes() {
      return state.writes;
    },
    async read() {
      return state.body;
    },
    async write(body: string) {
      state.body = body;
      state.writes += 1;
    },
  };
}

function payload() {
  return snap([
    work({
      task: marker,
      attention: "needs-decision",
      decision: "Ship the sample banner, or hold it.",
    }),
  ]);
}

describe("snapshot route", () => {
  it("returns no task data without a read session", async () => {
    const response = await handleSnapshot(new Request("https://status.example/api/snapshot"), {
      hasReadSession: async () => false,
      load: async () => {
        throw new Error("load should not run");
      },
    });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const body = await response.json();
    assert.deepEqual(body, { error: "unauthorized" });
  });

  it("does not accept the machine bearer as a read session", async () => {
    const response = await handleSnapshot(
      new Request("https://status.example/api/snapshot", { headers: { authorization: `Bearer ${ingest}` } }),
      {
        hasReadSession: async () => true,
        load: async () => {
          throw new Error("load should not run");
        },
      },
    );
    const text = await response.text();
    assert.equal(response.status, 401);
    assert.equal(text.includes(ingest), false);
    assert.equal(text.includes("items"), false);
  });

  it("returns the board for a cookie session", async () => {
    const model = buildReadModel({
      now: NOW,
      displayTimeZone: "America/New_York",
      allowlist: null,
      source: { kind: "empty" },
    });
    const response = await handleSnapshot(new Request("https://status.example/api/snapshot"), {
      hasReadSession: async () => true,
      load: async () => model,
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mode, "empty");
    assert.equal(body.synthetic, false);
  });
});

describe("ingest route", () => {
  it("rejects missing, wrong, owner, and bypass bearers without writing", async () => {
    const store = memoryStore();
    for (const header of [null, "Bearer wrong-token-value", `Bearer ${owner}`, `Bearer ${bypass}`]) {
      const headers = new Headers({ "content-type": "application/json" });
      if (header) headers.set("authorization", header);
      const response = await handleIngest(
        new Request("https://status.example/api/ingest", { method: "POST", headers, body: JSON.stringify(payload()) }),
        { env: baseEnv(), now: NOW, store },
      );
      assert.equal(response.status, 401);
      assert.equal(store.writes, 0);
      const text = await response.text();
      assert.equal(text.includes(marker), false);
    }
  });

  it("does not let a read session replace the machine token", async () => {
    const store = memoryStore();
    const response = await handleIngest(
      new Request("https://status.example/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "authjs.session-token=session" },
        body: JSON.stringify(payload()),
      }),
      { env: baseEnv(), now: NOW, store },
    );
    assert.equal(response.status, 401);
    assert.equal(store.writes, 0);
  });

  it("refuses a bypass cookie request", async () => {
    const response = await handleIngest(
      new Request("https://status.example/api/ingest", {
        method: "POST",
        headers: {
          authorization: `Bearer ${ingest}`,
          "content-type": "application/json",
          "x-vercel-set-bypass-cookie": "true",
        },
        body: JSON.stringify(payload()),
      }),
      { env: baseEnv(), now: NOW, store: memoryStore() },
    );
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, { error: "bypass_cookie_forbidden" });
  });

  it("fails closed when storage is not configured", async () => {
    const response = await handleIngest(
      new Request("https://status.example/api/ingest", {
        method: "POST",
        headers: { authorization: `Bearer ${ingest}`, "content-type": "application/json" },
        body: JSON.stringify(payload()),
      }),
      { env: baseEnv({ BLOB_STORE_ID: undefined, BLOB_READ_WRITE_TOKEN: undefined }), now: NOW, store: null },
    );
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.equal(text.includes(marker), false);
    assert.match(text, /storage_unconfigured/);
  });

  it("stores a valid snapshot and returns no item text", async () => {
    const store = memoryStore();
    const response = await handleIngest(
      new Request("https://status.example/api/ingest", {
        method: "POST",
        headers: { authorization: `Bearer ${ingest}`, "content-type": "application/json" },
        body: JSON.stringify(payload()),
      }),
      { env: baseEnv(), now: NOW, store },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.itemCount, 1);
    assert.equal(JSON.stringify(body).includes(marker), false);
    assert.equal(store.writes, 1);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(response.headers.get("set-cookie"), null);
  });
});
