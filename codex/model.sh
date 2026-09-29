#!/usr/bin/env bash
# Read and maintain wheelchair's local GPT model pins.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 -I - "$root" "$@" <<'PY'
import fcntl
import json
import os
import re
import sys
import tempfile

# The shipped pins live in one table so new installations and missing entries agree.
DEFAULTS = (
    ("luna", "gpt-6-luna"),
    ("terra", "gpt-5.6-terra"),
    ("sol", "gpt-6.1-sol"),
    ("astra", "gpt-6-astra"),
)
TIERS = tuple(tier for tier, _ in DEFAULTS)
DEFAULT_BY_TIER = dict(DEFAULTS)
VALUE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")
PIN_LINE = re.compile(r"^\s*(luna|terra|sol|astra|skip)\s*=\s*([a-z0-9][a-z0-9._-]*)\s*$")
MODEL = re.compile(r"^gpt-(\d+(?:\.\d+)*)-([a-z]+)$")
USAGE = "usage: model.sh <luna|terra|sol|astra> | set <tier> <model> | skip <model> | init | check"


def paths():
    pin_path = os.environ.get("WHEELCHAIR_MODELS") or os.path.expanduser("~/.wheelchair/models")
    cache_path = os.environ.get("WHEELCHAIR_MODELS_CACHE") or os.path.join(
        os.environ.get("CODEX_HOME") or os.path.expanduser("~/.codex"), "models_cache.json"
    )
    return pin_path, cache_path


def parse_pins(text):
    pins = {}
    skipped = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = PIN_LINE.match(raw)
        if match is None:
            return None
        key, value = match.groups()
        if key == "skip":
            skipped.append(value)
        elif key in pins:
            return None
        else:
            pins[key] = value
    return pins, skipped


def read_pins(pin_path):
    try:
        with open(pin_path, encoding="utf-8") as handle:
            parsed = parse_pins(handle.read())
    except FileNotFoundError:
        return {}, [], False
    except (OSError, UnicodeError):
        return {}, [], True
    if parsed is None:
        return {}, [], True
    pins, skipped = parsed
    return pins, skipped, False


def rendered(pins, skipped):
    lines = ["# wheelchair's GPT model pins. Change them with codex/model.sh.\n"]
    for tier in TIERS:
        lines.append(f"{tier} = {pins.get(tier, DEFAULT_BY_TIER[tier])}\n")
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
    if match is None:
        return None
    return tuple(int(part) for part in match.group(1).split(".")), match.group(2)


def compare_versions(left, right):
    length = max(len(left), len(right))
    for index in range(length):
        a = left[index] if index < len(left) else 0
        b = right[index] if index < len(right) else 0
        if a != b:
            return 1 if a > b else -1
    return 0


def newer_first(models):
    # Tuple padding makes numeric versions sortable while preserving a deterministic tie break.
    width = max((len(model_parts(model)[0]) for model in models), default=0)
    return sorted(
        models,
        key=lambda model: (model_parts(model)[0] + (0,) * (width - len(model_parts(model)[0])), model),
        reverse=True,
    )


def visible_models(cache_path):
    try:
        with open(cache_path, encoding="utf-8") as handle:
            cache = json.load(handle)
    except (OSError, UnicodeError, ValueError, RecursionError):
        return []
    if not isinstance(cache, dict) or not isinstance(cache.get("models"), list):
        return []
    entries = cache["models"]
    if any(not isinstance(entry, dict) or not isinstance(entry.get("slug"), str) or not isinstance(entry.get("visibility"), str) for entry in entries):
        return []
    models = []
    seen = set()
    for entry in entries:
        slug = entry["slug"]
        if entry["visibility"] == "list" and model_parts(slug) is not None and slug not in seen:
            models.append(slug)
            seen.add(slug)
    return models


