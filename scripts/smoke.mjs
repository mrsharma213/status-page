const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const owner = process.env.OWNER_PASSWORD ?? "";
const ingest = process.env.INGEST_SECRET ?? "";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const marker = "UNIQUE_SMOKE_MARKER_NOT_A_REAL_TASK";

const jar = new Map();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function storeCookies(response) {
  const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const line of lines) {
    const pair = line.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const cookie = cookieHeader();
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(base + path, { ...options, headers, redirect: options.redirect ?? "manual" });
  storeCookies(response);
  return response;
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const home = await request("/");
const homeText = await home.text();
assert(home.status === 200 || home.status === 307 || home.status === 302, `home status ${home.status}`);
const login = home.status === 200 ? homeText : await (await request("/login")).text();
assert(login.includes("Sign in"), "login page missing");
assert(!login.includes("Northwind"), "login page leaked synthetic task data");
assert(!login.includes(bypass), "login page leaked bypass secret");
assert(!login.includes(ingest), "login page leaked ingest secret");

const snapshot = await request("/api/snapshot");
const snapshotText = await snapshot.text();
assert(snapshot.status === 401, `snapshot status ${snapshot.status}`);
assert(snapshot.headers.get("cache-control")?.includes("no-store"), "snapshot missing no-store");
assert(!snapshotText.includes("Northwind"), "unauthorized snapshot leaked items");
assert(!snapshotText.includes("items"), "unauthorized snapshot included an items field");

const machineRead = await request("/api/snapshot", { headers: { authorization: `Bearer ${ingest}` } });
const machineText = await machineRead.text();
assert(machineRead.status === 401, "machine bearer opened a read");
assert(!machineText.includes(ingest), "read error echoed the ingest secret");

const ingestBody = JSON.stringify({
  schemaVersion: 1,
  snapshotId: "smoke-snapshot",
  collectedAt: "2026-11-01T14:00:00.000Z",
  collector: "smoke-collector",
  items: [],
  marker,
});

for (const header of [undefined, `Bearer ${owner}`, `Bearer ${bypass}`, "Bearer wrong-token"]) {
  const headers = { "content-type": "application/json" };
  if (header) headers.authorization = header;
  const response = await request("/api/ingest", { method: "POST", headers, body: ingestBody });
  const text = await response.text();
  assert(response.status === 401, `ingest with ${header ?? "no token"} returned ${response.status}`);
  assert(!text.includes(marker), "rejected ingest echoed the payload");
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert(!setCookie.includes("session-token"), "ingest set a session cookie");
}

const bypassCookie = await request("/api/ingest", {
  method: "POST",
  headers: {
    authorization: `Bearer ${ingest}`,
    "content-type": "application/json",
    "x-vercel-set-bypass-cookie": "true",
  },
  body: ingestBody,
});
assert(bypassCookie.status === 400, "bypass cookie header was accepted");

const unstored = await request("/api/ingest", {
  method: "POST",
  headers: { authorization: `Bearer ${ingest}`, "content-type": "application/json" },
  body: ingestBody,
});
const unstoredText = await unstored.text();
assert(unstored.status === 503, `expected storage failure, got ${unstored.status}: ${unstoredText}`);
assert(!unstoredText.includes(marker), "storage failure echoed the payload");

const csrf = await request("/api/auth/csrf");
const csrfJson = await csrf.json();
const form = new URLSearchParams({
  csrfToken: csrfJson.csrfToken,
  password: owner,
  callbackUrl: `${base}/`,
});
const signed = await request("/api/auth/callback/credentials", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: form,
});
assert(signed.status === 302 || signed.status === 303, `login status ${signed.status}`);
const board = await request("/");
const boardText = await board.text();
assert(board.status === 200, `board status ${board.status}`);
assert(boardText.includes("Synthetic example"), "signed-in board missing synthetic label");
assert(boardText.includes("Choose the sample catalog banner"), "decision item missing");
assert(boardText.includes("Draft the sample launch note"), "reported stop missing");
assert(boardText.includes("Send the sample weekly recap"), "overdue commitment missing");
assert(boardText.includes("Publish the sample price sheet"), "clearable blocker missing");
assert(boardText.includes("Completed. Quiet after this is expected."), "done copy missing");
assert(!boardText.includes(bypass), "board leaked bypass secret");
assert(!boardText.includes(ingest), "board leaked ingest secret");

console.log("smoke ok");
