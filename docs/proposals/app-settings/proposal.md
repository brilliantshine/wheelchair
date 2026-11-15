# Settings and asides

Nov 14, 2026 · Collin Zhong

> **Status:** a proposal waiting for `/adopt`, not yet planned or built. Collin wrote it as
> an addendum to the app-shell proposal while designing the settings screens and the thread
> aside on 2026-11-14. By then the app-shell plan (`docs/plans/app-shell/`) had already been
> built and verified as slice 1, so the addendum moved here as its own feature, unchanged
> below this note. "The proposal" in the text means
> [`../app-shell/proposal.md`](../app-shell/proposal.md). The screens stay on the shared
> app canvas in [`../app-shell/design/`](../app-shell/design/): `SettingsAccounts`,
> `SettingsUsage`, `SettingsModels`, `SettingsTemplates`, `SettingsWriting` and
> `ThreadAside` (`.dc.html`).
>
> **Overlaps to settle when planning:**
> - Asides solve the problem `../app-side-conversations/proposal.md` raises, which came up
>   during the acceptance run. Plan the two together.
> - The Settings page item in `docs/plans/app-shell/acceptance-followups.md` (the
>   permission mode and model pins) belongs here too.
> - The tier rename and the lead writing style reach `protocol/`, which is outside the app:
>   `lanes.md`'s tier names, and IDEA's non-goal that app agents drop the writing rules.

An addendum to the proposal, settled while designing the settings screens and
the thread aside on 2026-11-14. Read it alongside the proposal. Where the two disagree, this
file is newer and wins; the two changes it makes to earlier decisions are listed first.

## Changes to earlier decisions

| Earlier decision | Now |
| --- | --- |
| Tiers are called Luna, Terra, Sol and Astra | The app calls them **Light, Standard, Heavy and Critical**. The old names stay only inside the GPT model names. |
| The writing rules, SEEN.md and the per-turn wording list are dropped | Still dropped for every agent, but **leads** now follow a writing style Collin writes himself (see Writing style). Its "never say" list replaces the wording list. |

## Accounts

- Any number of accounts per provider: Claude, ChatGPT (Codex), Google, OpenRouter, and
  later other coding CLIs such as Kimi Code or DeepSeek CLI.
- Subscriptions sign in through the CLI's own login, once per node, each account in its own
  login folder so accounts never mix.
- Pay-as-you-go keys (OpenRouter, any other API) have a monthly dollar cap instead of
  resets.
- Each account card shows its plan, the nodes it's signed in on, this 5-hour window, this
  week, and problems such as "signed out on beelink" with a button to fix them.

## Usage and balancing

- Usage is read from each CLI's own usage command, or from the API for OpenRouter.
- Accounts are grouped by provider. Each provider shows **one bar: how much of this week is
  left across all its accounts**, weighted by plan size. Collin doesn't need to know which
  account is next, only when a provider's combined week is running low.