def heads_up(root, pin_path, cache_path):
    pins, skipped, malformed = read_pins(pin_path)
    if malformed:
        print(f"heads-up: {pin_path} is malformed, so every GPT lane is using the shipped defaults. Fix or delete it")
        pins, skipped = {}, []

    visible = visible_models(cache_path)
    skipped = set(skipped)
    effective = {tier: pins.get(tier, DEFAULT_BY_TIER[tier]) for tier in TIERS}
    pinned = set(effective.values())
    candidates = [model for model in visible if model not in skipped and model not in pinned]
    words = {}
    for tier, pin in effective.items():
        parsed = model_parts(pin)
        words[tier] = parsed[1] if parsed is not None else tier

    command = os.path.join(root, "codex", "model.sh")
    for tier in TIERS:
        pin = effective[tier]
        parsed_pin = model_parts(pin)
        family = words[tier]
        family_models = [model for model in candidates if model_parts(model)[1] == family]
        if parsed_pin is None:
            # A hand-set pin has no version to compare.  Pick the newest visible
            # family member first, then let its skip quiet the family until a
            # genuinely later model arrives.
            family_visible = [
                model for model in visible
                if model not in pinned and model_parts(model)[1] == family
            ]
            if not family_visible:
                continue
            newest = newer_first(family_visible)[0]
            if newest in skipped:
                continue
            title = tier.title()
            print(
                f"heads-up: {newest} is available for {title}, which is pinned to {pin}. "
                f"Switch: {command} set {tier} {newest} (or {command} skip {newest})"
            )
            continue
        if not family_models:
            continue
        newer = [model for model in family_models if compare_versions(model_parts(model)[0], parsed_pin[0]) > 0]
        if newer:
            newest = newer_first(newer)[0]
            title = tier.title()
            print(
                f"heads-up: {newest} is newer than {title}'s {pin}. "
                f"Switch: {command} set {tier} {newest} (or {command} skip {newest})"
            )

    family_words = set(words.values())
    tierless = [model for model in candidates if model_parts(model)[1] not in family_words]
    tierless = newer_first(tierless)
    for model in tierless[:3]:
        print(
            f"heads-up: {model} is available and matches no tier. "
            f"Pin it: {command} set <tier> {model} (or {command} skip {model})"
        )
    if len(tierless) > 3:
        print(f"heads-up: and {len(tierless) - 3} more that match no tier")


def die_usage():
    print(USAGE, file=sys.stderr)
    raise SystemExit(2)


def main(root, argv):
    pin_path, cache_path = paths()
    if len(argv) == 1 and argv[0] in TIERS:
        pins, _, malformed = read_pins(pin_path)
        if malformed:
            print(f"model: {pin_path} is malformed; using shipped defaults", file=sys.stderr)
            pins = {}
        print(pins.get(argv[0], DEFAULT_BY_TIER[argv[0]]))
        return
    if len(argv) == 1 and argv[0] == "init":
        def initialize():
            if os.path.exists(pin_path):
                return
            atomic_write(pin_path, rendered(dict(DEFAULTS), []))
        try:
            locked_write(pin_path, initialize)
        except OSError as error:
            print(f"model: cannot initialize pins: {error}", file=sys.stderr)
            raise SystemExit(1)
        return
    if len(argv) == 1 and argv[0] == "check":
        try:
            heads_up(root, pin_path, cache_path)
        except Exception:
            pass
        return
    if len(argv) == 3 and argv[0] == "set" and argv[1] in TIERS and VALUE.match(argv[2]):
        tier, model = argv[1], argv[2]
        def set_pin():
            pins, skipped, malformed = read_pins(pin_path)
            if malformed:
                print("model: malformed pins file", file=sys.stderr)
                raise SystemExit(1)
            if not os.path.exists(pin_path):
                pins = dict(DEFAULTS)
            pins[tier] = model
            atomic_write(pin_path, rendered(pins, [item for item in skipped if item != model]))
        try:
            locked_write(pin_path, set_pin)
        except OSError as error:
            print(f"model: cannot write pins: {error}", file=sys.stderr)
            raise SystemExit(1)
        return
    if len(argv) == 2 and argv[0] == "skip" and VALUE.match(argv[1]):
        model = argv[1]
        def skip_model():
            pins, skipped, malformed = read_pins(pin_path)
            if malformed:
                print("model: malformed pins file", file=sys.stderr)
                raise SystemExit(1)
            if not os.path.exists(pin_path):
                pins = dict(DEFAULTS)
            if model not in skipped:
                skipped.append(model)
            atomic_write(pin_path, rendered(pins, skipped))
        try:
            locked_write(pin_path, skip_model)
        except OSError as error:
            print(f"model: cannot write pins: {error}", file=sys.stderr)
            raise SystemExit(1)
        return
    die_usage()


main(sys.argv[1], sys.argv[2:])
PY
