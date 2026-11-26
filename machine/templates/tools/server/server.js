'use strict';
const { serve } = require('./mcp-stdio.js');
serve({ name: '__NAME__', version: '1.0.0', tools: [{
  name: 'echo', description: 'Echo text',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
  call: async args => ({ text: String(args.text || ''), isError: false }),
}] });
