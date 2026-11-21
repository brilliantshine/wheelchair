# wheelchair

Agents are good at writing code and bad at being held to a plan. This harness holds them to one.
You talk to a lead agent in a thread, in a browser or on a phone. It maps how the code works,
agrees what good looks like, and plans one question at a time. Fresh reviewers, from a
**different model family** when one is signed in, then try to tear the plan apart. Workers build it, and a blind verifier tries to prove the result
wrong.

The documents are the state, not a context window. Each feature gets a directory holding the map,
the idea, the decision log, the spec, every review round, and what got built. You can stop
mid-plan and resume a week later.

The reporting is held to the same standard as the work. Leads write in the style you set, and
draw a picture when the answer has a shape, as readily as you set in Settings.

## Using the app

### First time

1. Install the [basic tools](#dependencies) on the machine that will run the agents
   (Linux with systemd or macOS with launchd; on Windows, see "On Windows"). Sign in to
   GitHub CLI and Tailscale.
2. Run `./install.sh --serve` (see "Install"). Accept the offered Tailscale commands to
   publish the app on your tailnet.
3. Open the link printed by the installer on each device. It carries a token that signs
   the browser in. `node viewer/server.js --rotate-token` signs every device out.
4. Follow the home page checklist to install and sign in to an agent from Settings.
   Settings also holds your models, diagram preference, writing style and project folder.

### On macOS

1. Install the Xcode command line tools for git and python3: open Terminal and run
   `xcode-select --install`. Install [Homebrew](https://brew.sh/), then run
   `brew install node tmux gh`. Install the [Tailscale Mac app](https://tailscale.com/download/mac)
   and sign in to it and `gh`.
2. Clone this repository, open its folder in Terminal, and run `./install.sh --serve`.
   A Mac does not serve by default without the flag. The installer finds the Tailscale CLI
   inside `/Applications/Tailscale.app` if it is not on PATH. Accept its offered Tailscale
   mappings, then follow the remaining "First time" steps above.
3. The launchd services run only while you are logged in. To bring them back after a
   restart, log in, or turn on automatic login in System Settings → Users & Groups. To
   keep the Mac awake, run `sudo pmset -a sleep 0 disksleep 0`, or use System Settings →
   Energy, "Prevent automatic sleeping".

The service files are `~/Library/LaunchAgents/com.wheelchair.viewer.plist` and
`~/Library/LaunchAgents/com.wheelchair.machine.plist`. Logs are
`~/Library/Logs/wheelchair/viewer.log` and `~/Library/Logs/wheelchair/machine.log`.
Sudo cards do not work on a Mac. A second Claude account may share the first account's
login; check both accounts using the [Mac checklist](docs/plans/macos-support/MAC-CHECKLIST.md).

### On Windows

Run it inside WSL2, which is a real Linux system, so the steps above apply unchanged. This
route is untested. Docker is a poor fit: the agents need your real repos and sign-ins, and
the sudo helper is meant to act on your machine, not on a container.

1. In an administrator PowerShell, run `wsl --install` (Ubuntu) or
   `wsl --install -d Debian`, then restart Windows.
2. Turn on systemd: put this in `/etc/wsl.conf`, then run `wsl --shutdown` from Windows.
   ```
   [boot]
   systemd=true
   ```
3. Inside WSL, install the [dependencies](#dependencies) and sign in to `gh`. Install Tailscale inside WSL, since the installer runs `tailscale serve` there,
   and quit it on Windows: Tailscale traffic breaks when both run at once.
4. Clone wheelchair and your projects under the Linux home folder (`~/...`), never under
   `/mnt/c`. Windows drives are slow from WSL, and git and file permissions misbehave there.
5. Follow "First time" above.

WSL shuts down an idle distribution after 15 seconds, which stops the app and every agent
session. Turn that off in `%UserProfile%\.wslconfig`, then run `wsl --shutdown`:
```
[general]
instanceIdleTimeout=-1
```

### Doing a piece of work

1. **+ New thread**. Pick the machine and the project (a git repository with an `origin`
   remote the machine can fetch; threads branch from its default branch). Save ones you
   use often under "Saved directories"). Type what you want and press **Start**.
2. The lead answers in the thread. Each thread gets its own git worktree and branch, and
   ends in one pull request.
   - **A small fix** (a couple of files): the lead makes it, has it checked, and opens the
     pull request.
   - **Anything bigger**: it offers "Take it into planning?". Press it, or **Keep talking
     first**.
3. **Planning.** The lead maps the code, writes up your idea (**Your idea so far**, each
   bullet removable), asks you to confirm IDEA.md, then asks design questions one card at
   a time. Each question shows the lead's leaning; press an option or type your own answer
   under it. MAP.md, IDEA.md and PLAN.md open from the thread.
4. **Review.** Fresh reviewers that never saw the conversation try to break the plan. With
   **Both families** set there are two, one per family when both have an account free;
   otherwise they share one. You only see the progress line, and a question if a real
   choice comes up.
5. **Approval.** The approval card lists any serious objection the lead overruled, with
   its reason (**Talk about this** to discuss one), and the Ready check: the machine is
   up and on the same version, and the logins work. Press **Start building**.
6. **Building.** A sub-lead runs workers in parallel and a verifier checks the result.
   The progress line shows tasks done.
7. **Done.** The done card says what you can do now, what was left out (each with
   **Start a thread about it**), and links the pull request. You merge it; the lead never
   does. Report a problem in the same thread while the pull request is open and the lead
   fixes it there.

### Handing off a thread

At a quiet stopping point, export a thread after the idea is confirmed and mapping is
finished, after the plan is approved, or when the work is done. Export pushes the branch
to GitHub and downloads a file with the stage and a readable history. The file does not
contain code, live cards or sessions; committed code and plan documents travel on the
GitHub branch.

On the new-thread screen, choose **Import a handoff**, a machine and project, and the
file. Import never creates a duplicate: an existing thread is opened if it is as new or
newer, advanced if the file is newer, and left unchanged if the two have diverged. The
original is marked handed off and frozen; you can download the file again, or undo the
handoff if nobody has picked it up.

Import and Undo push an empty claim commit to the branch to show who holds the work. If
you take the branch by hand without wheelchair, please push an empty commit named
`handoff: picked up <time>` too.

### Finding your way

- **Needs you** (top bar): open questions, approvals and other cards waiting on you,
  across threads. The "Take it into planning?" offer and root (`sudo`) requests show only in
  their thread. Cards are what the lead waits on; plain replies are updates.
- **Asides**: select text in a lead's message and pick **Ask about this**, **Say it
  simpler** or **Draw it**, or press **Ask about this message**. It opens a side
  conversation. **This changes my answer** drafts what you settled; edit it and press
  **Send** to pass it to the lead. **Done, back to …** closes the aside with nothing sent.
- **Pictures**: the thread's right column lists every picture; **Open full size** shows
  one on its own page.
- **Features**: every feature by stage, plus your projects and machines.
- **Agents**: every running session; each opens in a browser terminal.
- **Restart lead** appears if a thread's lead dies; the new one picks up from the plan
  files. **Archive** stops a thread's sessions and hides it.

### What a feature leaves behind

Each feature lives in `docs/plans/<slug>/` in the project:

| File | What it is |
|---|---|
| `MAP.md` | How the code works today, every claim with `file:line`, plus what wasn't checked |
| `IDEA.md` | The plain-language goal and non-goals, confirmed before any design question |
| `PLAN.md` | Question queue, decision log, spec, review rounds, implementation tasks |
| `graphs/` | Pictures drawn while planning |
| `COMPLETION.md`, `REMEDIATION-N.md` | What got built, with evidence, and each verification loop |

`status:` in `PLAN.md` is the state machine: `planning → ready-for-review → approved →
implementing → verifying → done`.

### Project MCP tools

Put project tools in `.mcp.json` at the repository root in Claude Code's format, committed on the branch threads start from. Leads, sub-leads, workers and verifiers get them; reviewers and the mapper do not. Codex sees each server as `project_<name>`, so project instructions naming a tool should give both names.

On Codex, project tools are pre-approved, so agents can call them without an approval prompt.

**Codex headers.** A header `Authorization: Bearer ${NAME}` takes its token from the variable `NAME`. A header whose whole value is `${NAME}` takes it from that variable. A literal header is passed as written. Codex skips a server that is sse, that has the same header twice, that uses any other `${...}` form, or whose name uses anything but letters, digits, `_` and `-`. An `env` value exactly equal to `${KEY}` for that key passes through.

**Antigravity.** It now gets project tools through a private file made for each agent and deleted when the agent ends. Its `${...}` limit: only a stdio `env` entry `KEY: ${KEY}` passes through. Any other server with `${...}` in it is skipped. Antigravity also skips sse servers, names that use anything but letters, digits, `_` and `-`, and a header given twice.

**Missing programs.** A stdio server whose program cannot be found is reported.

**Where you see problems.** A "Project tools problem" card appears in the thread and lists each tool that was skipped or is broken. It closes itself after a start with no problems. `wc.js session list` shows `project_tools.problems` on the lead's entry.

Whether a tool actually connects is not tested yet; that is a follow-up.

## Pictures

![The viewer: an explanation panel above a flow](docs/viewer.png)

Once a thread is planning a feature, the lead draws each flow it proposes and shows it in
the thread. Other answers get a picture as readily as the Diagrams setting says (ask, default
or high). "Open full size" opens the picture on its own page, with a link back to the thread. The
panel above the picture says what it shows and what it leaves out. You can drag boxes to
rearrange the flow.

## Install

```bash
./install.sh
```

This installs the viewer's dependencies, including Chromium and Firefox for its tests. It
also removes the skill and prompt wrappers and the per-turn hook that earlier versions put in
the harness homes. It is idempotent. Re-run it after pulling a change under `viewer/`.

It also writes a few things outside this repo:
- a delimited block in `~/.claude/CLAUDE.md` and/or `~/.codex/AGENTS.md`, which holds the
  diagram-sensitivity setting
- `~/.wheelchair/models`: the GPT model pinned per tier
- `~/.local/state/wheelchair/`: the app's threads, settings, machine registry and the
  machine service's secret
- on a serving systemd machine, the `wheelchair-viewer` and `wheelchair-machine` user
  services, in `~/.config/systemd/user/`; on a serving Mac, launchd services in
  `~/Library/LaunchAgents/`

Only the delimited block is this repo's, so nothing else in those files is touched.

A heads-up line appears before a GPT session runs when Codex knows a newer model than a tier's
pin. `codex/model.sh set <tier> <model>` switches; nothing switches on its own.

## The viewer

A Node server with no runtime dependencies beyond the fonts it serves, bound to `127.0.0.1`. It serves the graphs, a list of
graphs and plans, and a document reader. By hand:

```bash
node viewer/server.js --show path/to/graph.json   # open a graph in the browser
node viewer/server.js --url                       # print the bookmark address
node viewer/server.js --stop
```

A machine can serve the viewer to your other devices over Tailscale: run `./install.sh --serve`,
or `--no-serve` to decline. This runs it as an always-on `systemd` user service on Linux, or a
launchd user service while logged in on macOS, from this checkout's code, at
`https://<machine>.<tailnet>.ts.net/wheelchair/`, which opens the app. Open the bookmark once per
device and it's remembered. `node viewer/server.js --rotate-token` locks every device out again. Everything, including
dragging boxes, works on a phone.

A serving machine is also the hub for the app at `/wheelchair/app/`: threads with a lead
agent, from idea through planning, review, building and checking, driven from a browser or
phone. Each thread's agents run in tmux sessions, started by the machine service (`machine/`).
The Features and Agents pages, and a browser terminal, open into any session.

`protocol/graphs.md` has the full format.

## Layout

| Directory | What's there |
|---|---|
| `protocol/` | The rules every stage follows. The single source of truth |
| `viewer/` | The graph viewer and the app's hub: server, pages, tests |
| `machine/` | The machine service that runs agent sessions in tmux for the app |
| `sensitivity/`, `install/`, `codex/` | The dial writer, the installer's checks, the GPT model pins, and their test suites |
| `docs/plans/` | One directory per feature: its map, idea, plan and reports. The app's own state lives in `~/.local/state/wheelchair/` |

Every directory that owns a rule has an `AGENTS.md` router saying what it owns and where to go
next. Start at the root one. `CONTRIBUTING.md` has the conventions and validation commands.

## Dependencies

- Claude Code, Codex, Antigravity, Kimi Code and Pi (OpenRouter) are optional harnesses,
  installable from Settings → Harnesses. Multiple harnesses let reviews and checks use another family.
- `tmux`, which runs every agent session.
- `git` and the GitHub CLI `gh`, signed in, so threads can push branches and open pull
  requests.
- Tailscale, to reach the app from other devices.
- Node 20 or newer and npm, for the viewer.
- Python 3 and curl, for installation.
- Playwright, pinned in `viewer/package.json` and installed by `install.sh`, for the browser tests.
