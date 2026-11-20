# Map: cards, transport and machine boundary

Checked against: `908b2bfd288550660416b4cc60339e71a3199b96` (origin/main)
Files covered: `viewer/app/card.js`, `viewer/app/cards.js`, `viewer/app/chat.js`, `viewer/app/threads.js`, `viewer/app/sessions.js`, `viewer/app/routes.js`, `viewer/app/state.js`, `viewer/app/machine-client.js`, `viewer/app/API.md`, `viewer/pages/thread.js`, `viewer/pages/terminal.js`, `viewer/server.js`, `viewer/signin.html`, `machine/service.js`, `machine/API.md`, `machine/adapters/codex.js`, `install.sh`

> Lead-chat paths rechecked against `1ee9ad1487d2a3f8b6ceda7f73cf7218657f52c2`; see [lead-chat/MAP.md](../plans/lead-chat/MAP.md). Other claims retain their historical checked commit.

> Historical map: covered files changed since the checked-against commit. The launch, ledger, hooks and approval paths relevant to startup growth were rechecked in `docs/plans/startup-growth-warning/MAP.md` against `c81c022e30a5d3fa11aaf2ed9fbe28b903eab011`; other parts below have not been revalidated for that commit.

## Flow

```text
agent JSON file -> card CLI -> machine card spool -> authenticated hub -> thread JSON
thread chat poll -> browser card -> press -> hub queue -> machine tmux -> lead
browser -> viewer HTTP locally or Tailscale HTTPS -> hub -> machine HTTP
```

1. `card.js` reads a JSON file, checks the kind and fields, and posts with the session token to the machine origin (`viewer/app/card.js:119-141,158-200`). The machine authenticates the session, adds its name and thread, writes a delivery-id spool file before forwarding, retries outages, deletes on success and retains rejected files while logging the reason (`machine/service.js:295-312,682-701,709-735,1011-1031`). The machine's card and event API contract is `machine/API.md:27-36`.
2. The hub checks the machine secret and session role and validates again; it deduplicates, assigns card id/time, adds the card to the thread and saves atomically (`viewer/app/routes.js:339-344`; `viewer/app/cards.js:11-28,38-48,79-80,101-116`; `viewer/app/state.js:21-29,122-130`). Thread JSON and sent history default to the user's state directory, with 0700 directories and 0600 files (`viewer/app/state.js:9,21-29,41-47,66-68,91-104`). `/chat` exposes cards, and the page polls and renders by kind (`viewer/app/API.md:12`; `viewer/pages/thread.js:456-462,502-528,801-810`).
3. A button posts `{action,value}` (`viewer/pages/thread.js:81-88,341-347`); the route calls `press` (`viewer/app/routes.js:435-436`). Ordinary presses save `answered_value`, interpolate it into a message to the live lead and enqueue it (`viewer/app/threads.js:241-244,271-293`); the queue is persisted, submitted to tmux when ready and idle, then saved in sent history (`viewer/app/sessions.js:297-314,317-349`; `machine/service.js:1003-1009`). A password placed in a normal press value would therefore be stored and delivered to an agent. `viewer/app/API.md:21,50-53` describes the public card state.

## Transport and identity

The viewer listens on loopback HTTP (`viewer/server.js:2196-2199,2221-2223`); optional Tailscale Serve maps HTTPS to that local HTTP endpoint (`install.sh:265-287`; `viewer/server.js:2042-2051`). First visit accepts a URL token, redirects without it, and sets a derived HttpOnly, Secure, SameSite=Lax cookie; absent or invalid credentials receive the sign-in page (`viewer/server.js:1375-1393,1896-1916`). API reads accept cookie or URL token, writes cookie or token header plus matching origin; machine callbacks instead use a machine secret (`viewer/server.js:1416-1427,2254-2261`).

The hub constructs `http://` machine URLs and sends the machine secret header (`viewer/app/machine-client.js:53-71`); the machine server itself is HTTP (`machine/service.js:1039-1042`). Installer selects a Tailscale IPv4 address when available, otherwise loopback, and configures local machine-to-hub HTTP; a configured callback URL can select HTTP or HTTPS (`install.sh:135-157`; `machine/service.js:126-138,248-254`). Tailscale transport applies only when traffic actually traverses it; HTTP itself supplies no TLS. The HTTP handlers accumulate JSON in memory (`machine/service.js:111-118`; `viewer/app/routes.js:13-21`); card spool and thread persistence are explicit above. Machine errors go to stderr and rejected spool reasons are logged (`machine/service.js:295,696-701,1037`); external proxy, browser and system logging were not audited.

Installer creates both units under the invoking user's systemd user manager, with no user switch, and the machine starts tmux via that user's scope or directly (`install.sh:25-26,306-318,327-345`; `machine/service.js:437-451`). Thus these processes normally share the installer's Unix identity, not a separate privileged service account. The secret and state are mode 0600/0700, protecting against other users but not same-UID processes (`install.sh:146-164`); session records include tokens (`machine/service.js:439-445,453-454`; `machine/service.js:294`). The secret is not placed in the session environment, but that is not a same-user access boundary (`machine/API.md:4-6`). Codex can run with workspace-write, read-only reviewer, or unrestricted mode (`machine/adapters/codex.js:31`). Same-UID `/proc` and process-memory access depend on kernel settings, dumpability and sandbox restrictions; no code here establishes a separate UID boundary. Exact effective access was not tested.

## Existing human-operated paths

A permission event opens a system needs card and holds delivery until cleared; it does not execute the requested command itself (`viewer/app/sessions.js:399-420`). The browser terminal sends each key through the hub to a managed session's tmux and polls its pane (`viewer/pages/terminal.js:72-80,94-103,109-118`; `viewer/app/routes.js:453-480`; `machine/service.js:1003-1009`). It targets the agent pane, so it is not a confidential password channel to an independent executor. Installer separately offers and runs `sudo tailscale` interactively (`install.sh:265-287`).

## What I did not look at

Kernel ptrace, `/proc` mount and sandbox policy on every deployment; actual running process credentials; browser extensions, swap, crash dumps, external proxies and their logs; sudo configuration and authentication caching; all unrelated card kinds and all tests. Earlier overlapping maps were compared with origin/main and had changed covered files; they were not reused as current evidence.
