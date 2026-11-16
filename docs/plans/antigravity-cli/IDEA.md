---
slug: antigravity-cli
status: draft   # draft | confirmed
created: 2026-11-16
---

# Antigravity CLI as a third agent provider

## What we're building

Wheelchair can run agent sessions on Google's Antigravity CLI (`agy`), alongside Claude
and Codex. You add an Antigravity account from Settings: the app shows the sign-in link,
you open it on any device, sign in to Google, and paste the code you get back into the
app. The machine's CLI is then logged in, without you ever using a terminal on it.

## Why — the problem

Today only Claude and Codex accounts can run sessions. When both are rate-limited, or when
you want a third model family's opinion, there is nowhere else to send the work. Signing
in a CLI on a remote machine also normally means SSH-ing in and reading a terminal, which
you can't do comfortably from a phone.

## What good looks like

- Settings lists Antigravity next to Claude and Codex, with its own accounts and models.
- Adding an Antigravity account shows a link and a box for the code; after pasting it,
  the account shows as signed in on that machine.
- The Ready check reports whether Antigravity is installed and signed in.
- A session placed on Antigravity starts, takes turns, and shows its messages in the
  thread like any other session, and finishing a turn is noticed the same way.
- When Claude and Codex are both unavailable, work can land on Antigravity instead.

## Not doing

- Installing the `agy` CLI for you; it must already be on the machine.
- Replacing or changing how Claude and Codex sign in or run.
- Supporting Google API-key or Vertex billing sign-in; only signing in with a Google
  account.

## Constraints

- The sign-in must work from a phone over the app, with the machine headless (no browser
  on it).
- Nothing about the Antigravity account's credentials passes through the hub beyond what
  Claude and Codex sign-in already do.
- Behaviour of the real `agy` CLI (its login screen, transcript, hooks) has to be checked
  on a machine where it is installed; public docs alone are not enough.
