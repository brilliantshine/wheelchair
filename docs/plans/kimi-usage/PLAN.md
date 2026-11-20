---
slug: kimi-usage
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Kimi Code weekly usage on Settings → Usage

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md`, `docs/maps/usage-readings.md`, `docs/maps/machine-usage-kimi.md`.

## Open Questions

### Q1: How does wheelchair get a usable Kimi login key when Kimi has been idle?
- **Context:** `GET <base_url>/usages` needs the access token from Kimi's credentials file,
  which expires 15 minutes after Kimi last renewed it. Renewing rotates the long-lived
  refresh token; if wheelchair and a running Kimi renew at once, one side keeps a dead
  refresh token and the account is signed out. The CLI appears to guard renewal with a
  lock directory at `<kimi home>/oauth/<key>.lock` (proper-lockfile), but that is
  unconfirmed (MAP.md). Kimi usage only moves while Kimi is used, and Kimi use keeps the
  token fresh; reset times passing are already handled by the reader (expired windows read
  as zero).
- **Options:**
  - A. Read-only: read usage only while the stored token is still valid; never renew.
    Zero sign-out risk. Readings stop changing while Kimi is idle, which is when they don't
    move anyway, except for Kimi use on another computer with the same account.
  - B. Renew it ourselves, under Kimi's own lock, writing new keys back the way the CLI
    does. Always fresh, but depends on matching Kimi's internal lock and file format
    exactly; a mismatch can sign the account out, and a Kimi update can change them.
- **Recommendation:** A.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Chosen by the user | user |
| 2 | Show Kimi's `limit_7d` as the week and `limit_5h` as the five-hour window, in the reading shape Claude/GPT already use (`week: {used, resets_at}`, `five_hour`), `used` = `used_ratio` × 100 | Reuses the existing reader, forecast and rank unchanged (usage.js:19-34) | defaulted |
| 3 | The reading is fetched by the machine service (which already knows each Kimi account's home, config and credential file), through the existing hub → machine `/v1/usage` route, extended to `kimi` | Keeps credentials on the machine; hub never sees a token | defaulted |
| 4 | Kimi readings are allowed while a Kimi session on that account is live (unlike Claude/GPT) | A Kimi reading is one web request and spawns nothing; a live session is when the token is surely fresh | defaulted |
| 5 | Poll interval stays the shared nine minutes | Same freshness as the other providers; under the 15-minute token life | defaulted |

## Spec

To be written as decisions land.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
