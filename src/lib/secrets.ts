import { createHash, timingSafeEqual } from "node:crypto";
import type { AppEnv } from "./env";

export function secretsEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function filled(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function secretsCollide(env: AppEnv): boolean {
  const values = [env.ownerPassword, env.ingestSecret, env.authSecret, env.automationBypassSecret].filter(filled);
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (secretsEqual(values[i], values[j])) return true;
    }
  }
  return false;
}

export function loginStatus(env: AppEnv): "ok" | "unconfigured" {
  if (!env.ownerPassword || env.ownerPassword.length < 16) return "unconfigured";
  if (!env.authSecret || env.authSecret.length < 32) return "unconfigured";
  if (env.ingestSecret && env.ingestSecret.length < 32) return "unconfigured";
  if (env.automationBypassSecret && env.automationBypassSecret.length < 32) return "unconfigured";
  if (secretsCollide(env)) return "unconfigured";
  return "ok";
}

export function ingestStatus(env: AppEnv): "ok" | "unconfigured" {
  if (!env.ingestSecret || env.ingestSecret.length < 32) return "unconfigured";
  if (env.ownerPassword && env.ownerPassword.length < 16) return "unconfigured";
  if (env.authSecret && env.authSecret.length > 0 && env.authSecret.length < 32) return "unconfigured";
  if (env.automationBypassSecret && env.automationBypassSecret.length < 32) return "unconfigured";
  if (secretsCollide(env)) return "unconfigured";
  return "ok";
}

export function storageConfigured(env: AppEnv): boolean {
  return Boolean(env.blobToken || env.blobStoreId);
}

export function syntheticAllowed(env: AppEnv): boolean {
  if (env.allowSyntheticDemo !== "true") return false;
  if (env.allowSyntheticDemoLocal !== "true") return false;
  if (env.vercel === "1") return false;
  if (env.vercelEnv) return false;
  return true;
}

export function readBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer ([!-~]+)$/.exec(header);
  return match ? match[1] : null;
}

export function ingestDecision(env: AppEnv, bearer: string | null): "ok" | "unconfigured" | "unauthorized" {
  if (ingestStatus(env) !== "ok" || !env.ingestSecret) return "unconfigured";
  if (!bearer || !secretsEqual(bearer, env.ingestSecret)) return "unauthorized";
  return "ok";
}