- A provider's bar turns amber when what's left won't last until its first refill at the
  current pace, and says so in one line ("runs out Sunday night, before the first refill
  Monday 14:00").
- Opening a provider shows each account's 5-hour window, week left, full reset time, which
  account is next, and why.
- Within a provider, the default is to use whatever refills soonest, so the least goes
  unused. Other choices: spread evenly, or one at a time.
- Limits: notify once per provider per week below a threshold (default 25%); leave a share
  of each account for Collin's own use (default 10%); shift workers to another provider when
  one runs low; pay-as-you-go only when every subscription is out, then stop at the cap.

## Models and preferences

### Tiers

A table with one row per provider and four columns: Light, Standard, Heavy, Critical. Any
cell can be **Not used**, meaning that provider is skipped at that tier. Providers grow
downward as more are added.

| Provider | Light | Standard | Heavy | Critical |
| --- | --- | --- | --- | --- |
| Claude | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Fable 5.1 |
| GPT | gpt-6-luna | gpt-5.6-terra | gpt-6.1-sol | gpt-6-astra |
| Google | Not used | Gemini 4 Hydrogen | Gemini 4 Carbon | Not used |
| OpenRouter | [cheap pick] | [a DeepSeek model] | Not used | Not used |

Critical work needs two providers so one can check the other. With only one, the other
provider's Heavy model checks it and Collin is told.

### Leads

- Leads and sub-leads run on Claude Opus 5.5 only. If every Claude account is out, a new
  lead waits.
- **Save Claude for leads:** workers get Claude only when a rule asks for it, or when nothing
  else in their list has room.
- **Margin:** if the balancer forecasts Claude ending below 5% before its next reset, workers
  stop getting Claude entirely, rules included. Leads keep the margin.

### Workers

Try in order, moving down only when the one above has no room or has Not used at the tier a
part needs: GPT, then Google (once connected), then Claude, then OpenRouter. The sub-lead
picks the tier per part.

### Rules by kind of work

The sub-lead tags each part while planning the build; Collin can change a tag on the plan.

- **UI and front end:** strongly prefer Claude: Sonnet 5.5 when the plan spells out the
  design, Opus 5.5 when it's still open. Counts as a reason to use Claude even with Save
  Claude for leads on. Falls back to GPT (gpt-6.1-sol) only when Claude is below its margin.
- **Critical:** the Critical tier on whichever provider has room, checked by another
  provider's Critical model. A part is critical when Collin marks it, or when the lead marks
  it and he agrees on the Plan approved card.
- **Suggested rules,** off until added: logins, secrets and payments count as critical;
  changes that delete or migrate data get Heavy at least and ask before running; tests are
  written by a different provider than the code; work across many files never goes to Light;
  parts that come with screenshots go to a model that reads images.

### Other agents

- Plan reviewers: two providers, Heavy.
- Checker: not the provider that built it, Heavy.
- Code mapping: same order as workers, Standard.
- Asides: see below.

## Behavior templates

- Templates per role: lead, sub-lead, worker, reviewer, checker, mapper. A role can have
  several, each scoped to all projects or one.
- A template is a set of switches (save after every step, run the full test suite before
  reporting, what to do about installing packages, what to do when the brief doesn't settle
  something, a file-count limit before stopping to ask) plus free text.
- What an agent is told, top to bottom: wheelchair's built-in rules for that role (fixed),
  then the template, then the task's brief. Lower layers win, except nothing overrides the
  built-in rules.
- Changes apply to agents started after saving.

## Writing style

- Applies only to leads, because they're the only agents that write to Collin. It covers
  thread messages, question cards, the Plan approved and Done cards, and phone
  notifications.
- Settings: length, how much to use lists and headings, how to handle technical terms
  (default: build up to them unless already used together), a "never say" list, and free
  text.
- Collin's starting style: be concise, cut anything that doesn't change the meaning, and
  build up to technical terms and ground them. Never say "It's worth noting" or
  "load-bearing".
- A before-and-after preview shows the same message with and without the style.

## Asides

The problem: a question about one part of a lead's reply derails the thread, and it's hard to
get back to what the thread was doing.

- Highlight words in a lead message for a small bar: **Ask about this**, **Say it simpler**,
  **Draw it**. Every lead message also has **Ask about this message**.
- An aside opens in a side panel with the highlight quoted. The main thread doesn't change.
- The panel always shows what the main thread is waiting on (for example "your answer to
  Q6"), with a link back.
- To finish: **Done, back to …** closes it; **This changes my answer** carries a one-line
  summary into the main thread.
- The words stay underlined with a marker, so a closed aside can be reopened.
- An aside runs as a copy of the lead's conversation, so it knows everything the lead knows
  without adding to the lead's own history. That means it stays with the lead's provider.
- Model: the lead's provider at Standard (Sonnet 5.5 for a Claude lead), moving up to Heavy
  when the question needs it and saying so in one line. "Draw it" starts on Heavy.

## Open questions for planning

- [ ] The adapter every CLI needs before it can be a provider: start sessions in tmux, read
  usage, notice the end of a turn, keep logins separate. Worth designing once, early, for
  Claude and Codex too.
- [ ] How to weight the combined bar when a provider's accounts are on different plans.
- [ ] Whether each provider's terms allow several personal subscriptions feeding one
  automated setup.
- [ ] How the lead decides an aside needs Heavy.
- [ ] The Google model names above are Collin's expected lineup, to confirm once a plan is
  added.

## Screen designs

The settings screens and the aside are on the Wheelchair App design canvas, in the
Settings row and at the end of the second row. Updated copies of every screen are in
[`../app-shell/design/`](../app-shell/design/).
