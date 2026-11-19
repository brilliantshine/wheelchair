# Remediation 8: verification attempt 8 (commit 2eac321)

The Claude verifier passed. The GPT verifier failed with 4 gaps.

- Gap 1 is new and must be fixed. The lead approved the fix: a Node launcher plus reserving the shell's special names.
- Gaps 2-4 belong to the read-only card display family, which survived R6 and R7. That makes it a plan defect, so it went to Collin. He picked "Show every field as written", recorded as Decision Log 51.

All four gaps are fixed in one pass.

## Gaps (verbatim)

1. Keys at session start — A referenced `OPTIND` key with a text value passes validation, but the launcher shell exits before starting the agent and prints the supplied value in its error. A launch probe exited 2 with no agent output — `machine/lib/project-keys.js:9`, `machine/service.js:633`.
2. Reading what a tool runs — A valid `type: "http"` tool with an extra `command` field is labeled as a command and displays that field as what runs. The phone-width probe showed the URL and headers relegated to raw extras — `viewer/pages/project-tools.js:110`.
3. Reading key status — A read-only header such as `Bearer ${TOKEN} trailing` shows the literal reference and "edit in the file," but omits the key's set status even when the Keys list shows `TOKEN` as set — `viewer/pages/project-tools.js:358`.
4. Editing unrepresentable entries — A read-only entry such as `{"type":"custom","timeout":5000}` hides both fields. The phone-width card showed only the generic read-only message and skip reason — `viewer/pages/project-tools.js:113`, `viewer/pages/project-tools.js:394`.

## Tasks

| Task | Gaps | Lane |
|---|---|---|
| R8-1 | 1 | standard, `--provider gpt` (machine; GPT built it) |
| R8-2 | 2, 3, 4 | standard, `--provider claude` (page) |

The two tasks own disjoint files and run in parallel.

# Task R8-1: machine. A Node launcher for session keys, and the shell's special names reserved

Plan slug: project-tools-screen. Task id: R8-1. Read the Spec's Keys section in PLAN.md. Read `machine/service.js` `startIn` (~lines 612-660), all of `machine/lib/project-keys.js`, and the test `session launcher passes only selected keys outside recorded commands` in `machine/test/project-keys.test.js` (~line 40).

Today, launch writes `export K='v'` lines to `<stateDir>/session-env/<name>.sh` and wraps the CLI in `sh -c '. "$0" && rm -f -- "$0" && exec "$@"'`. A key named `OPTIND`, `IFS` and so on breaks that shell, and the shell's error prints the value. Replace it as follows.

1. **New file `machine/lib/env-launch.js`**, a standalone Node script run as `node env-launch.js <env-file> <cli> [args...]`. It does these steps in order:
   1. Read `<env-file>` as JSON. It must be a plain object whose every value is a string.
   2. Delete the file. Always try to delete it, even after a read or parse failure, and ignore a delete error.
   3. Build the child environment: `process.env` plus those entries.
   4. Replace itself with `<cli>`:
      - Use `process.execve(resolvedPath, [cli, ...args], env)` when `typeof process.execve === 'function'` (Node 22.15 and later).
      - Otherwise (Node 20), `spawn` the CLI with `stdio: 'inherit'` and that env. Forward SIGINT, SIGTERM and SIGHUP to the child, and exit with the child's code, or re-raise its signal.
      - Resolve a `cli` without a slash against `PATH` from the merged env: the first executable file wins.

   **No value may ever be printed.** Every error the launcher can hit gets a fixed message on stderr. Never print an `Error` object, its `message`, the file's contents or a key name.
   - If the file can't be read or parsed, or isn't the right shape, print `wheelchair: project keys couldn't be loaded; starting without them` and start the CLI without the keys.
   - If the CLI can't be found or started, print `wheelchair: the agent couldn't be started` and exit 127.
2. **`machine/service.js` `startIn`:**
   - Write the env file as `<stateDir>/session-env/<name>.json`: `JSON.stringify(env)`, created with `{ mode: 0o600 }` and then `chmod 0o600`, as now.
   - Set `wrapper = [process.execPath, path.join(__dirname, 'lib', 'env-launch.js'), file]`.
   - Remove the `sh -c` wrapper and the `export` line building. Nothing else in `startIn` changes.
3. **`machine/lib/project-keys.js`:** add to the `exact` reserved list `IFS`, `OPTIND`, `OPTARG`, `PS1`, `PS2`, `PS4`, `PPID`, `ENV`, `CDPATH`, `HISTFILE`, `MAIL`, `MAILPATH`. Exact names already compare case-insensitively. The page and the Read reply get this list from `reservedNames()`, so nothing else changes.
4. **`machine/AGENTS.md`:** add a row for `lib/env-launch.js`, saying it's the session key launcher: it reads and deletes the mode-600 JSON env file, then execs the CLI, and never prints values.

## Tests (`machine/test/project-keys.test.js`)

- **Update the existing launcher test** to the `.json` file and the Node wrapper. Keep its assertions:
  - argv, `session.command` and the tmux log carry no value;
  - only the selected keys reach the agent;
  - the file is gone after start.

  Add an assertion that the file was mode 600 while it existed, if the test can observe it. Otherwise, assert the `writeFile` mode in a unit check.
- **New test, the launcher run directly:**
  - Write a JSON env file `{ "OPTIND": V, "IFS": V, "PLAIN": V }`, where `V = "a'b\"c $(x) ${y}\nnext"`.
  - Run `node machine/lib/env-launch.js <file> <fake-agent>`. The fake agent is a small Node script in a temp dir. For each of the three names, it prints `NAME=ok` if `process.env[NAME] === V`, else `NAME=bad`.
  - Assert stdout says `ok` for all three and stderr is empty.
  - Assert neither stdout nor stderr contains any part of `V` (check the substrings `a'b` and `next`).
  - Assert the env file no longer exists.
