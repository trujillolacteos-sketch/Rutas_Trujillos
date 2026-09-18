const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

code = code.replace(
  'const invalidClients = allClients.filter(c => c.lat === 0 || c.lng === 0);',
  'const invalidClients = allClients.filter(c => (c.lat === 0 || c.lng === 0) && c.isActive !== false);'
);

fs.writeFileSync('server/algorithm.ts', code);
