---
slug: sudo-cards
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Run sudo commands from a card

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | The command runs non-interactively, stdin closed after the password, with a time limit (default 10 minutes) | IDEA.md rules out interactive commands; a hung command must not hang forever | defaulted |
| 2 | The agent gets the exit code and output (stdout and stderr, capped in size); the card shows the same result to Collin | IDEA.md: the agent learns whether it worked | defaulted |
| 3 | "Talk about it" sends the lead a message that Collin wants to discuss the request; nothing runs and the card stays open | IDEA.md | defaulted |
| 5 | Isolation must hold against a hostile agent: a separate helper, running under an identity agents can't control, with root-owned code agents can't edit, serves the password box and runs the command; the password never passes through the hub, the machine service or any page they serve | Collin picked "safe from a hostile agent" | user |
| 6 | The helper runs as a root system service (installed once with sudo), checks Collin's password against his account via PAM and that he may use sudo, then runs the command as root. It is reachable only through Tailscale HTTPS on its own port | sudo authenticates the invoking user, so a separate unprivileged user can't use Collin's password; PAM keeps the check as strict as sudo's | defaulted |
| 7 | Only a lead may post a sudo request; other sessions ask the lead with a `message`, and the lead decides whether to bring it to Collin. The hub refuses the card from any other role | Collin picked "only the lead" | user |
| 8 | Confirm is two presses: Run, then a red "Confirm: run as root" button replaces it for 5 seconds; letting it lapse returns to Run. This lives on the helper's page, beside the password box | Collin picked "press, then confirm" | user |
| 9 | No secret word or other anti-phishing check; a lookalike password page built by a hostile agent is an accepted risk | Collin picked "accept the risk" | user |
| 10 | Supersedes 6: the helper is a root system service that checks the password by running Collin's own `sudo` with `-k` (through `runuser`), so his sudoers rules, logging and password policy apply unchanged; no separate PAM code | Reuses sudo's own check instead of reimplementing it; `runuser` + setuid `sudo` keeps every process holding the password out of reach of Collin's user | defaulted |
| 11 | The helper is Python 3 standard library only, served through `tailscale serve` from a root-only Unix socket; the machine service reaches it through a second socket | `/usr/bin/python3` ships with Debian, with nothing to install; a root-only socket can't be taken over by an agent the way a TCP port could | defaulted |
| 12 | Requests live in the helper's memory only: unrun after 1 hour they expire; a helper restart expires them all; 3 wrong passwords end the request | Nothing durable to leak or replay | defaulted |
| 13 | The sudo request runs on the machine where the lead runs | The work that needs sudo is on that machine | defaulted |
| 14 | Supersedes 10: the password is checked by `sudo -S -k -l <command>` run as Collin (authenticates and checks the command is allowed, runs nothing); the helper then runs the command itself as root with stdin `/dev/null` | With `sudo -S` running the command, a NOPASSWD rule leaves the password unread in the command's stdin | review-round-1 |
| 15 | `request_id` correlates card and outcomes; the machine keeps a small request file and posts outcomes only after the card is accepted; new idempotent hub route `sudo-outcome`; unknown id → 409 retry | Review: no correlation or ordering defined | review-round-1 |
| 16 | Decline is reported only after the helper confirms it; a lost race shows the run result; an unreachable machine returns the card to waiting | Review: Decline could promise nothing runs when something did | review-round-1 |
| 17 | The helper page carries no request data in HTML; a static script sets every field with `textContent`; strict CSP with no inline script | Review: agent-controlled fields could inject script into the real password page | review-round-1 |
| 18 | Only the command text is frozen. The lead writes the actual commands into the card, never a script it wrote; the helper flags any file named in the command that Collin's user could change, on the card and the run page. IDEA.md "What good looks like" narrowed to match | Collin picked "inline it, flag files" | idea-change |
| 19 | Supersedes 14's check: the password is checked with `sudo -k -v` and the command's permission with `sudo -k -l`, each writing the password only after a sentinel prompt appears; a machine whose sudo asks for no password fails closed | Review round 2: `-l` follows `listpw` (default any), so one NOPASSWD entry let any password pass | review-round-2 |
| 20 | Intake refuses `~` in the command; the editable-file scan uses `shlex` | `~` meant Collin's home in the warning but /root at run time | review-round-2 |
| 4 | The command is fixed when the card is posted; the run uses the stored text byte for byte and the card shows it in full, unabridged | IDEA.md: what runs is exactly what is shown | defaulted |

