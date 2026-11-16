---
slug: lead-reserve-and-review-count
status: draft   # draft | confirmed
created: 2026-11-15
---

# Reserve the lead's provider, and let one-account setups review with what they have

## What we're building

Three changes to how the app picks a provider (Claude or GPT) for each session:

- "Save Claude for leads" becomes "save the lead's provider for leads": it holds back
  whichever provider is first in the lead order that the user actually has, not always
  Claude.
- Someone with only one kind of account (only GPT, or only Claude) can run every step:
  planning, review, building, checking. Reviewers and checkers come from that one family.
- A setting picks how many reviewers a plan gets (one or two) and which family checks
  finished work. When both families are signed in, the default stays as now: two reviewers
  from different families, and a checker from the other family than the builder.

## Why — the problem

- The reserve setting assumes leads run on Claude. Someone whose leads run on GPT gets
  nothing saved for them, and Claude gets held back for no reason.
- With one account, parts of the app still assume two:
  - The readiness check fails when the other tool is installed but signed out, even though
    the user never meant to use it.
  - Hard tasks ask for Claude by name, so a GPT-only setup can wait forever.
  - The reserve can lock non-lead sessions out of the only family there is, so they wait.
- Review always starts two reviewers and checks always aim for the other family. Someone
  who wants a lighter setup can't choose one reviewer.

## What good looks like

- With leads ordered GPT first, the reserve setting keeps GPT for leads and sends other
  work to Claude first. With Claude first, it behaves as it does today.
- A GPT-only user, and a Claude-only user, can take an idea from first message to an open
  pull request without any session waiting forever or the readiness check failing because
  of the missing family.
- Choosing one reviewer gets one reviewer per round. Choosing a checker family gets checks
  from that family.
- Someone with both accounts who changes nothing sees the same behaviour as today.

## Not doing

- Changing how the week's usage is forecast.
- Adding providers beyond Claude and GPT.
- Changing which model tier each role runs on (the separate "Other agents" setting).
- Changing the command-line workflow (`/plan-review`, `/verify`) outside the app, unless
  planning finds it shares the same setting.

## Constraints

- Existing saved settings keep working: the old "Save Claude for leads" value carries over.
- Wrappers carry no content; rules stay in `protocol/`.
