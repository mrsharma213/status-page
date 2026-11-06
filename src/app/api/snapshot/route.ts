import { auth } from "@/auth";
import { handleSnapshot } from "@/lib/handlers";
import { json } from "@/lib/http";
import { loadBoard } from "@/lib/server/load-board";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function respond(request: Request) {
  return handleSnapshot(request, {
    hasReadSession: async () => {
      try {
        const session = await auth();
        return Boolean(session?.user && session.purpose === "read");
      } catch {
        return false;
      }
    },
    load: () => loadBoard(),
  });
}

export function GET(request: Request) {
  return respond(request);
}

export function HEAD(request: Request) {
  return respond(request);
}

export function POST() {
  return json({ error: "method_not_allowed" }, 405);
}
