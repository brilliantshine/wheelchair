#!/usr/bin/env bash
# Read and maintain wheelchair's local agent model pins.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 -I - "$root" "$@" <<'PY'
import fcntl
import json
import os
import re
import sys
import tempfile

PROVIDERS = ("claude", "gpt", "gemini", "kimi")
SLOTS = ("light", "standard", "heavy", "critical", "lead", "sub-lead")
WORK_TIERS = ("light", "standard", "heavy", "critical")
DEFAULTS = {
    "claude": {
        "light": ("claude-haiku-5-5", None), "standard": ("claude-sonnet-5-5", None),
        "heavy": ("claude-opus-5-5", None), "critical": ("claude-fable-5-2", None),
        "lead": ("claude-opus-5-5", None),
    },
    "gpt": {
        "light": ("gpt-6-luna", None), "standard": ("gpt-5.6-terra", None),
        "heavy": ("gpt-6.1-sol", None), "critical": ("gpt-6-astra", None),
        "lead": ("gpt-6.1-sol", None),
    },
    "gemini": {
        "light": ("gemini-3.8-flash-low", None), "standard": ("gemini-3.8-flash-medium", None),
        "heavy": ("gemini-3.8-flash-high", None), "critical": ("gemini-3.8-flash-high", None),
        "lead": ("gemini-3.8-flash-high", None),
    },
    "kimi": {
        "light": ("kimi-code/kimi-for-coding", None), "standard": ("kimi-code/k3", None),
        "heavy": ("kimi-code/k3.1-pro", None), "critical": ("kimi-code/k3.1-pro", None),
        "lead": ("kimi-code/k3.1-pro", None),
    },
}
ALIASES = {"luna": "light", "terra": "standard", "sol": "heavy", "astra": "critical"}
CLAUDE_ALIASES = {"haiku": "light", "sonnet": "standard", "opus": "heavy"}
EFFORTS = {"low", "medium", "high", "xhigh", "max"}
GPT_EFFORTS = {"low", "medium", "high", "xhigh"}
VALUE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
KIMI_VALUE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}(/[a-z0-9][a-z0-9._-]{0,63})?$")


def value_ok(provider, model):
    return (KIMI_VALUE if provider == "kimi" else VALUE).match(model) is not None
MODEL = re.compile(r"^gpt-(\d+(?:\.\d+)*)-([a-z]+)$")
USAGE = ("usage: model.sh <light|standard|heavy|critical> | <claude|gpt|gemini|kimi> <slot> | "
         "effort <claude|gpt|gemini|kimi> <slot> | family claude <slot> | "
         "set [<provider> <slot> | <tier>] <model|none> [effort] | "
         "skip <model> | init | reset | check [--json] | show --json")


def paths():
    pins = os.environ.get("WHEELCHAIR_MODELS") or os.path.expanduser("~/.wheelchair/models")
    cache = os.environ.get("WHEELCHAIR_MODELS_CACHE") or os.path.join(
        os.environ.get("CODEX_HOME") or os.path.expanduser("~/.codex"), "models_cache.json")
    return pins, cache


def slot_for(provider, name):
    if name in SLOTS:
        return name
    if name in ALIASES:
        return ALIASES[name]
    if provider == "claude" and name in CLAUDE_ALIASES:
        return CLAUDE_ALIASES[name]
    return None


def blank_pins():
    return {provider: {} for provider in PROVIDERS}


def parse_pins(text):
    pins, skipped, seen = blank_pins(), [], set()
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        skip = re.fullmatch(r"skip\s*=\s*([a-z0-9][a-z0-9._-]*)", line)
        if skip is not None:
            if skip.group(1) == "none":
                return None
            skipped.append(skip.group(1))
            continue
        entry = re.fullmatch(
            r"(claude|gpt|gemini|kimi)\.([a-z-]+)\s*=\s*([a-z0-9][a-z0-9._-]{0,63}(?:/[a-z0-9][a-z0-9._-]{0,63})?)(?:\s+@([a-z]+))?", line)
        if entry is not None:
            provider, raw_slot, model, effort = entry.groups()
            slot = slot_for(provider, raw_slot)
            if slot is None or not value_ok(provider, model):
                return None
            if model == "none":
                if effort is not None:
                    return None
            elif effort is not None and provider == "kimi":
                return None
            elif effort is not None and effort not in (GPT_EFFORTS if provider == "gpt" else EFFORTS):
                return None
            key = provider, slot
            if key in seen:
                return None
            seen.add(key)
            pins[provider][slot] = model, effort
            continue
        legacy = re.fullmatch(r"([a-z]+)\s*=\s*([a-z0-9][a-z0-9._-]*)", line)
        if legacy is None:
            return None
        raw_slot, model = legacy.groups()
        slot = ALIASES.get(raw_slot, raw_slot if raw_slot in WORK_TIERS else None)
        key = "gpt", slot
        if slot is None or model == "none" or key in seen:
            return None
        seen.add(key)
        pins["gpt"][slot] = model, None
    return pins, skipped


