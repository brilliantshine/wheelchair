---
slug: app-accounts
status: confirmed   # draft | confirmed
created: 2026-11-15
---

# Several accounts per provider, with usage shown and work balanced across them

## What we're building

Collin can sign in several accounts for each AI provider (Claude, ChatGPT, then Google,
OpenRouter and other coding CLIs), each kept separate. Settings gets an Accounts screen and
a Usage screen showing how much of each provider's week is left. When the app starts an
agent, it picks the provider and account by rules he sets, so work flows to whoever has
room.

## Why — the problem

Today each CLI runs on one login per machine, and nothing knows how much of a plan is used.
When one subscription runs out, agents stall and Collin finds out late. He can't add a
second account, can't see which provider is running low, and leads compete with workers
for the same Claude allowance. The lead or sub-lead picks the CLI by hand, so nothing moves
work to a provider that still has room.

## What good looks like

- He adds a second Claude or ChatGPT account, signs it in on a machine, and agents start
  using it; its logins and history never mix with the first.
- Each account shows its plan, which machines it is signed in on, this 5-hour window, this
  week, and problems such as "signed out on beelink" with a way to fix them.
- Each provider shows one bar: how much of this week is left across its accounts. It turns
  amber, with one line saying when it runs out, when the current pace won't last to the
  first refill.
- Opening a provider shows each account, which one is next, and why.
- New agents land on the account that refills soonest by default (or spread evenly, or one
  at a time, if he chooses).
- Leads run on Claude. Workers try GPT, then Google, then Claude, then OpenRouter. With
  "Save Claude for leads" on, workers get Claude only when a rule asks or nothing else has
  room; below the margin, workers get no Claude at all.
- He is told once per provider per week when it drops below a threshold; a share of each
  account stays free for his own use; pay-as-you-go keys are used only when every
  subscription is out, and stop at a monthly cap.
- Adding a new CLI as a provider means filling in one adapter: how to start it, read its
  usage, notice a turn ending, and keep its logins apart. Claude and Codex go through the
  same adapter.
- Google and OpenRouter appear as rows in the existing model table.

## Not doing

- Asides (they belong to the side-conversations thread).
- The Settings page itself, the model table's columns, templates and writing style (already
  built by the Settings thread).
- Rules by kind of work (UI prefers Claude, Critical checked by a second provider, the
  suggested rules). Only the provider order, Save Claude for leads and the margin.
- Paying for or buying subscriptions; the app only uses accounts he already has.

## Constraints

- Each account's login stays in its own folder, so accounts never mix.
- Signing in uses each CLI's own login flow.
- Accounts are per machine: an account can be signed in on some machines and not others.
- Nothing may break the thread chat or the Ready check for today's single-account setup.
