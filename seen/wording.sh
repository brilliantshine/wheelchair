#!/usr/bin/env bash
exec python3 -I - "$@" <<'PY'
import datetime as dt
import fcntl
import os
import re
import sys
import tempfile

HEADERS = ("## Confirmed", "## Proposed", "## Struck")
EMPTY = "## Confirmed\n\n## Proposed\n\n## Struck\n"
ENTRY = re.compile(r'^- \d{4}-\d{2}-\d{2} — "([^"\n]+)" — .+$')
USAGE = 'usage: wording.sh suggest "<phrase>" "<instead>" | confirm|strike|remove "<phrase>"'


def die(message, code):
    print(message, file=sys.stderr)
    raise SystemExit(code)


def key(phrase):
    return phrase.strip().casefold()


def valid_phrase(phrase):
    return bool(phrase.strip()) and '"' not in phrase and '\n' not in phrase and '\r' not in phrase


def atomic_write(path, text):
    directory = os.path.dirname(path)
    fd, temporary = tempfile.mkstemp(prefix=".wording.", dir=directory)
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


def sections(text):
    lines = text.splitlines(keepends=True)
    positions = []
    for header in HEADERS:
        found = [index for index, line in enumerate(lines) if line.rstrip("\r\n") == header]
        if len(found) != 1:
            return None
        positions.append(found[0])
    if positions != sorted(positions):
        return None
    header_positions = set(positions)
    phrases = set()
    for index, line in enumerate(lines[positions[0] + 1:], positions[0] + 1):
        if index in header_positions:
            continue
        entry = line.rstrip("\r\n")
        if entry.strip() and not ENTRY.match(entry):
            return None
        if entry.strip():
            phrase = ENTRY.match(entry).group(1)
            normalized = key(phrase)
            if normalized in phrases:
                return None
            phrases.add(normalized)
    groups = {}
    for number, header in enumerate(HEADERS):
        begin = positions[number] + 1
        end = positions[number + 1] if number + 1 < len(HEADERS) else len(lines)
        groups[header] = lines[begin:end]
    return lines, positions, groups


def phrase_of(line):
    match = ENTRY.match(line.rstrip("\r\n"))
    return match.group(1) if match else None


def tidy(group, last):
    # Entries first, then one blank line before the next header, so the file keeps its shape.
    while group and not group[-1].strip():
        group.pop()
    while group and not group[0].strip():
        group.pop(0)
    return group + ([] if last else ["\n"])


def rebuild(parsed, groups):
    lines, positions, _ = parsed
    before = lines[:positions[0] + 1]
    groups = {header: tidy(list(groups[header]), header == HEADERS[-1]) for header in HEADERS}
    result = before + groups[HEADERS[0]] + ["## Proposed\n"] + groups[HEADERS[1]] + ["## Struck\n"] + groups[HEADERS[2]]
    return "".join(result)


def main(argv):
    if not argv or argv[0] not in ("suggest", "confirm", "strike", "remove"):
        die(USAGE, 2)
    verb = argv[0]
    expected = 3 if verb == "suggest" else 2
    if len(argv) != expected:
        die(USAGE, 2)
    phrase = argv[1]
    if not valid_phrase(phrase):
        die(USAGE, 2)
    if verb == "suggest" and (not argv[2] or "\n" in argv[2] or "\r" in argv[2]):
        die(USAGE, 2)
    path = os.environ.get("WHEELCHAIR_WORDING") or os.path.expanduser("~/.wheelchair/wording.md")
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    lock_path = os.path.join(directory, ".lock")
    with open(lock_path, "a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            with open(path, encoding="utf-8") as handle:
                text = handle.read()
        except FileNotFoundError:
            text = EMPTY
        except (OSError, UnicodeError) as error:
            die(f"wording: cannot read list: {error}", 1)
        parsed = sections(text)
        if parsed is None:
            die("wording: malformed wording list", 1)
        _, _, groups = parsed
        target = key(phrase)
        if verb == "suggest":
            for header in HEADERS:
                for line in groups[header]:
                    existing = phrase_of(line)
                    if existing is not None and key(existing) == target:
                        die("wording: phrase already appears in the list", 1)
            row = f'- {dt.date.today().isoformat()} — "{phrase}" — {argv[2]}\n'
            groups["## Proposed"].append(row)
        else:
            source = "## Confirmed" if verb == "remove" else "## Proposed"
            destination = "## Struck" if verb in ("strike", "remove") else "## Confirmed"
            found = None
            for index, line in enumerate(groups[source]):
                existing = phrase_of(line)
                if existing is not None and key(existing) == target:
                    found = index
                    break
            if found is None:
                die(f"wording: phrase is not in {source[3:]}", 1)
            row = groups[source].pop(found)
            groups[destination].append(row)
        atomic_write(path, rebuild(parsed, groups))


main(sys.argv[1:])
PY
