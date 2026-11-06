import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "..");
const skip = new Set(["node_modules", ".git", ".next", "coverage"]);
const textExt = new Set([".ts", ".tsx", ".css", ".md", ".json", ".yml", ".mjs", ".html", ".sh", ".svg", ".example", ".txt"]);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

describe("public tree", () => {
  it("does not keep the old public status payloads or client gate", () => {
    const files = walk(root).map((path) => relative(root, path));
    for (const banned of ["activity-log.json", "status.json", "incidents.json", "qa-log.json", "index.html"]) {
      assert.equal(files.includes(banned), false, banned);
    }
    const joined = files
      .filter((file) => file !== "package-lock.json")
      .filter((file) => textExt.has(file.slice(file.lastIndexOf("."))) || file.endsWith(".env.example"))
      .filter((file) => !file.startsWith("src/fonts/"))
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n");
    const needles = [
      "jet-" + "auth",
      "open" + "claw",
      "SLACK_USER_" + "TOKEN",
      "bot" + "Token",
      "dangerouslySet" + "InnerHTML",
      "NEXT_" + "PUBLIC_",
    ];
    for (const needle of needles) {
      assert.equal(joined.includes(needle), false, needle);
    }
  });

  it("keeps secret env reads out of client components", () => {
    const clientDir = join(root, "src/components");
    const files = walk(clientDir);
    const text = files.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const needle of [
      "VERCEL_AUTOMATION_BYPASS_SECRET",
      "INGEST_SECRET",
      "OWNER_PASSWORD",
      "AUTH_SECRET",
      "BLOB_READ_WRITE_TOKEN",
      "BLOB_STORE_ID",
    ]) {
      assert.equal(text.includes(needle), false, needle);
    }
  });
});