- **New test, launcher errors:**
  - An env file containing `{"OPTIND": "a'b` (invalid JSON). The agent still starts, stderr is exactly the fixed message line, nothing prints `a'b`, and the file is deleted.
  - A missing CLI exits 127 with the fixed message and no value.
- **Extend `references, reservations and held-back names`:** `isReserved('OPTIND')`, `isReserved('ifs')` and `isReserved('MAILPATH')` are true. `isReserved('MAILBOX')` is false.

Use `test-support/run-dir.js` (`makeTemp`/`makeTempSync`) for temp folders.

## Ownership boundary

- `machine/lib/env-launch.js` (new)
- `machine/service.js`: the key-injection block in `startIn` only
- `machine/lib/project-keys.js`: the `exact` list only
- `machine/test/project-keys.test.js`
- `machine/AGENTS.md`: one row

## Validation

```
bash machine/test/run.sh
node --test machine/test/project-keys.test.js
```

# Task R8-2: page. Read-only cards show every raw field (Decision Log 51), and read-only rows show key status

Plan slug: project-tools-screen. Task id: R8-2. Read Decision Log 50 and 51 and the Spec's Reading section ("Each tool shows ...") in PLAN.md. Read `viewer/pages/project-tools.js` whole first, especially `parseEntry` (~84), `viewEntry` (~110), `rowLine` (~358) and `toolCard` (~384). This is Collin's rule. Implement it exactly.

1. **Cards the form can't edit** (`!editable` in `toolCard`: `parseEntry` returns null, or the name is unshowable) no longer go through `viewEntry`. They show:
   - **The kind chip, from `type` only.**
     - `http` shows `web address`.
     - Absent, or `stdio`, shows `command`.
     - Any other value is shown as written, through `showText` for a string and `JSON.stringify` otherwise.
     - If the raw entry isn't a plain object, the chip says `edit in the file`.
   - **Every raw field, in file order** (`Object.entries(raw)`), one line each as `name: value`.
     - The name goes through `showText`.
     - The value is `showText(value)` for a string and `JSON.stringify(value)` for anything else.
     - Everything is set as text (the `h(..., { text })` helper), never as HTML.
     - Nothing is hidden or reinterpreted. `type`, `command`, `url`, `args`, `env` and `headers` are all listed like any other field.
     - If the raw entry isn't a plain object, show one line with `JSON.stringify(raw)`.
   - **A key line:** one `‹key NAME›` with a set or not set chip (same markup as `rowLine`'s key chip) for every name in the tool's machine `checks.keys` (`checksFor(name).keys`), in that order, judged against `state.keys`.
   - The existing "The form can't edit this tool. Edit in the file." hint, the checks lines (skip, machine key warnings, "shared with", "needs") and the Remove action, all unchanged.
2. **Editable cards** render from `parseEntry`'s result, exactly as today. They use `p.kind`, `p.command`/`p.args` or `p.url`, `p.extras` and `p.envRows`/`p.hdrRows` through `rowLine`. Then **delete `viewEntry`**: no card uses it any more. Its lenient kind guessing is what produced gap 2.
3. **Read-only rows show key status** (`rowLine`'s `row.ro` branch, on any card). Take the names the row's raw value references: the `${NAME` matches of `/\$\{([A-Za-z_][A-Za-z0-9_]*)/g` on `row.raw`, when it's a string. Keep only names in that tool's `checks.keys`. For each, append `‹key NAME›` and a set or not set chip after the row's text, judged against `state.keys`. `rowLine` needs the tool's key list: pass it in as an argument. Reserved names (`row.env`) aren't in `checks.keys`, so they get no chip.
4. Display only. Nothing that is saved changes.

## Tests (`viewer/test/app-project-tools.spec.js`)

Append one test for each case below. Update existing assertions that checked the old read-only card layout, and list each one you changed in the report.

- **Tool `{ type: "http", url: "https://x", command: "run-me", headers: { A: "b" } }`:**
  - the chip reads `web address`;
  - the card shows the lines `type: http`, `url: https://x`, `command: run-me` and `headers: {"A":"b"}`, in that order;
  - there is no Edit button.
- **Tool `{ type: "custom", timeout: 5000 }`:** the chip reads `custom`, and the card shows `type: custom` and `timeout: 5000`.
- **An editable http tool with header `Authorization: "Bearer ${TOKEN} trailing"`:**
  - the double's read gives `checks.<tool>.keys = ["TOKEN"]` and `keys: ["TOKEN"]`;
  - its card row shows `‹key TOKEN›` with a `set` chip;
  - with `keys: []` the chip says `not set`.
- **A non-editable tool whose `checks.keys` is `["K"]` with `keys: []`:** the card shows `‹key K›` `not set`.
- **A field value containing `<b>x</b>`:** it is shown as literal text, and no `b` element is created.

## Ownership boundary

- `viewer/pages/project-tools.js`
- `viewer/test/app-project-tools.spec.js`

## Validation

```
npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js   # run twice; both must pass
```
