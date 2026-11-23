'use strict';
module.exports = {
  "cli": "codex",
  "provider": "gpt",
  "label": "GPT",
  "displayName": "Codex",
  "typesRoleMessage": true,
  "singleAccount": false,
  "capabilities": {
    "usageProbe": true,
    "usageEvents": true,
    "preflight": true,
    "sandbox": true,
    "restartLoss": false,
    "projectTools": true,
    "recover": true,
    "spend": false,
    "liveSwitch": true,
    "aside": true,
    "versionCheck": false,
    "steps": true
  },
  "install": {
    "lookup": "path",
    "command": "npm install -g --prefix \"$HOME/.local\" @openai/codex@latest",
    "node": "16.0.0",
    "binary": "codex",
    "label": "Codex",
    "versionArgs": [
      "--version"
    ],
    "pathRank": 0,
    "sensitivity": true
  },
  "settings": {
    "modelOptions": {"listedKey": "visible", "listedShape": "strings", "includePins": true},
    "monoModelNames": true,
    "modelPattern": "^[a-z0-9][a-z0-9._-]*$",
    "modelPlaceholder": "model-name",
    "cliLabel": "Codex",
    "vendor": "OpenAI",
    "setupUrl": "https://github.com/openai/codex",
    "permissionMode": "codex_mode",
    "permissionChoices": [
      [
        "sandboxed",
        "Sandboxed"
      ],
      [
        "unrestricted",
        "Unrestricted"
      ]
    ],
    "accountWarning": null,
    "modelHeadsUp": true,
    "signInKind": "device",
    "reviewFamily": true,
    "plans": [
      [
        "unknown",
        "Not sure"
      ],
      [
        "plus",
        "Plus"
      ],
      [
        "prolite",
        "Pro Lite"
      ],
      [
        "pro",
        "Pro"
      ],
      [
        "promax",
        "Pro Max"
      ]
    ],
    "weights": {
      "unknown": 1,
      "plus": 1,
      "prolite": 5,
      "pro": 10,
      "promax": 25
    },
    "reportedPlans": {
      "plus": "plus",
      "prolite": "prolite",
      "pro": "pro",
      "promax": "promax"
    },
    "oldPlanWeights": {
      "pro": [
        6
      ]
    },
    "modelError": "Use lowercase letters, digits, dots, dashes and underscores, starting with a letter or digit.",
    "familyHint": null,
    "accountPolicy": null
  },
  "models": {
    "bareTierSet": true,
    "pins": {
      "light": {
        "model": "gpt-6-luna"
      },
      "standard": {
        "model": "gpt-5.6-terra"
      },
      "heavy": {
        "model": "gpt-6.1-sol"
      },
      "critical": {
        "model": "gpt-6-astra"
      },
      "lead": {
        "model": "gpt-6.1-sol"
      }
    },
    "format": "^[a-z0-9][a-z0-9._-]{0,63}$",
    "efforts": [
      "low",
      "medium",
      "high",
      "xhigh"
    ],
    "hubPattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
    "slotAliases": {},
    "effortError": "effort for GPT must be one of low, medium, high, xhigh"
  },
  "placement": {
    "workerRank": 0,
    "leadDefault": false,
    "seenByDefault": true,
    "addOnMigration": true,
    "appendWhenRequested": false
  },
  "report": {
    "useHookText": true
  },
  "wrapProjectTools": true,
  "injectProjectKeys": true,
  "joinPaneLines": false,
  "stopWhenEnded": false,
  "asideParentField": "codex_thread_id",
  "hook": {
    "payload": "last-arg"
  },
  "recoverRank": 3,
  "recoverFallback": false
};
