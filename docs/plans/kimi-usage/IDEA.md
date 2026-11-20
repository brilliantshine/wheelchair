---
slug: kimi-usage
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-19
---

# Kimi Code weekly usage on Settings → Usage

## What we're building

Settings → Usage shows how much of the week's Kimi Code allowance is used and when it
resets, the same way it already does for Claude and GPT. The reading comes from Kimi's own
usage service, asked directly, not by starting the Kimi app.

## Why — the problem

Today Kimi accounts show "no reading yet" on the Usage page forever. You can't see how close
a Kimi account is to its weekly limit, and wheelchair can't use that to decide which
account to give work to or when a waiting session can go again. It only learns about a
Kimi limit when a session runs into it.

## What good looks like

- A signed-in Kimi account shows its weekly use and reset time on Settings → Usage, kept
  about as fresh as Claude and GPT readings, whether or not a Kimi session is running.
- With several Kimi accounts, wheelchair picks among them by weekly room, as it does for
  Claude and GPT.
- Using Kimi in its own app or in a thread works as before: getting readings never signs
  you out of Kimi or breaks a running Kimi session.
- When a reading can't be had (signed out, Kimi's service down), the page says so the way
  it does for the other providers, and nothing else breaks.

## Not doing

- Kimi's monthly limits or paid top-up balance on the Usage page (only the weekly limit,
  plus the five-hour window where the page already shows one).
- Usage for Antigravity or any provider other than Kimi.
- Changing how the Usage page looks or how readings are used for the other providers.

## Constraints

- No starting the Kimi CLI to get a reading; Kimi account facts come from reading its files
  (kimi-code plan, decision 23). A reading is one small web request.
- Never print, log or store Kimi's login keys anywhere outside Kimi's own files.
- Must not sign the user out of Kimi, including while a Kimi session is running at the
  same moment.
