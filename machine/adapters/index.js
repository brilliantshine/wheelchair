'use strict';
// Adapter: command, firstMessage, readyText, answerPrompts, findTranscript, hookEvent,
// usageFrom, loginStatus, seed, loginEnv, loginCommand, parseLogin; optional
// onTurnEnded(session, event) binds a transcript and returns {ignored, reading}.
module.exports = { claude: require('./claude'), codex: require('./codex'), agy: require('./agy') };
