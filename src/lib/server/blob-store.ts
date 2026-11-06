import "server-only";
import { BlobNotFoundError, get, put } from "@vercel/blob";
import type { SnapshotStore } from "../store";

const PATHNAME = "bot-work/latest.json";

export function createBlobStore(): SnapshotStore {
  return {
    async read() {
      try {
        const result = await get(PATHNAME, { access: "private", useCache: false });
        if (!result || result.statusCode !== 200 || !result.stream) return null;
        return new Response(result.stream).text();
      } catch (error) {
        if (error instanceof BlobNotFoundError) return null;
        throw error;
      }
    },
    async write(body: string) {
      await put(PATHNAME, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json; charset=utf-8",
        cacheControlMaxAge: 60,
      });
    },
  };
}
