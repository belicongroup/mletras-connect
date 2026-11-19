# MLetras Connect — Social Media Simulation & Automated Testing Framework

Isolated testing harness that simulates real user personas interacting with the MLetras Connect API. All code lives under `testing/` and gated test routes under `/__test__/*` — **never enable test routes in production**.

## Architecture

```
testing/
├── src/
│   ├── client/ApiClient.ts       # HTTP client with auth, latency, offline simulation
│   ├── config/                   # Personas, environment
│   ├── simulator/SimulatedUser.ts # Persona-driven user agent
│   ├── scenarios/                # Deterministic test suites
│   ├── validators/               # API, security, DB checks
│   ├── orchestrator/             # Concurrent simulation runner
│   └── reporting/                # JSON + Markdown reports
└── reports/                      # Generated per run (gitignored)
```

### Personas (10 configurable types)

| Persona | Behavior |
|---------|----------|
| New User | Cautious exploration |
| Casual User | Balanced engagement |
| Power User | Heavy all-feature usage |
| Content Creator | Post-focused |
| Heavy Commenter | Comment/reply focused |
| Passive Reader | Feed scrolling |
| Moderator | Notifications + content review |
| Malicious User | Security probes, abuse |
| Spam User | Rate-limit triggering |
| Offline User | Flaky network simulation |

## Prerequisites

1. **Local worker** with test routes enabled
2. **D1 migrated** locally
3. **Secrets** in `workers/mletras-connect-api/.dev.vars`:
   ```
   JWT_SECRET=your-local-dev-secret-at-least-32-chars
   RESEND_API_KEY=re_test_optional_when_test_routes_on
   ```

## Quick Start

```bash
# Terminal 1 — API with test routes (skips Resend when ENABLE_TEST_ROUTES=true)
npm run worker:dev:test

# Terminal 2 — migrate local DB (first time only)
cd workers/mletras-connect-api && npm run db:migrate:local

# Terminal 3 — install & run simulation
cd testing && npm install
npm run simulate:quick
```

From repo root:

```bash
npm run simulate:quick
```

## CLI Options

```bash
npm run simulate -- \
  --api http://127.0.0.1:8787 \
  --personas 8 \
  --duration 120 \
  --scenarios auth,posts,security,stress \
  --seed 42 \
  --require-test-routes true
```

Environment variables (see `.env.example`): `SIM_API_URL`, `SIM_CONCURRENT_USERS`, `SIM_DURATION_SECONDS`, `SIM_SCENARIOS`.

## What Gets Tested Automatically

### Implemented & covered
- Auth: signup, login, logout, OTP verify, invalid OTP, password reset, token revocation, stale JWT
- Profile: PATCH `/users/me`
- Feed: pagination, post shape validation
- Posts: create, read, like/unlike, delete
- Comments: create, reply, list
- Notifications: list, unread count, mark read
- Security: unauthorized access, invalid JWT, cross-user delete, payload validation, OTP brute probe
- Stress: parallel likes/comments, DB consistency checks
- Edge cases: aborted requests, slow network, duplicate likes, offline simulation

### Manual testing required (not yet automatable)

| Feature | Reason |
|---------|--------|
| Search | No API endpoints |
| Follow/unfollow | Not implemented |
| Edit post/comment | No PATCH endpoints |
| Bookmarks, share, report | Not implemented |
| Avatar upload | No avatar field |
| Username change | Immutable after signup |
| UI loading states, pull-to-refresh | Requires Playwright/Maestro E2E |
| React console errors | Requires browser E2E harness |
| Push notifications | Polling only; no push infra |
| Worker restart / KV chaos | Requires deployment chaos tooling |

These appear in every report under **Manual Testing Requirements**.

## Test-Only API Routes

Enabled only when `ENABLE_TEST_ROUTES=true`:

| Route | Purpose |
|-------|---------|
| `GET /__test__/health` | Confirm test mode |
| `GET /__test__/otp/peek?email=&flow=` | Read OTP from KV (local testing) |
| `GET /__test__/db/consistency` | Orphan rows, count mismatches |
| `GET /__test__/db/stats` | Table row counts |
| `POST /__test__/rate-limit/clear` | Clear rate-limit keys |

**Production:** `ENABLE_TEST_ROUTES` must remain unset/false. Routes return 404.

## Reports

Each run writes to `testing/reports/<run-id>/`:

- `report.json` — full structured results
- `report.md` — human-readable summary

Includes: executive summary, pass/fail counts, bugs by severity, security/performance/DB findings, health score (0–100), production readiness score (0–100).

## Scaling to 100+ Users

The orchestrator spawns independent `SimulatedUser` agents with configurable concurrency. To scale:

1. Increase `--personas 100`
2. Run against a dedicated staging worker (not production)
3. Consider sharding across multiple CI jobs with different `--seed` values
4. Monitor D1/KV rate limits — spam/malicious personas intentionally trigger them

## CI Integration (recommended)

```yaml
# Example GitHub Actions step
- run: npm run db:migrate:local --prefix workers/mletras-connect-api
- run: npm run worker:dev:test --prefix workers/mletras-connect-api &
- run: sleep 5 && npm run simulate:quick
```

## Unit Tests

```bash
cd testing && npm test
```

## Production Code Changes

Minimal, gated changes only:

- `ENABLE_TEST_ROUTES` env var in worker
- `/__test__/*` routes in `workers/.../src/routes/test.ts`
- OTP email skipped when test routes enabled
- `peekOtp` helpers in `lib/otp.ts`

No production behavior changes when test routes are disabled.