## Spec

### Summary

A lead that needs a command run as root posts a `sudo` card. Collin sees the command, what it
does and why, and can Decline, Talk about it, or open a page served by a separate root-owned
**sudo helper** on the lead's machine, type his password there, press Run then Confirm, and
have the helper run the command. The lead gets the exit code and output, never the password.

### Who may ask

- Only a lead posts a `sudo` card. The hub and the machine service both refuse it from any
  other role. Workers and sub-leads ask the lead by `message`; `lead.md`, `sub-lead.md`,
  `worker.md` and `cards.md` say so.
- `lead.md` adds: ask for sudo only when the task truly needs root, use the smallest command
  that does the job, and say plainly in `does` and `why` what it changes on the machine.

### The `sudo` card (lead → app)

Fields, all required strings: `command` (the exact shell command, run with `/bin/sh -c`,
at most 4096 bytes, no NUL), `does` (plain words: what it changes), `why` (why the task needs it).

Flow:
1. `card.js sudo <file>` validates and posts to the machine service as any card.
2. The machine service, for kind `sudo` only, first registers the request with its local
   helper through the intake socket (below) and gets back `request_id` and `url`. It adds both
   to the card and forwards it to the hub as usual (spool, retry). If the helper is not installed
   or not answering, the post fails and `card.js` exits non-zero with: `sudo helper not
   installed on <machine>; Collin installs it once with: sudo <root>/sudo-helper/install.sh`.
   The lead then tells Collin that in a reply (and with a `needs` card).
3. The hub stores and shows the card: command in a monospace block, shown in full (wrapping, no
   truncation), `does`, `why`, and three controls: **Open to run** (a link to `url`, opening
   a new tab), **Decline**, **Talk about it**. No password field exists anywhere in the hub's pages.
4. Card states: `waiting`, `declining`, `running`, `ran` (exit code + output), `declined`,
   `expired`, `failed` (3 wrong passwords or not allowed). Buttons show only in `waiting`;
   `declining` shows "Declining…"; `running` shows "Running…"; the rest show the outcome.

**Correlation.** The helper's `request_id` is the one key. The machine service adds it to the
card before forwarding; the hub stores it on the card and keeps a `request_id → card id` index in
thread state. Every outcome names `request_id`; the hub never needs the machine to know card ids.
Intake takes `{command, does, why}` only (no thread or card reference).

**Outcomes, machine → hub.** New route `POST /api/machine/sudo-outcome` (machine secret,
beside `cards` and `events` in `viewer/app/routes.js` `handleMachine`), body
`{request_id, state, exit_code?, output?, truncated?, delivery_id}`, where `state` is `running`,
`ran`, `declined`, `expired` or `failed`. Idempotent: a repeat or an older state than the card
already has returns 200 and changes nothing. On the first terminal state the hub updates the card
and queues one message to the lead (below). An unknown `request_id` returns 409, which the machine
treats as "retry later", not as a rejection.

**Ordering and durability on the machine.** The machine service keeps a small file
`sudo-requests.json` in its state directory (0600; no password ever exists in the machine
service): per `request_id`, whether its card has been accepted by the hub, the last state the
helper reported (for a terminal state, with its exit code and output) and whether the hub has
acknowledged it. Every change to this file is written atomically before the action it records
is treated as done. It:
- polls the helper every 2 seconds for each request whose state is not yet terminal. Once a
  terminal state is saved, it stops polling that request and delivers the saved result; a later
  `expired` from the helper (restart, retention) can never replace a saved terminal result;
