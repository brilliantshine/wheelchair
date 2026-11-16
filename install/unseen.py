#!/usr/bin/env python3
"""Remove retired wheelchair seen hooks from present harnesses."""
import json
import os
import re
import shlex
import sys
import tempfile

NOTICE = {"claude": "notice", "codex": "notice"}
ROOT, CLAUDE_HOME, CODEX_HOME, present_arg = sys.argv[1:]
PRESENT = present_arg.rstrip(",").split(",")
HOOK_PATH = os.path.join(ROOT, "seen", "hook.sh")
APP_WORKTREES = os.path.realpath(os.path.join(os.path.expanduser("~"), ".local", "state", "wheelchair", "worktrees"))
WORDING_RULE = re.compile(r"^Bash\((.*/seen/wording\.sh):\*\)$")


def canonical_group(harness):
    command = f"{shlex.quote(HOOK_PATH)} {harness} {NOTICE[harness]}"
    return {"hooks": [{"type": "command", "command": command, "timeout": 2}]}


def is_wheelchair_script(path, name):
    suffix = "/seen/" + name
    if not path.startswith("/") or not path.endswith(suffix):
        return False
    checkout = path[:-len(suffix)]
    return (checkout == ROOT or
            os.path.isfile(os.path.join(checkout, "protocol", "seen.md")) or
            os.path.isfile(os.path.join(checkout, "protocol", "app", "lead.md")) or
            os.path.realpath(checkout).startswith(APP_WORKTREES + os.sep))


def is_our_handler(handler, harness):
    if not isinstance(handler, dict) or not isinstance(handler.get("command"), str):
        return False
    try:
        tokens = shlex.split(handler["command"])
    except ValueError:
        return False
    return (len(tokens) == 3 and tokens[1:] == [harness, NOTICE[harness]] and
            is_wheelchair_script(tokens[0], "hook.sh"))


def clean(document, harness):
    changed = False
    hooks = document.get("hooks")
    if hooks is not None:
        if not isinstance(hooks, dict):
            raise ValueError("hooks is not an object")
        event = hooks.get("UserPromptSubmit")
        if event is not None:
            if not isinstance(event, list):
                raise ValueError("hooks.UserPromptSubmit is not a list")
            for group in event:
                if not isinstance(group, dict) or not isinstance(group.get("hooks"), list):
                    raise ValueError("UserPromptSubmit group hooks is not a list")
            kept_groups = []
            for group in event:
                handlers = group["hooks"]
                kept = [h for h in handlers if not is_our_handler(h, harness)]
                if len(kept) != len(handlers):
                    changed = True
                    if not kept:
                        continue
                    group["hooks"] = kept
                kept_groups.append(group)
            if changed:
                if kept_groups:
                    hooks["UserPromptSubmit"] = kept_groups
                else:
                    del hooks["UserPromptSubmit"]
                    if not hooks:
                        del document["hooks"]
    if harness == "claude":
        permissions = document.get("permissions")
        if permissions is not None:
            if not isinstance(permissions, dict):
                raise ValueError("permissions is not an object")
            allow = permissions.get("allow")
            if allow is not None:
                if not isinstance(allow, list):
                    raise ValueError("permissions.allow is not a list")
                def ours(rule):
                    match = WORDING_RULE.match(rule) if isinstance(rule, str) else None
                    return bool(match and is_wheelchair_script(match.group(1), "wording.sh"))
                kept = [rule for rule in allow if not ours(rule)]
                if len(kept) != len(allow):
                    permissions["allow"] = kept
                    changed = True
    return changed


def update(path, harness):
    try:
        with open(path, "rb") as f:
            raw = f.read()
    except FileNotFoundError:
        return False
    try:
        document = json.loads(raw.decode("utf-8"))
        if not isinstance(document, dict):
            raise ValueError("JSON root is not an object")
        if not clean(document, harness):
            return False
    except (UnicodeDecodeError, ValueError) as exc:
        print(f"seen hook: warning: {path}: {exc}", file=sys.stderr)
        return False
    new = (json.dumps(document, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    fd, temporary = tempfile.mkstemp(prefix=".wheelchair-seen.", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(new)
        os.chmod(temporary, os.stat(path).st_mode & 0o777)
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
    return True


changed = False
if "claude" in PRESENT:
    changed |= update(os.path.join(CLAUDE_HOME, "settings.json"), "claude")
if "codex" in PRESENT:
    changed |= update(os.path.join(CODEX_HOME, "hooks.json"), "codex")
print("seen hook: removed" if changed else "seen hook: nothing to remove")
