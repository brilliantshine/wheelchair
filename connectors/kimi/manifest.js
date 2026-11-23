'use strict';
module.exports = {
  "cli": "kimi",
  "provider": "kimi",
  "label": "Kimi Code",
  "displayName": "Kimi Code",
  "typesRoleMessage": true,
  "singleAccount": false,
  "capabilities": {
    "usageProbe": true,
    "usageEvents": false,
    "preflight": false,
    "sandbox": false,
    "restartLoss": false,
    "projectTools": false,
    "recover": false,
    "spend": false,
    "liveSwitch": false,
    "aside": false,
    "versionCheck": false,
    "steps": false
  },
  "install": {
    "command": "t=$(mktemp) && curl -fsSL https://code.kimi.com/kimi-code/install.sh -o \"$t\" && bash \"$t\"; r=$?; rm -f \"$t\"; exit $r",
    "binary": "kimi",
    "label": "Kimi Code",
    "versionArgs": [
      "--version"
    ],
    "fallbackPath": "~/.kimi-code/bin/kimi",
    "pathRank": 3,
    "sensitivity": false
  },
  "settings": {
    "modelPattern": "^[a-z0-9][a-z0-9._-]{0,63}(/[a-z0-9][a-z0-9._-]{0,63})?$",
    "modelPlaceholder": "model-name",
    "cliLabel": "Kimi CLI",
    "vendor": "Kimi",
    "setupUrl": "https://code.kimi.com",
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
    "accountWarning": null,
    "modelHeadsUp": false,
    "signInKind": "device",
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
        "model": "kimi-code/kimi-for-coding"
      },
      "standard": {
        "model": "kimi-code/k3"
      },
      "heavy": {
        "model": "kimi-code/k3.1-pro"
      },
      "critical": {
        "model": "kimi-code/k3.1-pro"
      },
      "lead": {
        "model": "kimi-code/k3.1-pro"
      }
    },
    "format": "^[a-z0-9][a-z0-9._-]{0,63}(/[a-z0-9][a-z0-9._-]{0,63})?$",
    "efforts": [],
    "hubPattern": "^[a-z0-9][a-z0-9._-]{0,63}(/[a-z0-9][a-z0-9._-]{0,63})?$",
    "slotAliases": {},
    "effortError": "effort is invalid"
  },
  "placement": {
    "workerRank": 3,
    "leadDefault": false,
    "seenByDefault": false,
    "addOnMigration": true,
    "appendWhenRequested": false
  },
  "report": {
    "useHookText": true
  },
  "stopWhenEnded": false,
  "recoverRank": 0,
  "recoverFallback": false
};
