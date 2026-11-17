---
slug: idle-usage-polling
status: confirmed   # draft | confirmed
created: 2026-11-16
---

# Check usage on accounts no agent is using

## What we're building

Every so often, the app checks how much of its five-hour and weekly limits each account
has used, for accounts that no running agent is using. The balancer and the Usage page
then work from current numbers for every account, not only the busy ones.

## Why — the problem

Today usage numbers arrive only while an agent runs on an account. An account left idle
keeps its last number, however old, and one never used shows "no reading yet", which the
balancer treats as full room. So the balancer can send work to an account that is
actually near its limit (used from another device, or since the old reading), or pass
over one that has refilled, and the Usage page shows stale numbers.

## What good looks like

- An idle, signed-in account's usage on the Usage page is never more than one polling
  interval old.
- An account never used by an agent shows real numbers instead of "no reading yet".
- The balancer skips an idle account that is near its limit, and picks up one that has
  room, without an agent having run on it first.
- Accounts in use by an agent are not polled: their live numbers keep coming as now.

## Not doing

- Changing how the balancer ranks or chooses accounts.
- Polling accounts that are signed out or paused.
- Refreshing or rewriting any CLI's login.
- Accounts for providers other than Claude and Codex.

## Constraints

- A poll must never start a provider's limit window on an account that was meant to be
  left untouched.
- A poll must not overwrite a newer reading from a live session.
- Login credentials stay on the machine that holds them; they never pass to the hub.
