# Remediation 2 — verification attempt 2 (commit 0cd19d1)

Both verifiers (claude-opus-5-5, gpt-6.2-sol) reported FAIL; both confirmed the eight attempt-1 gaps fixed. Seven distinct gaps after merging one duplicate. Lead: fix all, defer none, with the fix shape given per gap (recorded in the briefs below).

## Gaps (verbatim, merged)

1. (both) Keys — "A key shown 'not set' on this machine is shown as a key warning on the tool" — Remediation 1 broke this for tools the form can't show … the page now throws it away and never rebuilds it — `viewer/pages/project-tools.js:310-328`. / Missing-key warnings — The tool cards suppress missing-key warnings for read-only references, including a header using `${A}` and `${B}` and an env setting `ALIAS: "${TOKEN}"` … `:99–101` and `:320–328`.
2. Project isolation after Save — Switching from Alpha to Beta while Alpha's post-save refresh was pending displayed Alpha's PR link on Beta — `viewer/pages/project-tools.js:642–647`. (Same family as attempt-1 gap 2.)
3. Launch key holdback — An argument `${PRIMARY:-${FALLBACK}}` holds back only `PRIMARY` — a direct `launchKeys` probe showed `FALLBACK` injected when it was also referenced from an eligible env setting. See `machine/lib/project-keys.js:18` and `:50–53`.
4. Valid key names — A tool referencing the valid key name `constructor` makes Read report that GitHub is unreachable … `function is not iterable` at `machine/lib/project-tools.js:25–27`.
5. Read-only field preservation — Editing a tool's URL silently dropped its read-only `__proto__` header from the outgoing Save — `viewer/pages/project-tools.js:518–525` rebuilds headers using assignment to a plain object.
6. Saving a new header key — The form accepts a literal `$` in the text before a key, then drops the entered key value when saving — `viewer/pages/project-tools.js:64–70` and `:560–585`.
7. Start over — The machine accepts a nonempty replacement list for an unreadable source — `machine/lib/project-tools.js:100–111`.

## Tasks

| Task | Gaps | Lane |
|---|---|---|
| R2-1 | 1, 2, 5, 6 (page) | standard, `--provider claude` |
| R2-2 | 3, 4, 7 (machine) | standard, `--provider gpt` |

# Task R2-1 — page: four verification gaps in the Project tools section

Plan slug: project-tools-screen. Task id: R2-1. Gaps 1, 2, 5 and 6 in `docs/plans/project-tools-screen/REMEDIATION-2.md`. File: `viewer/pages/project-tools.js` (read it whole first). Each fix is settled by the lead; implement it as written.

1. **Machine "needs" warnings are the source.** On the tool card (~lines 310-328), render every machine key warning from `r.checks[name].key_warnings`. For a warning matching `needs <NAME>, not set on this machine`, show it only while `!state.keys.includes(NAME)` (so it disappears after the key is set and comes back after it is removed). Never drop a warning because the tool or a row is read-only or can't be parsed. Additionally, for keys referenced by parsed key rows of a tool as it is in the draft (`state.tools`) that the machine's list doesn't already name, add a computed "needs <NAME>, not set on this machine" while unset. Held-back and every other warning: as given.
2. **Every async response is tagged and dropped when stale.** Add `state.gen`, bumped on every machine change and every project change (and on `clearView`). Every request the page makes — the New thread picker load (`GET /new-thread`), `read` (including the reloads `handle()` does after `opened`, `pr_failed`, 409), `save`, `remove-key` — captures `{ machine, path, gen }` before sending and, when the reply arrives, drops it entirely (no state, token, keys, status or view change; only clear busy for the request it belongs to) unless `state.machine`, `state.path` and `state.gen` still match. In `handle()`, the status shown after the post-save reload (PR link, `pr_failed` link, 409 reason) must also be dropped if the tag no longer matches after the reload returns. (There are no lock or status-check requests in this build; they are Deferred.)
5. **Name-keyed lookups never use plain objects.** Wherever the page builds or looks up an object keyed by a tool, setting, header or key name (`buildEntry`'s env/headers, `toolsUsingKey`, references/checks lookups, `state.pending`, rename in `apply()`), use `Object.create(null)` (or a `Map`) and `Object.hasOwn` / `Object.defineProperty` so names like `__proto__` and `constructor` round-trip. A header named `__proto__` must survive an edit of its tool's URL.
6. **No `$` in the text before a key.** `apply()` refuses any `$` in a header's "text before the key" field ("The text before the key can't contain $.").

## Tests (append to `viewer/test/app-project-tools.spec.js`, one test each)
- read-only tool (`{ command: 'run', env: { K1: '${K1}' }, headers: { a: 'b' } }`) with machine warning `needs K1, not set on this machine` shows it; after setting K1 it disappears; a header with two `${...}` and env `ALIAS: "${TOKEN}"` keep their machine warnings too.
- switching project mid-request, one test per kind: picker load (switch machine), read, save (`saved`), save (`opened`, switching during the post-save reload), remove-key — each shows nothing from the first project on the second.
- a `__proto__` header survives an edit of its tool's URL in the outgoing Save; a tool and a key named `constructor` render and save.
- `$` in the text before a key is refused.

## Ownership boundary
`viewer/pages/project-tools.js`, `viewer/test/app-project-tools.spec.js`.

## Validation
```
npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js
```

# Task R2-2 — machine: three verification gaps

Plan slug: project-tools-screen. Task id: R2-2. Gaps 3, 4 and 7 in `docs/plans/project-tools-screen/REMEDIATION-2.md`. Each fix is settled by the lead.

3. **Hold back every name inside `${...}` in command, args or URL** (`machine/lib/project-keys.js` `keyReferences`, ~line 18). Parse each `${...}` with brace matching (nested `${A:-${B}}` included) and collect every variable name that appears anywhere inside it — the outer name and every name in defaults, at any depth. All of them are held back (same `{ tool, field }` records). `launchKeys`, Read's key warnings and Save's conflict check all use this, so no other change is needed there. Unbalanced braces: hold back every `NAME` matched by `\$\{([A-Za-z_][A-Za-z0-9_]*)` in that string.
4. **Name-keyed lookups never use plain objects** in `machine/lib/project-keys.js` and `machine/lib/project-tools.js`: `references`, `heldBack`, `checks`, the key store's `keys` when read/written/looked up, `launchKeys`' env, the `valid` map in `checksFor`. Use `Object.create(null)` or `Map` and `Object.hasOwn`, so a tool or key named `constructor`, `__proto__`, `toString` works. The JSON replies keep the same shapes (serialize `Object.create(null)` objects normally).
7. **Start over requires an empty list**: `save` refuses (400, "start over replaces the file with an empty tool list") when `start_over` is true and `tools` isn't exactly `{}` (a plain object with no keys).

## Tests (append; one test each)
- `machine/test/project-keys.test.js`: `${PRIMARY:-${FALLBACK}}` in args holds back both; `${A:-x${B:-${C}}}` in a URL holds back A, B, C; `launchKeys` doesn't inject FALLBACK even when an env setting references it.
- `machine/test/project-tools.test.js`: a source with tool `constructor` and env key `constructor` reads in `tools` mode with checks for it; a key named `toString` can be set and appears in `keys`; Start over with a non-empty `tools` → 400.

## Ownership boundary
`machine/lib/project-keys.js`, `machine/lib/project-tools.js`, `machine/test/project-keys.test.js`, `machine/test/project-tools.test.js`.

## Validation
```
bash machine/test/run.sh
```