def read_pins(path):
    try:
        with open(path, encoding="utf-8") as handle:
            parsed = parse_pins(handle.read())
    except FileNotFoundError:
        return blank_pins(), [], False
    except (OSError, UnicodeError):
        return blank_pins(), [], True
    if parsed is None:
        return blank_pins(), [], True
    return *parsed, False


def cell(pins, provider, slot):
    if slot == "sub-lead" and slot not in pins[provider]:
        return cell(pins, provider, "lead")
    return pins[provider][slot] if slot in pins[provider] else DEFAULTS[provider][slot]


def rendered(pins, skipped):
    lines = ["# wheelchair's model pins. Change them with codex/model.sh.\n"]
    for provider in PROVIDERS:
        for slot in SLOTS:
            model, effort = cell(pins, provider, slot)
            suffix = f" @{effort}" if model != "none" and effort else ""
            lines.append(f"{provider}.{slot} = {model}{suffix}\n")
    lines.extend(f"skip = {model}\n" for model in skipped)
    return "".join(lines)


def atomic_write(path, text):
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".models.", dir=directory)
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


def locked_write(path, change):
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    with open(os.path.join(directory, ".lock"), "a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        return change()


def model_parts(model):
    match = MODEL.match(model)
    return None if match is None else (tuple(int(part) for part in match.group(1).split(".")), match.group(2))


def compare_versions(left, right):
    for index in range(max(len(left), len(right))):
        a = left[index] if index < len(left) else 0
        b = right[index] if index < len(right) else 0
        if a != b:
            return 1 if a > b else -1
    return 0


def newer_first(models):
    width = max((len(model_parts(model)[0]) for model in models), default=0)
    return sorted(models, key=lambda model: (
        model_parts(model)[0] + (0,) * (width - len(model_parts(model)[0])), model), reverse=True)


def visible_models(cache_path):
    try:
        with open(cache_path, encoding="utf-8") as handle:
            cache = json.load(handle)
    except (OSError, UnicodeError, ValueError, RecursionError):
        return []
    if not isinstance(cache, dict) or not isinstance(cache.get("models"), list):
        return []
    models, seen = [], set()
    for entry in cache["models"]:
        if not isinstance(entry, dict) or not isinstance(entry.get("slug"), str) or not isinstance(entry.get("visibility"), str):
            return []
        model = entry["slug"]
        if entry["visibility"] == "list" and model_parts(model) is not None and model not in seen:
            models.append(model)
            seen.add(model)
    return newer_first(models)


def listed_models(cache_path):
    try:
        with open(cache_path, encoding="utf-8") as handle:
            cache = json.load(handle)
    except (OSError, UnicodeError, ValueError, RecursionError):
        return []
    if not isinstance(cache, dict) or not isinstance(cache.get("models"), list):
        return []
    parsed, other, seen = [], [], set()
    for entry in cache["models"]:
        if not isinstance(entry, dict) or not isinstance(entry.get("slug"), str) or not isinstance(entry.get("visibility"), str):
            return []
        model = entry["slug"]
        if entry["visibility"] != "list" or not VALUE.match(model) or model in seen:
            continue
        seen.add(model)
        (parsed if model_parts(model) is not None else other).append(model)
    return newer_first(parsed) + other


def kimi_config(text):
    """Model tables of Kimi Code's config: tomllib when present, else a plain scan (Python < 3.11)."""
    try:
        import tomllib
    except ImportError:
        models, current = {}, None
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("["):
                match = re.fullmatch(r'\[models\."([^"\\]*)"\]', line)
                current = match.group(1) if match else None
                if current is not None:
                    models.setdefault(current, {})
            elif current is not None:
                match = re.fullmatch(r'display_name\s*=\s*"([^"\\]*)"', line)
                if match:
                    models[current]["display_name"] = match.group(1)
        return {"models": models}
    return tomllib.loads(text)


def kimi_models():
    """The model aliases in Kimi Code's config, as [{value, label}], or [] when unreadable."""
    path = os.environ.get("WHEELCHAIR_KIMI_CONFIG") or os.path.expanduser("~/.kimi-code/config.toml")
    try:
        with open(path, encoding="utf-8") as handle:
            config = kimi_config(handle.read())
    except Exception:
        return []
    models = config.get("models") if isinstance(config, dict) else None
    if not isinstance(models, dict):
        return []
    listed = []
    for alias, entry in models.items():
        # Only aliases a pin can hold: fullmatch (no trailing newline), and never the "none" marker.
        if not isinstance(alias, str) or alias == "none" or not KIMI_VALUE.fullmatch(alias):
            continue
        name = entry.get("display_name") if isinstance(entry, dict) else None
        label = f"{name} ({alias})" if isinstance(name, str) and name.strip() else alias
        listed.append({"value": alias, "label": label})
    return listed


def heads_up_events(pin_path, cache_path):
    pins, skipped, malformed = read_pins(pin_path)
    events = []
    if malformed:
        events.append({"kind": "malformed", "tier": None, "model": None, "current": None})
        pins, skipped = blank_pins(), []
    visible, skipped = visible_models(cache_path), set(skipped)
    active = {slot: cell(pins, "gpt", slot)[0] for slot in WORK_TIERS}
    active = {slot: model for slot, model in active.items() if model != "none"}
    pinned = set(active.values())
    candidates = [model for model in visible if model not in skipped and model not in pinned]
    # Disabled cells do not get a heads-up of their own, but their shipped family
    # remains claimed so a newer member is not reintroduced as a tierless model.
    words = {slot: (model_parts(model) or model_parts(DEFAULTS["gpt"][slot][0]))[1] for slot, model in active.items()}
    claimed_families = set(words.values())
    for slot in WORK_TIERS:
        if slot not in active:
            fallback = model_parts(DEFAULTS["gpt"][slot][0])
            if fallback is not None:
                claimed_families.add(fallback[1])
    for slot, current in active.items():
        parsed = model_parts(current)
        family = words[slot]
        family_candidates = [model for model in candidates if model_parts(model)[1] == family]
        if parsed is None:
            available = [model for model in visible if model not in pinned and model_parts(model)[1] == family]
            if available and available[0] not in skipped:
                events.append({"kind": "available", "tier": slot, "model": available[0], "current": current})
            continue
        newer = [model for model in family_candidates
                 if compare_versions(model_parts(model)[0], parsed[0]) > 0]
        if newer:
            events.append({"kind": "newer", "tier": slot, "model": newer_first(newer)[0], "current": current})
    for model in newer_first([model for model in candidates if model_parts(model)[1] not in claimed_families]):
        events.append({"kind": "tierless", "tier": None, "model": model, "current": None})
    return events


def print_heads_up(root, pin_path, cache_path):
    command, tierless = os.path.join(root, "codex", "model.sh"), 0
    for event in heads_up_events(pin_path, cache_path):
        kind, tier, model, current = event["kind"], event["tier"], event["model"], event["current"]
        if kind == "malformed":
            print(f"heads-up: {pin_path} is malformed, so every GPT lane is using the shipped defaults. Fix or delete it")
        elif kind == "newer":
            print(f"heads-up: {model} is newer than {tier.title()}'s {current}. Switch: {command} set gpt {tier} {model} (or {command} skip {model})")
        elif kind == "available":
            print(f"heads-up: {model} is available for {tier.title()}, which is pinned to {current}. Switch: {command} set gpt {tier} {model} (or {command} skip {model})")
        elif tierless < 3:
            print(f"heads-up: {model} is available and matches no tier. Pin it: {command} set gpt <tier> {model} (or {command} skip {model})")
            tierless += 1
        else:
            tierless += 1
    if tierless > 3:
        print(f"heads-up: and {tierless - 3} more that match no tier")


def die_usage():
    print(USAGE, file=sys.stderr)
    raise SystemExit(2)


def read_cell(path, provider, slot):
    pins, _, malformed = read_pins(path)
    if malformed:
        print(f"model: {path} is malformed; using shipped defaults", file=sys.stderr)
        pins = blank_pins()
    return cell(pins, provider, slot)


def write(path, change):
    try:
        locked_write(path, change)
    except OSError as error:
        print(f"model: cannot write pins: {error}", file=sys.stderr)
        raise SystemExit(1)


def write_pin(path, provider, slot, model, effort):
    def change():
        pins, skipped, malformed = read_pins(path)
        if malformed:
            print("model: malformed pins file", file=sys.stderr)
            raise SystemExit(1)
        pins[provider][slot] = model, effort
        atomic_write(path, rendered(pins, [item for item in skipped if item != model]))
    write(path, change)


def main(root, argv):
    pin_path, cache_path = paths()
    if len(argv) == 1 and (slot := slot_for("gpt", argv[0])) in WORK_TIERS:
        model, _ = read_cell(pin_path, "gpt", slot)
        if model == "none":
            print(f"gpt is not used at {slot}", file=sys.stderr)
            raise SystemExit(3)
        print(model)
        return
    if len(argv) == 2 and argv[0] in PROVIDERS and (slot := slot_for(argv[0], argv[1])) is not None:
        model, _ = read_cell(pin_path, argv[0], slot)
        if model == "none":
            print(f"{argv[0]} is not used at {slot}", file=sys.stderr)
            raise SystemExit(3)
        print(model)
        return
    if len(argv) == 3 and argv[0] == "effort" and argv[1] in PROVIDERS and (slot := slot_for(argv[1], argv[2])) is not None:
        model, effort = read_cell(pin_path, argv[1], slot)
        if model != "none" and effort:
            print(effort)
        return
    if len(argv) == 3 and argv[:2] == ["family", "claude"] and (slot := slot_for("claude", argv[2])) is not None:
        model, _ = read_cell(pin_path, "claude", slot)
        for family in ("haiku", "sonnet", "opus", "fable"):
            if model != "none" and family in model:
                print(family)
                return
        print(f"claude has no family at {slot}", file=sys.stderr)
        raise SystemExit(3)
    if argv == ["init"]:
        write(pin_path, lambda: None if os.path.exists(pin_path) else atomic_write(pin_path, rendered(blank_pins(), [])))
        return
    if argv == ["reset"]:
        write(pin_path, lambda: atomic_write(pin_path, rendered(blank_pins(), [])))
        return
    if argv in (["check"], ["check", "--json"]):
        try:
            if len(argv) == 2:
                print(json.dumps(heads_up_events(pin_path, cache_path), separators=(",", ":")))
            else:
                print_heads_up(root, pin_path, cache_path)
        except Exception:
            if len(argv) == 2:
                print("[]")
        return
    if argv == ["show", "--json"]:
        pins, _, malformed = read_pins(pin_path)
        if malformed:
            pins = blank_pins()
        result = {provider: {} for provider in PROVIDERS}
        for provider in PROVIDERS:
            for slot in SLOTS:
                model, effort = cell(pins, provider, slot)
                result[provider][slot] = None if model == "none" else {
                    "model": model, "effort": effort}
        result["malformed"], result["visible"] = malformed, listed_models(cache_path)
        result["kimi_visible"] = kimi_models()
        print(json.dumps(result, separators=(",", ":")))
        return
    if len(argv) == 3 and argv[0] == "set" and (slot := slot_for("gpt", argv[1])) in WORK_TIERS:
        model = argv[2]
        if not VALUE.match(model):
            die_usage()
        write_pin(pin_path, "gpt", slot, model, None)
        return
    if len(argv) in (4, 5) and argv[0] == "set" and argv[1] in PROVIDERS:
        _, provider, raw_slot, model, *tail = argv
        slot = slot_for(provider, raw_slot)
        effort = tail[0] if tail else None
        if provider == "kimi" and effort is not None:
            print("Kimi Code has no effort setting", file=sys.stderr)
            sys.exit(2)
        if provider == "gpt" and effort is not None and effort not in GPT_EFFORTS:
            print("GPT effort must be one of: low, medium, high, xhigh", file=sys.stderr)
            die_usage()
        if (slot is None or not value_ok(provider, model)
                or (model == "none" and effort is not None)
                or (effort is not None and effort not in (GPT_EFFORTS if provider == "gpt" else EFFORTS))):
            die_usage()
        write_pin(pin_path, provider, slot, model, effort)
        return
    if len(argv) == 2 and argv[0] == "skip" and VALUE.match(argv[1]) and argv[1] != "none":
        model = argv[1]
        def skip():
            pins, skipped, malformed = read_pins(pin_path)
            if malformed:
                print("model: malformed pins file", file=sys.stderr)
                raise SystemExit(1)
            if model not in skipped:
                skipped.append(model)
            atomic_write(pin_path, rendered(pins, skipped))
        write(pin_path, skip)
        return
    die_usage()


main(sys.argv[1], sys.argv[2:])
PY
