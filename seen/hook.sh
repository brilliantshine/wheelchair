#!/usr/bin/env bash
# The hook is intentionally a small Python program: fcntl is available on macOS where
# the flock command is not, and Python gives us dependable JSON and atomic replacement.
# Preserve the harness payload before the heredoc becomes Python's standard input.  Python
# reads its source from stdin (the requested shim style) and the payload from descriptor 3.
exec 3<&0
SEEN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" exec python3 - "$@" <<'PY'
import datetime as dt
import fcntl
import json
import os
import re
import sys
import tempfile

GAP_HOURS = 4  # stated once in protocol/seen.md as "gap-threshold: 4h"
MAX_CONTEXT_CHARS = 2000
ENTRY = re.compile(r'^- (\d{4}-\d{2}-\d{2}) — "([^"\n]+)" — (.+)$')


def atomic_write(path, text):
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".wheelchair.", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise


def confirmed(path):
    try:
        with open(path, encoding="utf-8") as handle:
            lines = handle.read().splitlines()
    except (OSError, UnicodeError):
        return []
    try:
        start = lines.index("## Confirmed") + 1
    except ValueError:
        return []
    section = []
    for line in lines[start:]:
        if line.startswith("## "):
            break
        if line.startswith("- ") and ENTRY.match(line):
            section.append(line)
    return section


def parse_entries(lines):
    result = []
    for index, line in enumerate(lines):
        match = ENTRY.match(line)
        if not match:
            return None
        result.append((match.group(1), match.group(2), match.group(3), index))
    return result


def stored_lines(path):
    try:
        with open(path, encoding="utf-8") as handle:
            lines = handle.read().splitlines()
    except FileNotFoundError:
        return "absent", []
    except (OSError, UnicodeError):
        return "bad", []
    return ("ok", lines) if parse_entries(lines) is not None else ("bad", [])


def notice_for(old, new):
    old_entries = parse_entries(old) or []
    new_entries = parse_entries(new) or []
    old_keys = {phrase.strip().casefold() for _, phrase, _, _ in old_entries}
    new_keys = {phrase.strip().casefold() for _, phrase, _, _ in new_entries}
    additions = [phrase for _, phrase, _, _ in new_entries if phrase.strip().casefold() not in old_keys]
    removals = [phrase for _, phrase, _, _ in old_entries if phrase.strip().casefold() not in new_keys]
    items = [f'added "{phrase}"' for phrase in additions]
    items.extend(f'removed "{phrase}"' for phrase in removals)
    prefix = "wheelchair: wording list"
    if not items:
        return prefix
    chosen = []
    for item in items:
        candidate = prefix + " — " + "; ".join(chosen + [item])
        remaining = len(items) - len(chosen) - 1
        if remaining:
            candidate += f"; and {remaining} more"
        if len(candidate) <= 160:
            chosen.append(item)
        else:
            break
    remaining = len(items) - len(chosen)
    suffix = f"; and {remaining} more" if remaining else ""
    return prefix + " — " + "; ".join(chosen) + suffix


def session_gap(state, session_id, now):
    if not session_id or "/" in session_id or session_id.startswith("."):
        return None
    path = os.path.join(state, "sessions", session_id)
    old = None
    try:
        with open(path, encoding="utf-8") as handle:
            value = handle.read().strip()
        old = dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    except (OSError, UnicodeError, ValueError):
        old = None
    atomic_write(path, now.strftime("%Y-%m-%dT%H:%M:%SZ"))
    if old is None:
        return None
    hours = int((now - old).total_seconds() // 3600)
    return hours if hours >= GAP_HOURS else None


def context_text(gap, lines, wording_script):
    parts = []
    if gap is not None:
        parts.append(f"wheelchair — this session's last message from the reader was {gap} hours ago.")
    entries = parse_entries(lines) or []
    entries.sort(key=lambda item: (item[0], item[3]), reverse=True)
    if not entries:
        return "\n".join(parts)
    header = f'wheelchair — wording the reader has asked for (edit with {wording_script} remove "<phrase>"):'
    fixed = parts + [header]
    rendered = [f'- "{phrase}" — {instead}' for _, phrase, instead, _ in entries]
    for keep in range(len(rendered), -1, -1):
        body = fixed + rendered[:keep]
        omitted = len(rendered) - keep
        if omitted:
            body.append(f"- … {omitted} older entries left out")
        value = "\n".join(body)
        if len(value) <= MAX_CONTEXT_CHARS:
            return value
    # The script path is normally short.  This fallback keeps the advertised hard cap even
    # for an exceptionally long installation path.
    return "\n".join(parts)[:MAX_CONTEXT_CHARS]


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("claude", "codex") or sys.argv[2] not in ("notice", "no-notice"):
        return
    if os.environ.get("WHEELCHAIR_LANE"):
        return
    try:
        with os.fdopen(3, encoding="utf-8") as payload_input:
            payload = json.load(payload_input)
    except (json.JSONDecodeError, OSError, UnicodeError):
        return
    if not isinstance(payload, dict) or "agent_id" in payload:
        return
    wording = os.environ.get("WHEELCHAIR_WORDING") or os.path.expanduser("~/.wheelchair/wording.md")
    state = os.environ.get("WHEELCHAIR_STATE") or os.path.expanduser("~/.cache/wheelchair")
    lines = confirmed(wording)
    os.makedirs(state, exist_ok=True)
    lock_path = os.path.join(state, ".lock")
    notice = None
    with open(lock_path, "a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        last = os.path.join(state, "confirmed.last")
        state_of_last, old_lines = stored_lines(last)
        if state_of_last == "absent":
            atomic_write(last, "\n".join(lines) + ("\n" if lines else ""))
        elif state_of_last == "ok" and old_lines != lines and sys.argv[2] == "notice":
            notice = notice_for(old_lines, lines)
            atomic_write(last, "\n".join(lines) + ("\n" if lines else ""))
    session_id = payload.get("session_id")
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    gap = session_gap(state, session_id, now) if isinstance(session_id, str) else None
    text = context_text(gap, lines, os.path.join(os.environ.get("SEEN_DIR", ""), "wording.sh"))
    if not text and not notice:
        return
    result = {}
    if text:
        result["hookSpecificOutput"] = {"hookEventName": "UserPromptSubmit", "additionalContext": text}
    if notice:
        result["systemMessage"] = notice
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


try:
    main()
except BaseException:
    # A hook failure must look exactly like no hook output.
    pass
PY
