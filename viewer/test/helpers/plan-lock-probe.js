'use strict';
// Loaded only by the isolated server for the remote plan lock integration test.
const fs = require('node:fs');
const { Hub } = require('../../app/hub.js');
const counts = new Map();
function record(id, delta) {
  counts.set(id, (counts.get(id) || 0) + delta);
  fs.writeFileSync(process.env.WC_TEST_LOCK_FILE, JSON.stringify(Object.fromEntries(counts)));
}
for (const name of ['withThread', 'withChatThread']) {
  const original = Hub.prototype[name];
  Hub.prototype[name] = function (id, operation) {
    return original.call(this, id, async () => {
      record(id, 1);
      try { return await operation(); } finally { record(id, -1); }
    });
  };
}
