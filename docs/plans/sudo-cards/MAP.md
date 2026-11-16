# Map: sudo cards

The current path and its security boundary are mapped in [app-cards-security](../../maps/app-cards-security.md), checked against `908b2bfd288550660416b4cc60339e71a3199b96`.

```text
agent -> card file -> machine spool -> hub thread state -> browser card
browser press -> hub saved answer and queue -> machine tmux -> agent
```

The card request itself is durably spooled and stored (`machine/service.js:1011-1025`; `viewer/app/cards.js:38-48,79-80`; `viewer/app/state.js:122-130`). A normal press value is saved, queued and typed to the lead (`viewer/app/threads.js:271-293`; `viewer/app/sessions.js:297-308,317-349`), so a password cannot use that path. Browser terminal input goes into the agent's tmux pane (`viewer/pages/terminal.js:72-80,101-103`; `viewer/app/routes.js:464-480`; `machine/service.js:1003-1009`), and the permission card only reports a prompt (`viewer/app/sessions.js:399-420`).

The viewer is loopback HTTP, optionally served via Tailscale HTTPS, while hub-to-machine calls are HTTP to the configured host (`viewer/server.js:2196-2199`; `install.sh:135-157,284-287`; `viewer/app/machine-client.js:59-71`). Both user services and their agent tmux sessions normally run as the installing user (`install.sh:306-318,327-345`; `machine/service.js:445-451`); mode 0600 does not isolate the machine secret from a same-user agent (`install.sh:146-158`). A secret held by an ordinary same-user process cannot be assumed invisible to agents merely because it is absent from their environment; effective `/proc` and memory access depend on OS and sandbox settings.

## What I did not look at

Actual process credentials and kernel or sandbox access controls on the target machine; sudo configuration; browser, proxy, system and crash logging; swap and dumps. The linked map lists further limits.
