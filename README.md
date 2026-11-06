# Bot work

Private board for Nik Sharma. It shows work that started and then stopped, decisions waiting on Nik, and blockers another bot can clear. A quieter all-bots view keeps the rest.

The repository is public. Operational snapshots are not. They live in a private Vercel Blob store and are served only after authentication. Production starts empty until a collector posts a sanitized snapshot.

GitHub is the source of truth. The app is meant to run on Vercel. It is not a GitHub Pages site, an HQ site, or a Cursor Origin site. Do not merge, deploy, change DNS, or change repository visibility from this change alone. The parent verifies protection, then cuts DNS over.

## What replaced the old page

`status.nik.co` currently points at GitHub Pages. This branch removes the static page, the public JSON files, and the collectors that wrote operational notes into git. The old files remain in git history. This change does not rewrite history and does not force-push.

The previous page gate was a passcode in public HTML. That is not authentication. It is gone from the branch tip. Treat that passcode as public and abandoned.

`check-status.sh`, `collect-bot-activity.sh`, and `log-activity.sh` now exit 1 and write nothing. Leave them that way. This app does not call bot transcript APIs.

## Access model

Two layers. Both are required in production. Neither replaces the other.

1. **Vercel Authentication on all deployments.** Project setting `ssoProtection.deploymentType` must be `all`. This is "Vercel Authentication" covering every deployment, including the production custom domain. Do not use Standard Protection. Standard leaves production custom domains public, so `status.nik.co` would skip the platform wall.
2. **App auth, which fails closed when its env is missing.**
   - Browser reads use an Auth.js owner session (`OWNER_PASSWORD` plus `AUTH_SECRET`). The session cookie is httpOnly. It is not the machine token.
   - Machine ingest uses `Authorization: Bearer $INGEST_SECRET` on `POST /api/ingest`. A browser session cannot ingest. The bearer cannot open a read session. Requests that send `Authorization` to `GET /api/snapshot` are rejected.

Vercel Authentication lets members of team `nik-2658s-projects` reach the app. Team membership alone gets the sign-in screen, not task data. The owner password is what opens the board.

### Automation bypass

With protection set to all deployments, `POST /api/ingest` is behind the platform wall too. The supported bypass is Protection Bypass for Automation.

- Vercel stores the value as `VERCEL_AUTOMATION_BYPASS_SECRET`.
- The collector sends it only as the header `x-vercel-protection-bypass`.
- Send it from the collector host. Do not put it in a query string, a browser, a client bundle, a fixture, or a log line.
- Do not send `x-vercel-set-bypass-cookie`. That header asks Vercel to set a cookie that skips the platform wall in a browser. The app rejects the request if it still sees that header. Vercel may honor the header at the edge before the app runs, so the collector must not send it at all.
- The bypass header is not app authorization. After Vercel lets the request through, the app still requires `INGEST_SECRET`.
- A request that reaches the app with only the bypass header gets no task data.
- `INGEST_SECRET`, `OWNER_PASSWORD`, `AUTH_SECRET`, and `VERCEL_AUTOMATION_BYPASS_SECRET` must be different values. If any two match, sign-in and ingest fail closed.

The bypass secret is read only in server code, and only to detect a collision with the other secrets. It is never rendered.

## States

The collector states the work. The server does not invent a stall from silence.

| State | Meaning |
| --- | --- |
| `planned` | Not started. Quiet is expected. |
| `idle` | No active commitment. Quiet is expected. |
| `in-progress` | Explicitly still in progress. Old `lastActivityAt` does not move it. |
| `blocked` | A blocker is required. |
| `stale-evidence` | The collector marked the evidence stale, or its `freshUntil` has passed. This is not a stop. |
| `done` | Finished. Later silence is not a stall. |

Attention, separate from state:

| Attention | Rule |
| --- | --- |
| `needs-decision` | `decision` is the exact choice Nik has to make. |
| `stopped` | `stoppedEvidence` is present, or an active commitment was already due when the snapshot was collected. |
| `clearable-blocker` | State is `blocked`, with `blocker` and `clearableBy`. |
| `none` | Not one of the three lists. |

On read, one extra rule runs. An `in-progress` item with attention `none` and an active commitment whose `dueAt` is in the past becomes `stopped`, with the reason "Overdue active commitment." A due time is an explicit commitment, not a guess from elapsed quiet time. `done`, `idle`, and `planned` never take that promotion. A decision item stays on the decision list even if a commitment is also overdue.

`freshUntil` in the past, or `explicitStale: true`, moves `in-progress` or `blocked` items to `stale-evidence`. It does not by itself mark them stopped.

## Vercel setup

Do this on team **nik-2658s-projects** (`team_SMaKNWc4nnLF177pNAJJO7ST`). The team is already Pro. No Vercel project exists for this site yet. Connector consent for that team is still being granted. Do not create the project with another account or another token to get around that.

