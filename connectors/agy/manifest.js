'use strict';
module.exports = {
  "cli": "agy",
  "provider": "gemini",
  "label": "Antigravity",
  "displayName": "Antigravity",
  "typesRoleMessage": true,
  "singleAccount": true,
  "capabilities": {
    "usageProbe": false,
    "usageEvents": false,
    "preflight": false,
    "sandbox": false,
    "restartLoss": false,
    "projectTools": false,
    "recover": true,
    "spend": false,
    "liveSwitch": false,
    "aside": false,
    "versionCheck": false,
    "steps": false
  },
  "install": {
    "lookup": "path",
    "command": "t=$(mktemp) && curl -fsSL https://antigravity.google/cli/install.sh -o \"$t\" && bash \"$t\"; r=$?; rm -f \"$t\"; exit $r",
    "binary": "agy",
    "label": "Antigravity",
    "versionArgs": [
      "--version"
    ],
    "pathRank": 2,
    "sensitivity": false
  },
  "settings": {
    "monoModelNames": true,
    "modelOptions": {"listedKey": "agy_visible", "listedShape": "objects", "includePins": true},
    "modelPattern": "^[a-z0-9][a-z0-9._-]*$",
    "modelPlaceholder": "model-name",
    "cliLabel": "Antigravity CLI",
    "vendor": "Google",
    "setupUrl": "https://antigravity.google/cli",
    "permissionMode": null,
    "permissionChoices": [],
    "accountWarning": null,
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
        "AI Pro"
      ],
      [
        "ultra",
        "AI Ultra"
      ]
    ],
    "weights": {
      "unknown": 1,
      "pro": 1,
      "ultra": 4
    },
    "reportedPlans": {},
    "oldPlanWeights": {},
    "modelError": "Use lowercase letters, digits, dots, dashes and underscores, starting with a letter or digit.",
    "familyHint": null,
    "accountPolicy": "Antigravity supports one account per machine"
  },
  "models": {
    "pins": {
      "light": {
        "model": "gemini-3.8-flash",
        "effort": "low"
      },
      "standard": {
        "model": "gemini-3.8-flash",
        "effort": "medium"
      },
      "heavy": {
        "model": "gemini-3.8-flash",
        "effort": "high"
      },
      "critical": {
        "model": "gemini-3.8-flash",
        "effort": "high"
      },
      "lead": {
        "model": "gemini-3.8-flash",
        "effort": "high"
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
    "slotAliases": {},
    "effortError": "effort is invalid"
  },
  "placement": {
    "workerRank": 2,
    "leadDefault": false,
    "seenByDefault": false,
    "addOnMigration": true,
    "appendWhenRequested": false
  },
  "report": {
    "useHookText": true
  },
  "wrapProjectTools": true,
  "injectProjectKeys": false,
  "joinPaneLines": false,
  "stopWhenEnded": false,
  "hook": {
    "payload": "stdin",
    "sessionFromEnv": true
  },
  "recoverRank": 2,
  "recoverFallback": false
};
