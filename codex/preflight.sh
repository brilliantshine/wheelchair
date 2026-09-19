#!/usr/bin/env bash
# GPT-lane preflight: guarantee the codex access token outlives every lane about to run.
#
# Why this exists: the ChatGPT refresh token is single-use — spending it mints a replacement
# and voids the one spent — and `codex exec` takes no lock on auth.json. codex refreshes only
# when a request comes back 401 after the access token expires, so two lanes running at that
# moment both spend the same refresh token and the loser writes back a dead credential.
# Concurrent lanes are therefore safe exactly when no lane can cross the expiry boundary
# mid-run. This script makes that true at dispatch: under a lock, read the token's remaining
# life; if it is shorter than the margin, refresh it here — one process, one spend, persisted
# before the lock releases. The refresh exchange is the one the retired credential balancer
# owned (packages/codex-auth-balancer/src/codex-oauth.ts in bravo-pi-mono): POST
# https://auth.openai.com/oauth/token with codex's public client id.
#
# Run it before the first GPT dispatch of a session and before any parallel fan-out.
#
# Exit 0 — token has at least the margin remaining; fan out freely.
# Exit 1 — transient refresh failure (network, 5xx); sequence lanes this session instead.
# Exit 2 — refresh token rejected; nothing here can recover it. Reauth: codex login --device-auth.
#
# CODEX_HOME is honored. Margin defaults to 24h; override with WHEELCHAIR_TOKEN_MARGIN_HOURS —
# it needs to exceed the longest lane you will run, nothing more (access tokens live ~10 days,
# so the refresh branch is rare).
set -euo pipefail

codex_home="${CODEX_HOME:-$HOME/.codex}"
lock="$codex_home/.wheelchair-refresh.lock"

exec 9>"$lock"
flock 9

# Everything below holds the lock: the re-read, the exchange, and the atomic write-back all
# happen before another preflight can start, so a concurrent caller adopts this rotation
# instead of making its own.
exec python3 - "$codex_home/auth.json" "${WHEELCHAIR_TOKEN_MARGIN_HOURS:-24}" <<'PY'
import base64, datetime, json, os, sys, tempfile, urllib.error, urllib.parse, urllib.request

TOKEN_URL = "https://auth.openai.com/oauth/token"
CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"  # codex's public OAuth client

auth_path, margin_hours = sys.argv[1], float(sys.argv[2])

try:
    with open(auth_path) as f:
        auth = json.load(f)
except FileNotFoundError:
    print(f"preflight: no {auth_path}; run codex login first", file=sys.stderr)
    sys.exit(2)

tokens = auth.get("tokens") or {}
access = tokens.get("access_token")
if not access:
    # API-key auth has no refresh token and no race.
    print("preflight: no OAuth tokens (API-key auth?); nothing to do")
    sys.exit(0)

def jwt_exp(token):
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))["exp"]

now = datetime.datetime.now(datetime.timezone.utc).timestamp()
remaining = jwt_exp(access) - now
if remaining > margin_hours * 3600:
    print(f"preflight: token fresh ({remaining / 3600:.0f}h remaining)")
    sys.exit(0)

# Refresh. The refresh token is single-use: never retried with the same value, and the
# result is persisted before this process exits (and before the flock in the wrapper
# releases). A success we fail to write would brick the token family, hence the atomic
# replace in the same breath as the exchange.
body = urllib.parse.urlencode({
    "grant_type": "refresh_token",
    "refresh_token": tokens["refresh_token"],
    "client_id": CLIENT_ID,
}).encode()
req = urllib.request.Request(
    TOKEN_URL, data=body,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        fresh = json.load(resp)
except urllib.error.HTTPError as e:
    detail = e.read().decode(errors="replace")[:300]
    if e.code in (400, 401, 403):
        print(f"preflight: refresh token rejected ({e.code}): {detail}", file=sys.stderr)
        print("preflight: reauth with: codex login --device-auth", file=sys.stderr)
        sys.exit(2)
    print(f"preflight: refresh failed ({e.code}): {detail} — sequence lanes", file=sys.stderr)
    sys.exit(1)
except Exception as e:  # network, timeout — transient, never brick on these
    print(f"preflight: refresh failed ({e}) — sequence lanes", file=sys.stderr)
    sys.exit(1)

if not isinstance(fresh.get("access_token"), str) or not isinstance(fresh.get("refresh_token"), str):
    print(f"preflight: refresh response missing fields — sequence lanes", file=sys.stderr)
    sys.exit(1)

tokens["access_token"] = fresh["access_token"]
tokens["refresh_token"] = fresh["refresh_token"]
if isinstance(fresh.get("id_token"), str):
    tokens["id_token"] = fresh["id_token"]
auth["tokens"] = tokens
auth["last_refresh"] = (
    datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
)

fd, tmp = tempfile.mkstemp(dir=os.path.dirname(auth_path), prefix=".auth.json.")
try:
    with os.fdopen(fd, "w") as f:
        json.dump(auth, f, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, auth_path)
except BaseException:
    os.unlink(tmp)
    raise

print(f"preflight: refreshed ({jwt_exp(tokens['access_token']) - now:.0f}s of life)")
PY