- for a `sudo` card, saves "accepted" **before** deleting the card's spool file. A crash between
  the hub's 2xx and that save leaves the spool file, so the card is resent; the hub answers the
  duplicate `delivery_id` with 200, and the machine then saves "accepted" and deletes the file;
- posts an outcome only after that request's card has been accepted (2xx from `/api/machine/cards`);
- retries outcome posts on 5xx, 409 or no connection until a 2xx, newest state only;
- on restart, reloads the file and resumes. A helper that no longer knows the id answers
  `expired`, which is posted like any outcome. Entries are dropped once a terminal state is
  acknowledged.

**Decline.** The press sets the card to `declining` and the hub calls the machine
(`POST /sudo/<request_id>/cancel` on the machine service API, `machine/API.md`), which calls the
helper's cancel. The helper answers with the request's actual state:
- `declined`: the card becomes `declined`, the lead gets `[card <id>] declined`.
- `running` or a terminal state (Run won the race): the card takes that state; the outcome follows
  as usual; Collin sees the run result, not "declined".
- machine or helper unreachable: the card returns to `waiting` with a one-line note "Couldn't reach
  <machine> to decline. Try again." Nothing is reported as declined until the helper confirms it.
The helper's own transitions are atomic under one lock: `waiting → running` on a good password,
`waiting → declined` on cancel; whichever comes first wins. A cancel that arrives while the
password check is still going wins, and the check's result is discarded.
The hub's call to the machine has a 10-second timeout, treated as unreachable. When the hub
starts, any card still in `declining` returns to `waiting` with the note "Decline status unknown; checking…" until the next outcome arrives.

What reaches the lead (typed like any press, shown as a short bubble in the thread):
- `[card <id>] sudo ran: exit <n>` followed by the output block.
- `[card <id>] declined`, `[card <id>] sudo expired`, `[card <id>] sudo failed: <reason>`.
- `[card <id>] talk about: sudo request`: nothing runs; the card stays `waiting` and Open to run
  still works.

### The sudo helper

Lives in the clone at `sudo-helper/` (new top-level directory, with an `AGENTS.md` router and a
row in the root `AGENTS.md` tables), but **runs only from an installed root-owned copy**.

**Install** — `sudo-helper/install.sh`, run by Collin with sudo, from the canonical clone
(refused from a worktree via `install/guard.sh`, as the other writers are):
- Copies `helper.py` and `static/` (`page.html`, `page.js`, `page.css`) to `/usr/local/lib/wheelchair-sudo/` (root:root,
  dirs 0755, files 0644).
- Writes `/etc/wheelchair-sudo.conf` (root, 0644): `user=<SUDO_USER>`, the user whose password
  is checked and whose sudo rights apply; `url_base=https://<tailnet DNS name>:8445`.
- Writes and enables `wheelchair-sudo.service` (systemd system unit, `User=root`,
  `RuntimeDirectory=wheelchair-sudo`, `Restart=on-failure`).
- Runs `tailscale serve --bg --https=8445 unix:/run/wheelchair-sudo/page.sock`.
- Idempotent; re-running is also how Collin updates the helper. `./install.sh` (the user-level
  installer) never touches it; it only prints a one-line hint when the helper is missing.
- `sudo-helper/install.sh --uninstall` removes the unit, the installed files, the config and
  the serve entry.

**Sockets** (in `/run/wheelchair-sudo/`, dir root 0755):
- `page.sock`, root:root 0600: the browser page, reachable only via `tailscale serve`.
- `intake.sock`, root:<user's group> 0660: the machine service's API.

**Intake API** (JSON over HTTP on `intake.sock`):
- `POST /requests` `{command, does, why}` → `{request_id, url, editable}`.
  `request_id` is 128 random bits, hex; `url` is `<url_base>/r/<request_id>`.
- `GET /requests/<id>` → `{state, exit_code?, output?, truncated?}`.
- `POST /requests/<id>/cancel` → declines a `waiting` request; answers with the request's actual state either way.

