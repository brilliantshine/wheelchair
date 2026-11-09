# Wheelchair as an app on a server

Nov 9, 2026 · Collin Zhong

## What we're building

Wheelchair becomes an app that runs on one of Collin's servers instead of inside whatever terminal he happens to be in. One server is the hub: it runs the app and the lead agents. Other servers are worker nodes that run the agents doing the building.

Every agent is a full, interactive Claude or Codex session in its own tmux window, so any thread can be opened and read directly. Collin talks to a lead in a chat thread in the browser, from any device on the tailnet, and the lead carries ideas through mapping, planning, review, building and checking with as little of his attention as possible.

## Why: the problem

Today wheelchair is driven by typing slash commands into a terminal session, and the work only lives as long as that session does. Collin is often away at school and reaches his machines remotely, so checking in means attaching to tmux over SSH or Parsec and reading raw output.

- Workers run headless (`codex exec`, `claude -p`), so their threads can't be opened and read while they work.
- Collin now has several servers, but a run only uses the machine it was started on.
- The workflow reports every step: review round counts, per-round summaries, worker progress. Most of it doesn't help him decide anything.
- The rules that rewrite agent messages to be easier to read haven't reduced how often he has to ask for clarification.
- The graphs help for some questions but get cluttered, and complex questions still take a long time to understand.
- There's no simple way to hand an agent a screenshot from another device.

## What good looks like

- From a phone or laptop on the tailnet, Collin opens one address and sees three views: **Features** (each feature by stage, with a Needs you strip), **Threads** (chats with leads), and **Sessions** (every tmux session on every node).
- He describes what he wants in plain words. No slash commands. A small fix just gets done; something bigger gets one "Take it into planning?" offer.
- He only hears from the workflow when it needs a decision from him, or when a feature is approved or done.
- He can open any agent's live terminal in the browser, type into it, or `tmux attach` to it from a terminal.
- Restarting or updating the app doesn't stop any running agent.
- Complicated answers arrive as a picture whose form fits the question, inside the thread.
- He can paste or drop a screenshot into a thread and the agent can see it.
- All of it works on a phone.

## Decisions made so far

Settled while designing the screens on 2026-11-09. Planning should treat these as decided unless review finds a real problem.

| Area | Decision |
| --- | --- |
| Where it runs | One hub server runs the app and the leads. Other servers are worker nodes. The app grows out of the existing viewer server. |
| Sessions | Every agent, workers included, is a full interactive Claude or Codex session in its own tmux window. Headless `exec` and `-p` are retired. Sessions outlive the app. |
| Terminal use | Slash commands keep working in a terminal. The app is a second way in, not the only one. |
| Projects | The hub holds every project; the app lists the repos it has cloned. |
| Threads | A thread is a lead session in tmux, shown as chat. Collin picks the project, whether the lead is Claude or Codex, and the node. |
| Starting work | No slash commands in the app. The lead does small fixes directly (same "small patch" rule implementation already uses). When something looks like a feature, it offers "Take it into planning?" once. |
| Ideation | If Collin keeps talking instead of answering, the offer pins to the top of the thread and is never asked again. It collects "Your idea so far": bullets close to his own words, each removable. Side questions are left out. Collection starts when the lead decides it's a feature. More than 3 bullets fold to the newest 2. The lead may suggest splitting into two features. |
| Mapping | Starts in the background as soon as the offer pins. Maps are kept per project and reused; an area whose code changed is re-checked before it's trusted. |
| Planning | One question at a time, as cards in the thread with options and a "leaning" pick. Map, Idea and Plan documents are always one click away. |
| Plan review | Silent. No round counts or summaries. The lead decides when the plan is done. If objections keep coming back, the lead works out why: a choice for Collin (ask him), a vague part (rewrite it), or a repeat (reject with a reason). A hidden budget turns a review that won't settle into a Needs you item. |
| Approval | A "Plan approved, N objections" card lists every serious objection the lead disagreed with and why, each with "Talk about this". Building starts only when Collin presses Start building. |
| Before building | The lead checks logins and installs on the nodes it will use and shows "Ready" or exactly what's missing. |
| Building | Start building hands the plan to a sub-lead session, leaving the lead free. The sub-lead talks to the lead, not to Collin; the lead answers or passes questions on. A worker that hits something the plan didn't settle asks the lead first (leaning answer to the open question below). |
| Worker done signal | A worker's own end-of-turn hook (Claude Code's Stop hook, Codex's notify setting) tells the hub, and its report goes in a file the lead reads. |
| During a build | One slim pinned line: progress, which nodes, and an amber "choice for you" when needed. A new idea started meanwhile pins below it as its own feature. |
| Verifying | Silent, like review. If the same gap survives two fix attempts, it comes to Collin as a plan question. |
| Done | A "Built and checked" card: what he can do now, what was left as is (each with "Start a thread about it"), and Review pull request. Sub-lead and worker sessions close; the thread stays. |
| Communication | The writing rules, the SEEN.md record and the per-turn wording hook are dropped for the first version. |
| Diagrams | The lead picks the form that fits the question: timeline, before and after, layers, side by side, or boxes and arrows. Each form is a data format the app draws. Hand-written HTML in a sandbox only when no format fits. Boxes-and-arrows graphs stay for proposals Collin approves or strikes. |
| Uploads | Paste, drop or attach files in a thread. The file is stored on the node where that thread's session runs, so the agent can open it. |

## Not doing in the first version

- Moving a running worker to another node when its node sleeps. It was used as the example feature on the screens, but it's its own later feature.
- Merging finished work automatically. A feature ends in a pull request Collin reviews.
- The communication rules (writing rules, SEEN.md, wording list, gap notice).
- Showing review or verification rounds, step counts or per-round summaries.
- Slash commands inside the app.

## Constraints

- Works with either `claude` or `codex` alone; both unlock cross-family review, as today.
- Reachable only over Tailscale, as the remote viewer is today.
- Usable on a phone.
- Runs on Debian on the hub; Node is already required for the viewer.
- Uses each CLI's own login on each node. No new accounts.

## Open questions for planning

- [ ] When a worker gets stuck, who does it ask? Leaning: the lead, which passes on only what it can't answer. Not yet confirmed.
- [ ] How Collin reaches the app from a device that isn't on the tailnet, if at all.
- [ ] What the app shows when a node is asleep or offline.
- [ ] Where an uploaded file is kept and for how long.
- [ ] Exact size of the hidden review budget, and what "serious" means for an objection the lead must report.
- [ ] The data format for each diagram form.

## Screen designs

The screens behind these decisions are on the Wheelchair App design canvas:
https://claude.ai/artifact/RRWYSCz681JTHiRCD8dkwo (private until shared).

A copy of each screen's source is in [`design/`](design/). Those files are Design canvas artboards: they render on the canvas, not as plain web pages.

## Bringing this into the workflow

1. Run `/adopt docs/proposals/app-shell/proposal.md`. Adoption turns it into IDEA.md and PLAN.md under `docs/plans/<slug>/` (it picks the slug and tells you which), with the decisions above in the decision log.
2. Run `/plan <slug>` to map the code and work through the open questions.
