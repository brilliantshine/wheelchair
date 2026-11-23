'use strict';
module.exports = {
  "cli": "pi",
  "provider": "openrouter",
  "label": "OpenRouter",
  "displayName": "Pi (OpenRouter)",
  "shortName": "Pi",
  "typesRoleMessage": false,
  "singleAccount": false,
  "capabilities": {
    "usageProbe": false,
    "usageEvents": false,
    "preflight": false,
    "sandbox": false,
    "restartLoss": false,
    "projectTools": false,
    "recover": false,
    "spend": true,
    "liveSwitch": false,
    "aside": true,
    "versionCheck": false,
    "steps": false
  },
  "install": {
    "command": "npm install -g --prefix \"$HOME/.local\" @earendil-works/pi-coding-agent@latest",
    "node": "22.19.0",
    "binary": "pi",
    "label": "Pi (OpenRouter)",
    "versionArgs": null,
    "fallbackPath": "~/.local/bin/pi",
    "pathRank": 4,
    "sensitivity": false
  },
  "settings": {
    "modelPattern": "^(?=.{1,128}$)[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)?$",
    "modelPlaceholder": "model-name",
    "cliLabel": "Pi",
    "vendor": "Pi",
    "setupUrl": "https://www.npmjs.com/package/@earendil-works/pi-coding-agent",
    "permissionMode": null,
    "permissionChoices": [],
    "accountWarning": null,
    "modelHeadsUp": false,
    "signInKind": "key",
    "reviewFamily": true,
    "plans": [
      [
        "unknown",
        "Not sure"
      ]
    ],
    "weights": {
      "unknown": 1
    },
    "reportedPlans": {},
    "oldPlanWeights": {}
  },
  "models": {
    "pins": {
      "light": {
        "model": "openrouter/auto"
      },
      "standard": {
        "model": "openrouter/auto"
      },
      "heavy": {
        "model": "openrouter/auto"
      },
      "critical": {
        "model": "openrouter/auto"
      },
      "lead": {
        "model": "openrouter/auto"
      }
    },
    "format": "^(?=.{1,128}$)[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)?$",
    "efforts": [
      "low",
      "medium",
      "high",
      "xhigh",
      "max"
    ],
    "hubPattern": "^(?=.{1,128}$)[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)?$",
    "slotAliases": {},
    "effortError": "effort is invalid"
  },
  "placement": {
    "workerRank": null,
    "leadDefault": false,
    "seenByDefault": false,
    "addOnMigration": false,
    "appendWhenRequested": true
  },
  "report": {
    "useHookText": false
  },
  "stopWhenEnded": true,
  "asideParentField": "cli_session_id",
  "hook": {
    "payload": "stdin"
  },
  "recoverRank": 1,
  "recoverFallback": false
};
