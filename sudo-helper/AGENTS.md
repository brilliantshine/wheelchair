# `sudo-helper/` — root sudo helper for cards

The root sudo helper lets the user run a lead's `sudo` card from their own device. It runs only from the installed root-owned copy in `/usr/local/lib/wheelchair-sudo/` as the `wheelchair-sudo.service` system unit, never from the clone. The user installs or updates it themselves with `sudo <clone>/sudo-helper/install.sh` from the canonical clone (refused from a worktree); `./install.sh` never touches it beyond a one-line hint.

| File | Role |
|---|---|
| `helper.py` | Intake and page sockets in `/run/wheelchair-sudo/`, sudo password check, runs the command as root, requests in memory only. |
| `static/` | The run page: `page.html` carries no request data, `page.js` sets every field as text, `page.css` styles it. |
| `install.sh` | Installs, updates and `--uninstall`s the system unit, config `/etc/wheelchair-sudo.conf` and the Tailscale HTTPS entry on port 8445. |
| `test/test_helper.py` + `test/shims/` | Unit tests against shim `runuser`/`sudo`. |
| `test/install-test.sh` | Installer against a temp root with shim `systemctl`/`tailscale`. |

Tests: `python3 -m unittest discover -s sudo-helper/test`; `bash sudo-helper/test/install-test.sh`.

The contract is in the Spec section “The sudo helper” in `docs/plans/sudo-cards/PLAN.md`; the card is in `protocol/app/cards.md`.