1. After this pull request is reviewed, import `mrsharma213/status-page` as a Next.js project on that team. Root directory `.`. Production branch `main` only after merge. Until then, a branch deployment is enough to test protection. Do not attach `status.nik.co` yet.
2. Create a **private** Blob store and connect it to the project. Do not create a public store. The connection should set `BLOB_STORE_ID`. On Vercel, reads and writes use the platform OIDC token (`VERCEL_OIDC_TOKEN`), which Vercel injects. Do not copy that token into git or HQ by hand.
3. If OIDC connection is unavailable, the fallback env is `BLOB_READ_WRITE_TOKEN` from that same private store. Prefer `BLOB_STORE_ID`.
4. Deployment Protection: Vercel Authentication, **All Deployments** (`ssoProtection.deploymentType = all`). Confirm Standard Protection is not the selected mode. Do not enable a public share link.
5. Enable Protection Bypass for Automation so Vercel sets `VERCEL_AUTOMATION_BYPASS_SECRET`. Put the value in HQ only.
6. Set the Production env vars below. Leave them unset on Preview unless you intend to store real snapshots there. Unset ingest and storage env on Preview makes those deployments fail closed.
7. Deploy. Do not set `ALLOW_SYNTHETIC_DEMO` or `ALLOW_SYNTHETIC_DEMO_LOCAL` on Vercel. Those flags are ignored when `VERCEL` or `VERCEL_ENV` is present, and Vercel sets both.
8. Verify, in order:
   - Logged out, the `*.vercel.app` host shows the Vercel sign-in wall, not the board.
   - After a team member passes that wall, the app shows its own sign-in screen and no task rows.
   - `GET /api/snapshot` without the owner session returns `401` and a body of `{"error":"unauthorized"}`. `Cache-Control` is `private, no-store`.
   - The same call with `Authorization: Bearer $INGEST_SECRET`, plus the bypass header so the request reaches the app, is still `401` and does not contain task text.
   - `POST /api/ingest` without the bearer is `401`. With the owner password as the bearer, `401`. With the bypass secret as the bearer, `401`.
   - `POST /api/ingest` with the bearer and the bypass header, before Blob is connected, is `503` `storage_unconfigured` and does not echo the body.
   - After Blob is connected, a valid post returns `{ "ok": true, ... }` and does not echo item text. The signed-in board then shows that snapshot, including collected time and each activity time with its zone.
   - A wrong owner password stays on the sign-in screen.
9. Only after those checks, disable GitHub Pages (Settings, Pages, source none) and move DNS. Disabling Pages while DNS still points at Pages will take `status.nik.co` offline. That gap is safer than leaving the old public JSON up. Add the domain in Vercel, set `AUTH_URL=https://status.nik.co`, and follow Vercel's DNS records. Remove the old Pages records.
10. Repeat the anonymous checks on `https://status.nik.co`.

Set secrets in Vercel and store the source values in HQ. This repository never receives the values.

### Env vars

| Name | Required | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | Yes, for sign-in | Auth.js session encryption. At least 32 characters. `openssl rand -base64 32` |
| `OWNER_PASSWORD` | Yes, for sign-in | Password the owner types. At least 16 characters. Not a short PIN. |
| `INGEST_SECRET` | Yes, for ingest | Bearer token for `POST /api/ingest`. At least 32 characters. |
| `BLOB_STORE_ID` | Yes, preferred | Private Blob store id, set by the Vercel Blob connection. |
| `BLOB_READ_WRITE_TOKEN` | Fallback only | Private store token if OIDC is not used. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Yes, once protection is on | Platform bypass for the collector. Vercel sets it. Never expose it to a browser. |
| `VERCEL_OIDC_TOKEN` | Automatic | Injected by Vercel for the Blob connection. Do not set a stand-in. |
| `DISPLAY_TIMEZONE` | No | IANA zone for collected, stored, and rendered clocks. Default `America/New_York`. Activity times use each item's own zone. |
| `EVIDENCE_HOST_ALLOWLIST` | No | Comma-separated HTTPS hosts. When set, other evidence links are withheld. |
| `AUTH_URL` | After cutover | `https://status.nik.co`. Leave unset before the domain is attached. `trustHost` is on. |
| `ALLOW_SYNTHETIC_DEMO` | Never on Vercel | Local design review only. Must be the string `true`. |
| `ALLOW_SYNTHETIC_DEMO_LOCAL` | Never on Vercel | Second local flag. Both must be `true`, and `VERCEL` / `VERCEL_ENV` must be unset. |

Generate `AUTH_SECRET`, `OWNER_PASSWORD`, and `INGEST_SECRET` separately. If any of those, or the bypass secret, share a value, the app refuses sign-in and ingest.

`OWNER_PASSWORD` shorter than 16 characters, or either machine secret shorter than 32 when set, is treated as unconfigured.

## Ingest contract

`POST /api/ingest`

Headers:

- `Authorization: Bearer $INGEST_SECRET`
- `Content-Type: application/json`
- `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET` when Vercel Authentication is on
- Do not send `x-vercel-set-bypass-cookie`

Max body 64 KB. Max 80 items. Unknown fields are rejected. The body replaces the stored snapshot. It is not merged. On success the response is counts and ids only, not the items.

