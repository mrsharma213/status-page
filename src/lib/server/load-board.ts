import "server-only";
import { buildReadModel } from "../board";
import { parseStoredDocument } from "../schema";
import { storageConfigured, syntheticAllowed } from "../secrets";
import type { ReadModel } from "../types";
import { parseAllowlist } from "../urls";
import { createBlobStore } from "./blob-store";
import { currentEnv } from "./runtime";

export async function loadBoard(now = new Date()): Promise<ReadModel> {
  const env = currentEnv();
  const allowlist = parseAllowlist(env.evidenceHostAllowlist);
  const base = { now, displayTimeZone: env.displayTimeZone, allowlist };
  if (!storageConfigured(env)) {
    if (syntheticAllowed(env)) return buildReadModel({ ...base, source: { kind: "synthetic" } });
    return buildReadModel({ ...base, source: { kind: "unconfigured" } });
  }
  try {
    const raw = await createBlobStore().read();
    if (!raw) return buildReadModel({ ...base, source: { kind: "empty" } });
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw) as unknown;
    } catch {
      return buildReadModel({ ...base, source: { kind: "unavailable" } });
    }
    const stored = parseStoredDocument(parsedJson, allowlist);
    if (!stored.ok) return buildReadModel({ ...base, source: { kind: "unavailable" } });
    return buildReadModel({
      ...base,
      source: { kind: "snapshot", storedAt: stored.storedAt, snapshot: stored.snapshot },
    });
  } catch {
    return buildReadModel({ ...base, source: { kind: "unavailable" } });
  }
}
