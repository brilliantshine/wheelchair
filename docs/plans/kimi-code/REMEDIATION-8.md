# Remediation 8 — Kimi Code support

Verification attempt 8 at `9f4cc31`: `wc-01b8cb1bf051-verifier-15` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-16` (gpt-6.2-sol) FAIL with 3 new gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-16`)

1. GAP: Transcript binding — The matcher checks each text part separately. An isolated fixture bound a prompt with an ordinary preamble followed by a quoted role message, then rejected a valid role message whose `Session:` line was in a separate text part. [Matcher](machine/adapters/kimi.js#L85)
2. GAP: Turn-specific reports — A stale turn-0 end row after the turn-1 prompt closes report collection for turn 1. In an isolated machine-to-hub probe, the machine handed off turn 1 and the hub recorded it as handled, but the starter received no report or result card. The control fixture delivered both. [Report parser](viewer/app/chat.js#L243)
3. GAP: Settings provider coverage — The Behavior templates prompt preview explains how Claude, GPT, and Antigravity receive starting instructions and omits Kimi Code, which receives the composed file through its role message. [Settings caption](viewer/pages/settings.js#L653), [Kimi role message](machine/adapters/kimi.js#L109)

## Tasks

| Task | Gap | Provider (built by) | Files |
|------|-----|---------------------|-------|
| M1 | 1 | gpt (T3) | `machine/adapters/kimi.js` binding, `machine/test/kimi-turns.test.js` |
| H1 | 2 | gpt (T4) | `viewer/app/chat.js` `kimiReport`, `viewer/test/app-kimi-hub.test.js` |
| S1 | 3 | claude (T2) | `viewer/pages/settings.js` caption, `viewer/test/app-settings.spec.js` |

M1: bind on the joined text of the user prompt's text parts (starts with `[wc:role]`, has the `Session:` line). H1: only the open turn's own main-agent `turn.ended` closes it. S1: the caption names GPT, Antigravity and Kimi Code, "through a short first message".

**Resolutions:** gap 1 fixed by M1, gap 2 by H1, gap 3 by S1.
