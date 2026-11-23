'use strict';
module.exports = {
  "cli": "claude",
  "provider": "claude",
  "label": "Claude",
  "displayName": "Claude Code",
  "typesRoleMessage": false,
  "singleAccount": false,
  "capabilities": {
    "usageProbe": true,
    "usageEvents": true,
    "preflight": false,
    "sandbox": false,
    "restartLoss": false,
    "projectTools": false,
    "recover": false,
    "spend": false,
    "liveSwitch": true,
    "aside": true,
    "versionCheck": false,
    "steps": false
  },
  "install": {
    "command": "t=$(mktemp) && curl -fsSL https://claude.ai/install.sh -o \"$t\" && bash \"$t\"; r=$?; rm -f \"$t\"; exit $r",
    "binary": "claude",
    "label": "Claude Code",
    "versionArgs": [
      "--version"
    ],
    "pathRank": 1,
    "sensitivity": true
  },
  "settings": {
    "modelPattern": "^[a-z0-9][a-z0-9._-]*$",
    "modelPlaceholder": "model-name",
    "cliLabel": "Claude Code",
    "vendor": "Anthropic",
    "setupUrl": "https://docs.claude.com/en/docs/claude-code/setup",
    "permissionMode": "permission_mode",
    "permissionChoices": [
      [
        "auto",
        "Auto"
      ],
      [
        "bypass",
        "Bypass"
      ]
    ],
    "accountWarning": "Anthropic's terms say plan limits assume ordinary, individual use. Several Claude accounts behind one setup may get flagged.",
    "modelHeadsUp": false,
    "signInKind": "link",
    "reviewFamily": true,
    "plans": [
      [
        "unknown",
        "Not sure"
      ],
      [
        "pro",
        "Pro"
      ],
      [
        "max5",
        "Max 5x"
      ],
      [
        "max20",
        "Max 20x"
      ]
    ],
    "weights": {
      "unknown": 1,
      "pro": 1,
      "max5": 5,
      "max20": 20
    },
    "reportedPlans": {},
    "oldPlanWeights": {}
  },
  "models": {
    "pins": {
      "light": {
        "model": "claude-haiku-5-5",
        "effort": null
      },
      "standard": {
        "model": "claude-sonnet-5-5",
        "effort": null
      },
      "heavy": {
        "model": "claude-opus-5-5",
        "effort": null
      },
      "critical": {
        "model": "claude-fable-5-2",
        "effort": null
      },
      "lead": {
        "model": "claude-opus-5-5",
        "effort": null
      }
    },
    "format": "^[a-z0-9][a-z0-9._-]{0,63}$",
    "efforts": [
      "low",
      "medium",
      "high",
      "xhigh",
      "max"
    ],
    "hubPattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
    "slotAliases": {
      "haiku": "light",
      "sonnet": "standard",
      "opus": "heavy"
    },
    "effortError": "effort is invalid"
  },
  "placement": {
    "workerRank": 1,
    "leadDefault": true,
    "seenByDefault": true,
    "addOnMigration": true,
    "appendWhenRequested": false
  },
  "report": {
    "useHookText": true
  },
  "stopWhenEnded": false,
  "asideParentField": "cli_session_id",
  "hook": {
    "payload": "stdin"
  },
  "recoverRank": null,
  "recoverFallback": true
};
