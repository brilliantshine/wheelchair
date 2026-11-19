# Remediation 7 — verification attempt 7 (commit db0f8df)

Claude verifier: PASS. GPT verifier: FAIL with 3 gaps. Lead: fix all three in one task, defer none, with the fix shapes in the brief below.

## Gaps (verbatim)

1. Editing settings the form cannot represent — A setting containing `first\nsecond` appears as `firstsecond` in the editor. The form then allows a kind change that drops the setting, although the spec requires read-only settings to block kind changes — `viewer/pages/project-tools.js:464`.
2. Saving step 6 — With `release#2026` as the default branch, the fallback link for opening a PR by hand is broken … `machine/lib/project-tools.js:139`.
3. Reading read-only tools — A valid HTTP tool that the form cannot edit shows its URL but hides its headers, key status, and unknown fields — `viewer/pages/project-tools.js:371`.

## Task

| Task | Gaps | Lane |
|---|---|---|
| R7-1 | 1, 2, 3 | standard, `--provider claude` |

# Task R7-1 — one rule for fields the form can't show, read-only cards through the same row code, encoded compare link

Plan slug: project-tools-screen. Task id: R7-1. Gaps in `docs/plans/project-tools-screen/REMEDIATION-7.md`; Decision Log 47 and 50 and the Spec's Editing section in PLAN.md. Read `viewer/pages/project-tools.js` whole first. Each fix is settled by the lead; implement it as written.

1. **One rule for every single-line field.** Add one helper, `unshowable(s)`: true when a string contains any character a single-line input can't show exactly, meaning any C0 control character `\u0000`-`\u001f` (including `\n`, `\r`, `\t`) or `\u007f`. Apply it everywhere a single-line input would show raw data:
   - setting and header **names and values** (and a header's text before the key): the row becomes read-only (`ro: true`), kept verbatim, shown read-only;
   - **command** and **URL**: the field becomes read-only (like the existing `${...}` rule), kept as is;
   - **tool name**: the whole tool is shown read-only ("edit in the file"); it can't be opened in the editor;
   - args keep their existing rule (newline/`\r` already read-only); extend it to `unshowable`.
   Any read-only row or field blocks a kind change (the existing refusal). Remove any ad hoc newline checks this replaces.
3. **Read-only cards render through the same row code.** The card for a tool the form can't edit must show its kind, what it runs, its settings or headers (plain values, key rows with set/not-set chips, read-only rows), its unknown fields, and its checks, using the SAME row-rendering functions as editable cards (e.g. `rowLine`, called in read-only mode) rather than a separate code path. Where the entry has no parseable rows (e.g. `env` isn't an object), show what can be shown and "edit in the file". After this, there's one card renderer with a read-only mode.
2. **Encoded compare link** (`machine/lib/project-tools.js`, `compare_url`, ~line 139): build it as `https://github.com/<owner/name>/compare/<base>...<head>?expand=1`, where each branch name is encoded with `encodeURIComponent` and then `%2F` is turned back into `/` (GitHub expects literal slashes in branch names).

## Tests
- `viewer/test/app-project-tools.spec.js` (append; one each): a setting `{ NOTE: "first\nsecond" }` is shown read-only and a kind change is refused, and editing the command sends `NOTE` unchanged; a header value with `\t` is read-only; a command containing `\u0007` is read-only and kept on an unrelated edit; a tool name containing `\n` shows read-only with no Edit button; a read-only web tool `{ type: "http", url: "https://x", env: {}, headers: { A: "plain", B: "Bearer ${TOK}" }, timeout: 5 }` card shows `A`, `B` with its key chip, and `timeout`.
- `machine/test/project-tools.test.js` (append): with the default branch `release#2026` and `gh pr create` failing, `compare_url` is `https://github.com/owner/name/compare/release%232026...wc-tools/<id>?expand=1`.

## Ownership boundary
`viewer/pages/project-tools.js`, `viewer/test/app-project-tools.spec.js`, `machine/lib/project-tools.js` (the `compare_url` line only), `machine/test/project-tools.test.js` (append only).

## Validation
```
npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js   # run twice; both must pass
bash machine/test/run.sh
```
