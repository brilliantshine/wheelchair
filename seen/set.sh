#!/usr/bin/env bash
# Install Wheelchair's UserPromptSubmit hook into each present harness.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
claude_home=${WHEELCHAIR_CLAUDE_HOME:-"$HOME/.claude"}
codex_home=${WHEELCHAIR_CODEX_HOME:-"$HOME/.codex"}

# Testing seam: when set (including to empty), this replaces PATH detection.
if [[ ${WHEELCHAIR_PRESENT+x} ]]; then
  case ",$WHEELCHAIR_PRESENT," in *,claude,*) claude_present=1 ;; *) claude_present=0 ;; esac
  case ",$WHEELCHAIR_PRESENT," in *,codex,*) codex_present=1 ;; *) codex_present=0 ;; esac
else
  command -v claude >/dev/null 2>&1 && claude_present=1 || claude_present=0
  command -v codex >/dev/null 2>&1 && codex_present=1 || codex_present=0
fi

if (( ! claude_present && ! codex_present )); then
  printf 'seen hook: neither claude nor codex is on this machine; nothing written\n'
  exit 0
fi

present=''
(( claude_present )) && present+=claude,
(( codex_present )) && present+=codex,
exec python3 -I - "$ROOT" "$claude_home" "$codex_home" "$present" <<'PY'
import json
import os
import re
import shlex
import sys
import tempfile
try:
    import tomllib
except ModuleNotFoundError:
    print("seen hook: needs Python 3.11 or newer (tomllib); nothing written", file=sys.stderr)
    sys.exit(1)

# Set each value from the live check in the Spec's Validation section (D43, D49):
# notice when that harness displays a UserPromptSubmit systemMessage, no-notice otherwise.
NOTICE = {"claude": "notice", "codex": "notice"}

ROOT, CLAUDE_HOME, CODEX_HOME, present_arg = sys.argv[1:]
PRESENT = [name for name in present_arg.rstrip(",").split(",") if name]
HOOK_PATH = os.path.join(ROOT, "seen", "hook.sh")

if "WHEELCHAIR_WORDING" in os.environ:
    wording_dir = os.path.dirname(os.path.abspath(os.environ["WHEELCHAIR_WORDING"]))
else:
    wording_dir = os.path.abspath(os.path.join(os.path.expanduser("~"), ".wheelchair"))

problems = []

def problem(message):
    problems.append(f"seen hook: {message}")

