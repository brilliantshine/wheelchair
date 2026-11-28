'use strict';

// Requiring this keeps a test process, and everything it spawns, away from the `agy` on
// PATH and the real ~/.wheelchair: codex/model.sh inherits these from an in-process hub.
// A test that wants its own fake or pin file assigns these after requiring this.
const path = require('node:path');
const { makeTempSync } = require('../../../test-support/run-dir');

process.env.WHEELCHAIR_AGY = '';
process.env.WHEELCHAIR_MODELS = path.join(makeTempSync('test-models-'), 'models');
