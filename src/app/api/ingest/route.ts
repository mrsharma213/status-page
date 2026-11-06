import { handleIngest } from "@/lib/handlers";
import { json } from "@/lib/http";
import { storageConfigured } from "@/lib/secrets";
import { createBlobStore } from "@/lib/server/blob-store";
import { currentEnv } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  const env = currentEnv();
  return handleIngest(request, {
    env,
    now: new Date(),
    store: storageConfigured(env) ? createBlobStore() : null,
  });
}

export function GET() {
  return json({ error: "method_not_allowed" }, 405);
}