```bash
curl -sS -X POST "$APP_URL/api/ingest" \
  -H "Authorization: Bearer $INGEST_SECRET" \
  -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @snapshot.json
```

`APP_URL` is the Vercel host before cutover, then `https://status.nik.co`.

Example shape. The words below are a contract sample, not a record of real work:

```json
{
  "schemaVersion": 1,
  "snapshotId": "2026-11-06t15",
  "collectedAt": "2026-11-06T15:00:00.000Z",
  "collector": "hourly-snapshot",
  "items": [
    {
      "id": "banner-choice",
      "ownerBot": "Northwind",
      "task": "Choose the sample catalog banner",
      "state": "in-progress",
      "attention": "needs-decision",
      "lastActivityAt": "2026-11-06T14:00:00.000Z",
      "lastActivityTimeZone": "America/New_York",
      "lastActivitySummary": "Posted two sample banners for a decision.",
      "nextStep": "Record the banner choice.",
      "blocker": null,
      "decision": "Ship the violet sample banner, or hold it for a plain ink banner.",
      "clearableBy": null,
      "evidenceUrl": "https://example.com/synthetic/banner",
      "evidenceLabel": "Synthetic sample",
      "confidence": "high",
      "freshUntil": "2026-12-01T00:00:00.000Z",
      "explicitStale": false,
      "stoppedEvidence": null,
      "commitment": null
    }
  ]
}
```

Rules worth knowing while building the collector:

- Times are ISO-8601 with `Z` or a numeric offset. Naive times are rejected.
- `collectedAt` cannot be more than 5 minutes ahead of the server clock.
- `lastActivityAt` cannot be more than 5 minutes after `collectedAt`. Null means no activity time was reported. The UI says that. It does not render "just now".
- `collector`, `snapshotId` are lowercase slugs. `collector` is a label, never a credential.
- `evidenceUrl` is `https` only. Userinfo, IP literals, localhost, `.local`, `.internal`, and metadata hosts are rejected. Set `EVIDENCE_HOST_ALLOWLIST` when the real hosts are known.
- Strings are single line. Control and bidi override characters are rejected.
- `confidence` is `low`, `medium`, or `high`.
- An active `commitment` needs both `dueAt` and `evidence`.
- Validation errors return `{ "error": "invalid_snapshot", "issues": [{ "path": "...", "code": "..." }] }` with no submitted values.
- HTML in text is stored as text and rendered as text.

`GET /api/snapshot` is the read API. It requires the owner session cookie and rejects any `Authorization` header. The HTML page is the normal UI. Both send `Cache-Control: private, no-store`.

## Local demo

Synthetic rows exist for tests and for a local design review. They are labeled in the UI. They are not a production roster.

```bash
npm install
npm test
npm run lint
npm run typecheck
npm run build
AUTH_SECRET="$(openssl rand -base64 32)" \
OWNER_PASSWORD="$(openssl rand -base64 24)" \
INGEST_SECRET="$(openssl rand -base64 32)" \
VERCEL_AUTOMATION_BYPASS_SECRET="$(openssl rand -base64 32)" \
ALLOW_SYNTHETIC_DEMO=true \
ALLOW_SYNTHETIC_DEMO_LOCAL=true \
DISPLAY_TIMEZONE=America/New_York \
npm start
```

Do not export those values into a file that gets committed. Sign in, confirm the synthetic banner, then exercise filters and both views.

## Brand

Visual source: Brand Book v3, Sans Supremacy, at https://identity.nik.co/, with https://www.nik.co/ as the public reference. Tokens in use: Paper `#F4F1EC`, Ink `#111111`, Accent Violet `#5E5BE7` on the decision count only. Type is Inter Display, Inter Variable, and JetBrains Mono, self-hosted from the OFL releases. The page sets the wordmark as Inter Display 900, tracking `-0.04em`, ink `#111111`. The browser icon is the public nS mark from identity.nik.co. The mark is not drawn again on the page.

## Rollback and cutover

- Before DNS moves, rollback is "do not attach the domain." GitHub Pages keeps serving the previous site, including the old public JSON, until Pages is disabled.
- After Pages is disabled and before DNS is correct, the hostname is down. Turn Pages back on only if you accept publishing the old tree again.
- After Vercel has the domain, roll back the deployment in Vercel to the previous production deployment. That does not require a force-push.
- To undo the git change after merge, revert the merge commit on `main`. Do not force-push and do not delete the repository. A revert restores the old static site at the branch tip, which is public data again. Prefer a Vercel rollback over a git revert once the new app is the one behind the domain.
- Blob objects are outside git. Deleting the Vercel project or the store removes the snapshot. The git repo never had that snapshot.
- If a secret was pasted into a shell log or a screenshot, rotate it in Vercel and HQ. Nothing in this repo should need rotating because no values were committed.

## Tests

`npm test` covers classification, schema rejection, time zones, URL policy, secret separation, and the ingest and snapshot handlers. `npm run build` must succeed with no secrets set. `scripts/smoke.mjs` hits a running server and checks that anonymous pages and APIs return no task data.