def read_bytes(path):
    try:
        with open(path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        return None

def json_document(path):
    raw = read_bytes(path)
    if raw is None:
        return None, {}
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        problem(f"invalid JSON in {path}: {exc}")
        return raw, None
    if not isinstance(value, dict):
        problem(f"JSON root is not an object: {path}")
        return raw, None
    return raw, value

def canonical_group(harness):
    command = f"{shlex.quote(HOOK_PATH)} {harness} {NOTICE[harness]}"
    return {"hooks": [{"type": "command", "command": command, "timeout": 2}]}

def owns_group(group):
    for handler in group["hooks"]:
        if not isinstance(handler, dict) or not isinstance(handler.get("command"), str):
            continue
        try:
            tokens = shlex.split(handler["command"])
        except ValueError:
            continue
        if tokens and tokens[0] == HOOK_PATH:
            return True
    return False

def update_event(document, harness, path):
    hooks = document.get("hooks")
    if hooks is None:
        hooks = {}
        document["hooks"] = hooks
    elif not isinstance(hooks, dict):
        problem(f"hooks is not an object: {path}")
        return
    event = hooks.get("UserPromptSubmit")
    if event is None:
        event = []
        hooks["UserPromptSubmit"] = event
    elif not isinstance(event, list):
        problem(f"hooks.UserPromptSubmit is not a list: {path}")
        return
    for group in event:
        if not isinstance(group, dict):
            problem(f"UserPromptSubmit group is not an object: {path}")
            continue
        if not isinstance(group.get("hooks"), list):
            problem(f"UserPromptSubmit group hooks is not a list: {path}")
    if problems:
        return
    group = canonical_group(harness)
    ours = [index for index, old in enumerate(event) if owns_group(old)]
    if ours:
        event[ours[0]] = group
        for index in reversed(ours[1:]):
            del event[index]
    else:
        event.append(group)

def grant_claude(document, path, enabled):
    permissions = document.get("permissions")
    if permissions is None:
        if enabled:
            permissions = {}
            document["permissions"] = permissions
    elif not isinstance(permissions, dict):
        problem(f"permissions is not an object: {path}")
        return
    if permissions is not None:
        allow = permissions.get("allow")
        if allow is None:
            if enabled:
                allow = []
                permissions["allow"] = allow
        elif not isinstance(allow, list):
            problem(f"permissions.allow is not a list: {path}")
            return
    sandbox = document.get("sandbox")
    if sandbox is None:
        if enabled:
            sandbox = {}
            document["sandbox"] = sandbox
    elif not isinstance(sandbox, dict):
        problem(f"sandbox is not an object: {path}")
        return
    if sandbox is not None:
        filesystem = sandbox.get("filesystem")
        if filesystem is None:
            if enabled:
                filesystem = {}
                sandbox["filesystem"] = filesystem
        elif not isinstance(filesystem, dict):
            problem(f"sandbox.filesystem is not an object: {path}")
            return
        if filesystem is not None:
            allow_write = filesystem.get("allowWrite")
            if allow_write is None:
                if enabled:
                    allow_write = []
                    filesystem["allowWrite"] = allow_write
            elif not isinstance(allow_write, list):
                problem(f"sandbox.filesystem.allowWrite is not a list: {path}")
                return
    if not enabled:
        return
    rule = f"Bash({os.path.join(ROOT, 'seen', 'wording.sh')}:*)"
    if rule not in allow:
        allow.append(rule)
    if wording_dir not in allow_write:
        allow_write.append(wording_dir)

def json_bytes(document):
    return (json.dumps(document, indent=2, ensure_ascii=False) + "\n").encode("utf-8")

TABLE_HEADER = re.compile(r"^\s*\[sandbox_workspace_write\]\s*(?:#.*)?(?:\r?\n)?$")
ANY_TABLE_HEADER = re.compile(r"^\s*\[")
ROOTS_LINE = re.compile(r"^(\s*writable_roots\s*=\s*)(\[[^\r\n]*\])(\s*(?:#.*)?)(\r?\n)?$")

def toml_update(path):
    raw = read_bytes(path)
    if raw is None:
        return b"[sandbox_workspace_write]\nwritable_roots = [" + json.dumps(wording_dir, ensure_ascii=False).encode("utf-8") + b"]\n"
    try:
        text = raw.decode("utf-8")
        parsed = tomllib.loads(text)
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
        problem(f"invalid TOML in {path}: {exc}")
        return None
    table = parsed.get("sandbox_workspace_write")
    if table is not None and not isinstance(table, dict):
        problem(f"sandbox_workspace_write is not a table: {path}")
        return None
    lines = text.splitlines(keepends=True)
    headers = [index for index, line in enumerate(lines) if TABLE_HEADER.match(line)]
    if table is not None and not headers:
        problem(f"sandbox_workspace_write is not a standalone table: {path}")
        return None
    if not headers:
        return (text + "\n[sandbox_workspace_write]\nwritable_roots = " +
                json.dumps([wording_dir], ensure_ascii=False) + "\n").encode("utf-8")
    header = headers[0]
    end = next((index for index in range(header + 1, len(lines)) if ANY_TABLE_HEADER.match(lines[index])), len(lines))
    existing = table.get("writable_roots")
    root_lines = [index for index in range(header + 1, end) if re.match(r"^\s*writable_roots\s*=", lines[index])]
    if existing is None:
        if root_lines:
            problem(f"writable_roots is not a supported one-line array: {path}")
            return None
        lines.insert(header + 1, "writable_roots = " + json.dumps([wording_dir], ensure_ascii=False) + "\n")
        candidate = "".join(lines).encode("utf-8")
    else:
        if not isinstance(existing, list) or not all(isinstance(item, str) for item in existing) or len(root_lines) != 1:
            problem(f"writable_roots is not a supported one-line array: {path}")
            return None
        match = ROOTS_LINE.match(lines[root_lines[0]])
        if not match:
            problem(f"writable_roots is not a supported one-line array: {path}")
            return None
        try:
            line_value = tomllib.loads("writable_roots = " + match.group(2))["writable_roots"]
        except tomllib.TOMLDecodeError:
            problem(f"writable_roots is not a supported one-line array: {path}")
            return None
        if line_value != existing:
            problem(f"writable_roots is not a supported one-line array: {path}")
            return None
        if wording_dir in existing:
            candidate = raw
        else:
            values = existing + [wording_dir]
            newline = match.group(4) or ""
            lines[root_lines[0]] = match.group(1) + json.dumps(values, ensure_ascii=False) + match.group(3) + newline
            candidate = "".join(lines).encode("utf-8")
    try:
        tomllib.loads(candidate.decode("utf-8"))
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
        problem(f"refusing TOML edit that would not parse in {path}: {exc}")
        return None
    return candidate

plans = []
claude_path = os.path.join(CLAUDE_HOME, "settings.json")
codex_hooks_path = os.path.join(CODEX_HOME, "hooks.json")
if "claude" in PRESENT:
    old, document = json_document(claude_path)
    if document is not None:
        update_event(document, "claude", claude_path)
        grant_claude(document, claude_path, NOTICE["claude"] == "notice")
        if not problems:
            plans.append((claude_path, old, json_bytes(document), "claude settings"))
if "codex" in PRESENT:
    old, document = json_document(codex_hooks_path)
    if document is not None:
        update_event(document, "codex", codex_hooks_path)
        if not problems:
            plans.append((codex_hooks_path, old, json_bytes(document), "codex hook"))
    if NOTICE["codex"] == "notice":
        config_path = os.path.join(CODEX_HOME, "config.toml")
        config_old = read_bytes(config_path)
        config_new = toml_update(config_path)
        if config_new is not None and not problems:
            plans.append((config_path, config_old, config_new, "codex config"))

if problems:
    for message in problems:
        print(message, file=sys.stderr)
    sys.exit(1)

changed = [(path, old, new, kind) for path, old, new, kind in plans if old != new]
grant_due = ("claude" in PRESENT and NOTICE["claude"] == "notice") or ("codex" in PRESENT and NOTICE["codex"] == "notice")
if grant_due:
    os.makedirs(wording_dir, exist_ok=True)

for path, old, new, kind in changed:
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".wheelchair-seen.", dir=directory)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(new)
        # mkstemp creates 0600; keep the file's existing mode, or the usual 0644 for a new one.
        try:
            mode = os.stat(path).st_mode & 0o777
        except FileNotFoundError:
            mode = 0o644
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise

if any(kind == "codex hook" for _, _, _, kind in changed):
    print("run /hooks in Codex once to approve the wheelchair hook")
for path, _, _, _ in changed:
    print(f"seen hook: updated {path}")
PY