**Page** (on `page.sock`):
- `GET /r/<id>`: a fixed HTML page (`static/page.html`) that loads `/static/page.js` and
  `/static/page.css` from the helper and nothing from the network. It shows the
  helper's own copy of command, does and why; the target user name; a password box; Run.
  Run becomes a red "Confirm: run as root" for 5 seconds, then reverts. Mobile-first layout.
  An unknown or closed id shows its outcome or "No such request".
- `POST /r/<id>/run` with the password (form body). The page then shows "Running…" and polls
  `GET /r/<id>/status` until done, then shows exit code and output.
- **Rendering contract.** `command`, `does`, `why` and `output` are agent-controlled. The HTML
  template contains no request data at all. A static script file served by the helper
  (`/static/page.js`) fetches `GET /r/<id>/data` (JSON) and sets every field with `textContent`.
  No inline script, no `innerHTML`, no template interpolation of request data anywhere.
- Headers: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, a CSP of
  `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'`, `X-Frame-Options: DENY`. The password box has
  `autocomplete="current-password"`.

**Running** (on `run`, only while state is `waiting`; one run at a time per request):
1. Check, in two sudo calls run as the user, neither of which runs the command. Each uses a
   prompt sentinel: `-p` set to a fresh random string per call. The helper writes the password
   to sudo's stdin **only after** that sentinel appears on sudo's stderr, then closes stdin.
   - a. Password: `/usr/sbin/runuser -u <user> -- /usr/bin/sudo -S -k -v -p <sentinel>`.
     Good only if the sentinel appeared and the exit code is 0. If sudo exits without
     prompting (every sudoers entry for the user is NOPASSWD), the request becomes `failed`
     with "sudo on this machine asks for no password, so a sudo card can't check one". Fail
     closed: agents could already run sudo themselves there.
   - b. Allowed: `/usr/sbin/runuser -u <user> -- /usr/bin/sudo -S -k -l -u root -p <sentinel> -- /bin/sh -c <command>`,
     password written only if the sentinel appears (`-l` may not prompt under `listpw`; that is
     fine, the password was already checked in a). `-u root` because the helper runs the command
     as root whatever the sudoers `runas_default` is. Exit 0 = allowed; otherwise `failed` with
     "Your sudo rules don't allow running a shell as root". Sudo cards need sudo rights to run
     `/bin/sh` as root (in practice `ALL`); per-command sudoers rules are not supported.
   - A wrong password in a counts one try; the page says "Wrong password" and the try count; on
     the third the request becomes `failed`. Because the password is written only after a
     prompt, it is never left unread in a pipe.
2. Run: the helper, already root, runs `/bin/sh -c <command>` itself as root, with stdin
   `/dev/null`, `cwd=/`, environment only `PATH=/usr/sbin:/usr/bin:/sbin:/bin`, `HOME=/root`,
   `LANG=C.UTF-8`, in a new process group. The password never reaches this process. The helper
   writes one syslog line per run (user, request id, command, exit code; never the password).
3. Time limit 10 minutes: SIGTERM to the group, SIGKILL 10 seconds later; output notes the timeout.
4. Output: stdout and stderr merged in order, the first 32 KiB and last 32 KiB kept, with a
   `[… N bytes cut …]` line between when longer.
5. State becomes `ran` with exit code and output. The password is dropped right after writing it;
   it is never stored, logged, echoed or included in any response or error.

`-k` on both check calls means sudo neither uses nor updates a cached ticket, so the checks
leave nothing unlocked. The run itself does not go through sudo.

**What "exactly the command shown" covers:** the command text is frozen when the card is posted
and run byte for byte. Files that text runs or reads are not frozen (Decision 18). So:
- `lead.md`: write the actual commands into `command`; never ask to run a script or file the
  agents wrote or can edit.
- **No `~`.** Intake refuses a command in which any word (split as below) starts with `~`, with
  "Write the full path; ~ would mean /root here". `card.js` passes the error to the lead.
