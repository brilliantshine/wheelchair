# Pi dry-run samples (2026-11-20, Pi 1.5.2, tmux 3.5a)

Nothing here holds a real key. `sk-or-v1-0000synthetic0000` is a made-up key used only to see how the sign-in screens show typed text.

- `pi-session-01ea710b-….jsonl` — one session: a completed turn with a tool call (`bash ls`), then two aborted turns (Escape after a few seconds of streaming, and Escape 0.3 s after sending). Model `openrouter/auto`.
- `pi-session-bec8ab55-….jsonl` — a failed turn: model `nosuchvendor/nosuchmodel`, assistant entry with `stopReason: "error"` and OpenRouter's 400 message.
- `dry-run-extension.js` — the logging extension used (`-e`); `dry-run-events-*.jsonl` — what it saw for each event (entry tails, `aborted`).
- `screens/` — `capture-pane -p -J` text of each screen: TUI `/login openrouter` (`login-*`), the one-shot `pi auth login openrouter --api-key` (`auth-login-*`), and the agent panes (`agent-agent.txt`: completed + aborted; `agent-bad.txt`: failed).

Scratch paths are replaced with `/scratch` or `<scratch path>`.
