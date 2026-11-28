---
slug: google-model-levels
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-27
---

# Google model list and levels

## What we're building

The Google (Antigravity) model list in Settings shows new Google models soon after Antigravity offers them. Any model Antigravity lists in levels (Low, Medium, High, XHigh) shows once, and the effort setting picks its level when an agent starts, just as effort works for Claude and GPT, so stepping up a failing task really moves to a higher level.

## Why — the problem

- Neon and Carbon show in Antigravity but not in Settings, because the app keeps an old copy of the list for an hour.
- Antigravity lists each level of a model (such as Hydrogen Low and Hydrogen High) as its own model. Wheelchair has its own effort setting on top. When a task fails and is stepped up by raising effort, it is unclear whether Antigravity follows the level in the name or the effort, so the step up may do nothing.

## What good looks like

- A model newly offered by Antigravity appears in Settings the next time Collin opens Settings, without waiting an hour.
- In Settings, Antigravity models appear once each (e.g. "Gemini 4 Hydrogen"), with effort chosen beside them as for other providers. This is a general rule for any model Antigravity lists in levels (today Hydrogen, Neon, Carbon, Argon and Flash, and any added later), not a fixed list of names.
- An agent started on a Google model at a given effort runs the matching level (Hydrogen at high runs Hydrogen High; Neon at xhigh runs Neon XHigh; Carbon at low runs Carbon Low).
- Stepping up a failing task's effort starts it on the next level up.
- Settings already saved with a level in the model name keep working.

## Not doing

- Checking which models Collin's Google account is allowed to use beyond what Antigravity lists.
- Changing how stepping up works for Claude, GPT or other providers.

## Constraints

- Antigravity's own list (`agy models`) is the only source of which models and levels exist.