- **Editable-file warning.** At intake the helper splits the command with Python's
  `shlex.shlex(command, posix=True, punctuation_chars=True)` (so quoting is removed) and takes
  every word that starts with `/` or `./` (`./` resolved against `/`, the run directory).
  A command that `shlex` can't split (unbalanced quotes) is refused at intake. A path is flagged when the user, with
  their groups, could write it or any directory above it (checked from owner, group and mode
  bits as root; a missing path is checked through its nearest existing parent). Intake returns
  `editable: [path, ...]`; the machine adds it to the card. The thread card and the helper page
  both show, above the command, "An agent could change these files before this runs:" and the
  list. This is a best-effort warning, not a guarantee: paths built at run time (variables,
  globs) are not seen.

**Where to open the page:** on a device other than the agents' machine, such as Collin's phone.
A browser running on the agents' machine as Collin's user holds the password in memory an agent
can read. The page says so in one line under the password box. All paths (`runuser`, `sudo`, `sh`) are absolute and configurable only in
the root-owned config, so tests can point them at shims.

**Logging:** request lines only (method and path), never bodies. Errors never include the body.

**Lifetime:** requests live in memory only. `waiting` requests expire after 1 hour; a helper
restart loses all of them, and status lookups then answer `expired`. Closed requests are kept in
memory for 24 hours so their page and status still answer, then dropped.

### Not in scope

Remembered passwords, passwordless sudo, approving a command for reuse, batching, interactive
commands, an anti-phishing check (Decision 9), running on a machine other than the lead's.

### Validation

```bash
python3 -m unittest discover -s sudo-helper/test      # helper: editable-file flags (user-owned file, user-writable parent, root-owned file not flagged, `~/` and `./`); shims for runuser/sudo; wrong password x3, NOPASSWD shim (command run with stdin /dev/null, cannot read the password), timeout, truncation, cancel vs run race, expiry, no password in logs or responses
                                                      # rendering: command/does/why/output of `</script><script>alert(1)</script>` and `<img src=x onerror=...>` appear as text; page HTML contains no request data
bash sudo-helper/test/install-test.sh                 # installer against a temp root, no real systemctl/tailscale (shims)
bash machine/test/run.sh                              # sudo card registration, refusal without helper, outcome held until card accepted, 409 retried, restart resumes, non-lead refusal
node --test viewer/test/*.test.js                     # hub: card validation, lead-only, idempotent outcomes, unknown request 409, decline states (declined / lost race / unreachable)
npm --prefix viewer run test:browser                  # card renders full command, three controls, outcome states
```

Each suite also asserts that a test password string never appears in any file, log or HTTP
response it can see.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A browser on the agents' own machine, as Collin's user, holds the typed password where an agent can read it | Collin uses the app from his phone or another device; the page warns; isolating a same-user browser is out of reach without a separate desktop account | review-round-1 |
| A hostile agent can edit the thread page to show a lookalike password box and capture the password | Collin's choice (Decision 9) | planning |
| A hostile agent can post its own requests to the intake socket, bypassing the lead-only rule | Each still needs Collin to open it, read it and type his password | planning |
| Anyone on Collin's tailnet who has a request URL can see its command and output | 128-bit id; tailnet is Collin's own devices | planning |
| A hostile agent can tamper with the clone before Collin runs the helper's installer | Installer runs only from the canonical clone, after review; Collin runs it himself | planning |

## Review Rounds

### Round 1 — 2026-11-15

