import type { AppEnv } from "./env";
import { json, NO_STORE_HEADERS } from "./http";
import { MAX_SNAPSHOT_BYTES } from "./text";
import { ingestDecision, readBearer, storageConfigured } from "./secrets";
import { validateIngest } from "./schema";
import type { ReadModel } from "./types";
import { parseAllowlist } from "./urls";
import type { SnapshotStore } from "./store";

export async function handleSnapshot(
  request: Request,
  deps: {
    hasReadSession: () => Promise<boolean>;
    load: () => Promise<ReadModel>;
  },
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (request.headers.get("authorization")) {
    return json({ error: "unauthorized" }, 401);
  }
  const allowed = await deps.hasReadSession();
  if (!allowed) return json({ error: "unauthorized" }, 401);
  if (request.method === "HEAD") {
    return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
  }
  const model = await deps.load();
  return json(model, 200);
}

export async function handleIngest(
  request: Request,
  deps: {
    env: AppEnv;
    now: Date;
    store: SnapshotStore | null;
  },
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (request.headers.has("x-vercel-set-bypass-cookie")) {
    return json({ error: "bypass_cookie_forbidden" }, 400);
  }
  const decision = ingestDecision(deps.env, readBearer(request.headers.get("authorization")));
  if (decision === "unconfigured") return json({ error: "auth_unconfigured" }, 503);
  if (decision === "unauthorized") return json({ error: "unauthorized" }, 401);
  if (!deps.store || !storageConfigured(deps.env)) {
    return json({ error: "storage_unconfigured" }, 503);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ error: "invalid_content_type" }, 415);
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_SNAPSHOT_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }
  const text = await request.text();
  if (text.length > MAX_SNAPSHOT_BYTES) return json({ error: "payload_too_large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = validateIngest(body, deps.now, parseAllowlist(deps.env.evidenceHostAllowlist));
  if (!parsed.ok) return json({ error: "invalid_snapshot", issues: parsed.issues }, 400);
  const stored = JSON.stringify({ storedAt: deps.now.toISOString(), snapshot: parsed.snapshot });
  try {
    await deps.store.write(stored);
  } catch {
    return json({ error: "storage_unavailable" }, 503);
  }
  return json(
    {
      ok: true,
      snapshotId: parsed.snapshot.snapshotId,
      itemCount: parsed.snapshot.items.length,
      collectedAt: parsed.snapshot.collectedAt,
    },
    200,
  );
}
