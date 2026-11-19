# Router

## Purpose
Run the per-machine service that controls agent sessions and worktrees.

## Directories
- adapters/ — provider-specific CLI commands, hooks, and usage interpretation
- lib/ — session screens, project tools, usage, sudo requests, and event delivery
- test/ — isolated machine-service fixtures and checks

## Important Files
- service.js — HTTP API, session registry, tmux boundary, git, worktrees, and durable spools
- hook.sh — converts CLI hook payloads into machine events
- statusline.sh — Claude status and usage delivery entry point
- API.md — authenticated machine and agent route contracts
- AGENTS.md — service ownership and authorization boundaries