**Lanes:** intent — gpt (claude unavailable); mechanics — gpt; cross-family: no.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Password shares stdin with the command; under NOPASSWD sudo leaves it unread for the command to read | upheld | Decision 14: check with `sudo -l`, run as root with stdin `/dev/null` |
| intent | major | Frozen command text doesn't freeze the files it runs (`sh ~/fix.sh`) | user-decision | Decision 18 |
| mechanics | major | NOPASSWD: wrong password accepted, password left on command stdin | upheld | Same as intent blocking; Decision 14. Wrong password under NOPASSWD passes, as at a terminal (Spec) |
| mechanics | major | Agent fields could inject script into the real helper page | upheld | Decision 17 |
| mechanics | major | No request↔card correlation or restart recovery | upheld | Decision 15 |
| mechanics | major | Outcome can arrive before its spooled card and be lost | upheld | Decision 15 |
| mechanics | major | Decline vs Run race, unreachable machine | upheld | Decision 16 |
| intent | major | A browser on the agents' machine, same user, holds the password | accepted-risk | Spec "Where to open the page"; Accepted Risks |

### Round 2 — 2026-11-15

**Lanes:** intent — claude; mechanics — gpt; cross-family: yes.

**Changed since Round 1:**
- Password check is `sudo -S -k -l <command>` (runs nothing); the helper runs the command itself as root with stdin `/dev/null` (Decision 14).
- `request_id` correlation, machine request file, outcome ordering, new `sudo-outcome` hub route (Decision 15).
- Decline confirmed by the helper; race and unreachable handling; new `declining` and `running` states (Decision 16).
- Helper page rendering contract and strict CSP (Decision 17).
- Editable-file warning; IDEA.md narrowed to the command text (Decision 18).
- "Where to open the page" and its accepted risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | RE-RAISE: `sudo -l` follows `listpw`; one NOPASSWD entry lets any password pass | upheld | Decision 19; the Round 1 rationale "as at a terminal" was wrong |
| intent | major | `~` is Collin's home in the warning, /root at run time | upheld | Decision 20 |
| mechanics | major | Page spec contradicts itself (inline JS/CSS vs CSP); installer omits static files | upheld | Page and Install bullets rewritten |
| mechanics | minor | Quoted paths escape the editable-file scan | upheld | `shlex` split (Decision 20) |
| mechanics | minor | A card can stick in `declining` if the hub restarts mid-call | upheld | 10 s timeout; hub start returns `declining` cards to `waiting` |

Round 2, GPT lane (mechanics), reviewed the text before the intent lane's fixes:

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | `sudo -l` follows `listpw`; NOPASSWD entry lets garbage passwords through | upheld | Already fixed by Decision 19 (`-v`, sentinel, fail closed) |
| mechanics | blocking | Permission check omits `-u root`, run is always root | upheld | `-u root` added to check b |
| mechanics | major | A saved result could be replaced by `expired` before delivery | upheld | Terminal results saved with output; polling stops; never replaced |
| mechanics | major | Card acceptance flag vs spool deletion order | upheld | Save "accepted" before deleting the spool file; duplicate resend is 200 |
| mechanics | minor | Page assets vs CSP contradiction | upheld | Already fixed in the intent lane's triage |

### Round 3 — 2026-11-15

**Lanes:** intent — claude; mechanics — gpt; cross-family: yes.

**Changed since Round 2:**
- Password check: `sudo -k -v` and `sudo -k -l -u root`, sentinel prompts, fail closed (Decision 19).
- `~` refused; `shlex` scan (Decision 20).
- Page assets as static files; installer list.
- `declining` timeout and hub-start recovery.
- Machine durability: saved terminal results, accepted-before-spool-delete.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | `sudo -K` step unneeded and clears Collin's terminal cache | upheld | Dropped |
| intent | minor | Leftover `-k` paragraph implies the run uses sudo | upheld | Rewritten |
| intent | minor | Hub could poll the machine instead of machine durability file | declined | The machine design is reviewed and sound; switching re-opens the whole outcome path for no behavior change |
| intent | minor | Post-restart `declining` note can be false | upheld | Neutral note |
| intent | minor | Check b needs shell-as-root rights; message misstates the reason | upheld | Message and Spec say so |
| intent | minor | Watch List rows left open | upheld | Rows removed: row 1 settled by Decision 5 (password only crosses browser → helper over Tailscale HTTPS); row 2 by Decision 19 and `-k`; row 3 by Decision 19 |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
